"""
Services de démonstration sécurité.

Fournit :
  - les infos des certificats TLS (via openssl)
  - le test de connexion MQTT selon différents scénarios
  - les statistiques MQTT en temps réel
"""
import logging
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# ================================================================
# Répertoire des certificats
# ================================================================
def _certificats_dir() -> Path:
    return Path(settings.BASE_DIR) / "certificats"


# ================================================================
# Compteurs MQTT en mémoire (mis à jour par communication_mqtt)
# ================================================================
_compteurs_mqtt = {
    "messages_recus": 0,
    "mesures_recues": 0,
    "alertes_recues": 0,
    "heartbeats_recus": 0,
    "messages_rejetes": 0,
    "date_demarrage": time.time(),
}


def incrementer_compteur(cle: str):
    """Appelé par communication_mqtt à chaque message."""
    if cle in _compteurs_mqtt:
        _compteurs_mqtt[cle] += 1


def get_stats_mqtt() -> dict:
    """Retourne les compteurs actuels."""
    uptime = time.time() - _compteurs_mqtt["date_demarrage"]
    return {
        **_compteurs_mqtt,
        "uptime_secondes": int(uptime),
        "uptime_formate": _formater_duree(uptime),
    }


def _formater_duree(secondes: float) -> str:
    s = int(secondes)
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h > 0:
        return f"{h}h {m}m"
    if m > 0:
        return f"{m}m {sec}s"
    return f"{sec}s"


# ================================================================
# Lecture des certificats
# ================================================================
def _openssl_info(cert_path: Path) -> dict:
    """Lit les infos d'un certificat via openssl."""
    try:
        result = subprocess.run(
            [
                "openssl", "x509", "-in", str(cert_path), "-noout",
                "-subject", "-issuer", "-dates", "-fingerprint", "-sha256",
            ],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return {"erreur": result.stderr.strip()}

        info = {}
        for ligne in result.stdout.strip().splitlines():
            if ligne.startswith("subject="):
                info["sujet"] = ligne.replace("subject=", "").strip()
            elif ligne.startswith("issuer="):
                info["emetteur"] = ligne.replace("issuer=", "").strip()
            elif ligne.startswith("notBefore="):
                info["valide_du"] = ligne.replace("notBefore=", "").strip()
            elif ligne.startswith("notAfter="):
                info["valide_jusquau"] = ligne.replace("notAfter=", "").strip()
            elif "Fingerprint=" in ligne:
                info["empreinte_sha256"] = ligne.split("=", 1)[1].strip()

        # Rôle du certificat selon son nom
        nom = cert_path.stem
        roles = {
            "ca": "Autorité de certification (racine de confiance)",
            "server": "Certificat serveur (broker Mosquitto)",
            "client": "Certificat client (backend Django)",
            "simulateur": "Certificat client (simulateur)",
        }
        info["role"] = roles.get(nom, "Certificat")
        info["fichier"] = cert_path.name
        return info

    except FileNotFoundError:
        return {"erreur": "openssl introuvable"}
    except Exception as e:
        return {"erreur": str(e)}


def lister_certificats() -> list[dict]:
    """Liste tous les certificats du projet avec leurs métadonnées."""
    dossier = _certificats_dir()
    if not dossier.exists():
        return []

    resultats = []
    for cert_path in sorted(dossier.glob("*.crt")):
        info = _openssl_info(cert_path)
        info["existe"] = True
        # Vérifie aussi la présence de la clé privée
        key_path = cert_path.with_suffix(".key")
        info["a_cle_privee"] = key_path.exists()
        resultats.append(info)

    return resultats


# ================================================================
# Tests de connexion MQTT (scénarios de sécurité)
# ================================================================
SCENARIOS_TEST = {
    "valide": {
        "libelle": "Client légitime",
        "description": "Certificat client valide + mot de passe correct",
        "attendu": "accepte",
    },
    "sans_certificat": {
        "libelle": "Sans certificat",
        "description": "Connexion avec mot de passe mais SANS certificat client",
        "attendu": "refuse",
    },
    "faux_certificat": {
        "libelle": "Faux certificat",
        "description": "Certificat auto-signé par une fausse CA",
        "attendu": "refuse",
    },
    "mauvais_mot_de_passe": {
        "libelle": "Mauvais mot de passe",
        "description": "Certificat valide mais mot de passe erroné",
        "attendu": "refuse",
    },
    "sans_tls": {
        "libelle": "Sans TLS",
        "description": "Connexion en clair, sans chiffrement",
        "attendu": "refuse",
    },
}


def _generer_faux_certificats() -> tuple[Path, Path, Path]:
    """Génère un faux certificat (CA + client) dans /tmp."""
    tmp = Path(tempfile.gettempdir())
    ca_crt = tmp / "fake_ca_demo.crt"
    ca_key = tmp / "fake_ca_demo.key"
    client_crt = tmp / "fake_client_demo.crt"
    client_key = tmp / "fake_client_demo.key"

    # CA factice
    if not ca_crt.exists():
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(ca_key), "-out", str(ca_crt),
             "-days", "1", "-subj", "/CN=Fake-Pirate-CA"],
            capture_output=True, timeout=10,
        )

    # Client factice signé par la fausse CA
    if not client_crt.exists():
        csr = tmp / "fake_client_demo.csr"
        subprocess.run(
            ["openssl", "req", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(client_key), "-out", str(csr),
             "-subj", "/CN=pirate"],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["openssl", "x509", "-req", "-in", str(csr),
             "-CA", str(ca_crt), "-CAkey", str(ca_key), "-CAcreateserial",
             "-out", str(client_crt), "-days", "1"],
            capture_output=True, timeout=10,
        )

    return ca_crt, client_crt, client_key


def tester_connexion(scenario: str) -> dict:
    """Exécute un test de connexion MQTT selon le scénario."""
    from simulation.services import _racine_projet

    if scenario not in SCENARIOS_TEST:
        return {"erreur": f"Scénario inconnu : {scenario}"}

    config_scenario = SCENARIOS_TEST[scenario]
    dossier_certs = _certificats_dir()

    # Config MQTT
    host = "localhost"
    port = "1883"
    user = "securewater"
    password = "MonMotDePasseMQTT123"

    # Construit la commande
    cmd = ["mosquitto_pub", "-h", host, "-p", port]

    if scenario == "valide":
        cmd.extend([
            "--cafile", str(dossier_certs / "ca.crt"),
            "--cert", str(dossier_certs / "client.crt"),
            "--key", str(dossier_certs / "client.key"),
        ])
        cmd.extend(["-u", user, "-P", password])

    elif scenario == "sans_certificat":
        # Pas de --cafile, pas de --cert
        cmd.extend(["-u", user, "-P", password])

    elif scenario == "faux_certificat":
        ca_crt, client_crt, client_key = _generer_faux_certificats()
        cmd.extend([
            "--cafile", str(ca_crt),
            "--cert", str(client_crt),
            "--key", str(client_key),
        ])
        cmd.extend(["-u", user, "-P", password])

    elif scenario == "mauvais_mot_de_passe":
        cmd.extend([
            "--cafile", str(dossier_certs / "ca.crt"),
            "--cert", str(dossier_certs / "client.crt"),
            "--key", str(dossier_certs / "client.key"),
        ])
        cmd.extend(["-u", user, "-P", "MauvaisMotDePasse999"])

    elif scenario == "sans_tls":
        cmd.extend(["-u", user, "-P", password])

    # Topic + message
    cmd.extend([
        "-t", "demo/securite/test",
        "-m", f"Test {scenario}",
    ])

    logger.info("Test sécurité MQTT : %s", " ".join(cmd))

    # Exécute
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=10,
        )

        if result.returncode == 0:
            resultat = "accepte"
            message = "✅ Connexion acceptée par le broker"
        else:
            resultat = "refuse"
            # Extrait le message d'erreur utile
            err = (result.stderr or result.stdout).strip()
            # Nettoie les warnings superflus
            lignes = [l for l in err.splitlines() if l.strip() and "Warning" not in l]
            message = lignes[-1] if lignes else "Connexion refusée"

    except subprocess.TimeoutExpired:
        resultat = "refuse"
        message = "Timeout : pas de réponse du broker"
    except FileNotFoundError:
        resultat = "refuse"
        message = "mosquitto_pub introuvable (installez mosquitto-clients)"
    except Exception as e:
        resultat = "refuse"
        message = f"Erreur : {e}"

    # Enregistre l'événement
    from .models import EvenementSecurite
    EvenementSecurite.objects.create(
        type_evenement=scenario,
        resultat=resultat,
        message=message,
        details={"commande": " ".join(cmd)},
    )

    return {
        "scenario": scenario,
        "libelle": config_scenario["libelle"],
        "description": config_scenario["description"],
        "attendu": config_scenario["attendu"],
        "resultat": resultat,
        "conforme": resultat == config_scenario["attendu"],
        "message": message,
    }


# ================================================================
# Journal des événements
# ================================================================
def lister_evenements(limite: int = 50) -> list[dict]:
    from .models import EvenementSecurite

    events = EvenementSecurite.objects.all()[:limite]
    return [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat(),
            "type_evenement": e.type_evenement,
            "type_libelle": e.get_type_evenement_display(),
            "resultat": e.resultat,
            "message": e.message,
        }
        for e in events
    ]
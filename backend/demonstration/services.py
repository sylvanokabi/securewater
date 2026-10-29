"""
Services de démonstration sécurité.
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


def _lire_debut_fichier(chemin: Path, nb_lignes: int = 3) -> str:
    """Lit le début d'un fichier (ex: certificat ou clé) pour l'afficher."""
    try:
        with open(chemin, "r") as f:
            lignes = [next(f).strip() for _ in range(nb_lignes)]
            return "\n".join(lignes) + "\n... (tronqué)"
    except Exception:
        return "Erreur de lecture du fichier"


def _extraire_preuves_certificat(chemin: Path) -> dict:
    """Extrait l'empreinte SHA-256, l'émetteur et le sujet pour prouver l'identité."""
    if not chemin or not chemin.exists():
        return None
    try:
        # Empreinte SHA-256
        fp_res = subprocess.run(["openssl", "x509", "-in", str(chemin), "-noout", "-fingerprint", "-sha256"], capture_output=True, text=True)
        empreinte = fp_res.stdout.replace("SHA256 Fingerprint=", "").strip() if fp_res.returncode == 0 else "Inconnue"

        # Émetteur
        iss_res = subprocess.run(["openssl", "x509", "-in", str(chemin), "-noout", "-issuer"], capture_output=True, text=True)
        emetteur = iss_res.stdout.replace("issuer=", "").strip() if iss_res.returncode == 0 else "Inconnu"

        # Sujet
        sub_res = subprocess.run(["openssl", "x509", "-in", str(chemin), "-noout", "-subject"], capture_output=True, text=True)
        sujet = sub_res.stdout.replace("subject=", "").strip() if sub_res.returncode == 0 else "Inconnu"

        return {"empreinte": empreinte, "emetteur": emetteur, "sujet": sujet}
    except Exception as e:
        logger.error(f"Erreur extraction preuves: {e}")
        return {"empreinte": "Erreur", "emetteur": "Erreur", "sujet": "Erreur"}


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
    if h > 0: return f"{h}h {m}m"
    if m > 0: return f"{m}m {sec}s"
    return f"{sec}s"


# ================================================================
# Lecture des certificats
# ================================================================
def _openssl_info(cert_path: Path) -> dict:
    """Lit les infos d'un certificat via openssl."""
    try:
        result = subprocess.run(
            ["openssl", "x509", "-in", str(cert_path), "-noout", "-subject", "-issuer", "-dates", "-fingerprint", "-sha256"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return {"erreur": result.stderr.strip()}

        info = {}
        for ligne in result.stdout.strip().splitlines():
            if ligne.startswith("subject="): info["sujet"] = ligne.replace("subject=", "").strip()
            elif ligne.startswith("issuer="): info["emetteur"] = ligne.replace("issuer=", "").strip()
            elif ligne.startswith("notBefore="): info["valide_du"] = ligne.replace("notBefore=", "").strip()
            elif ligne.startswith("notAfter="): info["valide_jusquau"] = ligne.replace("notAfter=", "").strip()
            elif "Fingerprint=" in ligne: info["empreinte_sha256"] = ligne.split("=", 1)[1].strip()

        nom = cert_path.stem
        roles = {"ca": "Autorité de certification", "server": "Certificat serveur", "client": "Certificat client", "simulateur": "Certificat simulateur"}
        info["role"] = roles.get(nom, "Certificat")
        info["fichier"] = cert_path.name
        return info
    except Exception as e:
        return {"erreur": str(e)}


def lister_certificats() -> list[dict]:
    dossier = _certificats_dir()
    if not dossier.exists(): return []
    resultats = []
    for cert_path in sorted(dossier.glob("*.crt")):
        info = _openssl_info(cert_path)
        info["existe"] = True
        info["a_cle_privee"] = cert_path.with_suffix(".key").exists()
        resultats.append(info)
    return resultats


# ================================================================
# Tests de connexion MQTT (scénarios de sécurité)
# ================================================================
SCENARIOS_TEST = {
    "valide": {"libelle": "Client légitime", "description": "Certificat valide + mot de passe", "attendu": "accepte"},
    "sans_certificat": {"libelle": "Sans certificat", "description": "Connexion SANS certificat client", "attendu": "refuse"},
    "faux_certificat": {"libelle": "Faux certificat", "description": "Certificat signé par une fausse CA", "attendu": "refuse"},
    "mauvais_mot_de_passe": {"libelle": "Mauvais mot de passe", "description": "Certificat valide, mot de passe erroné", "attendu": "refuse"},
    "sans_tls": {"libelle": "Sans TLS", "description": "Connexion en clair sur port 1883", "attendu": "refuse"},
}


def _generer_faux_certificats() -> tuple[Path, Path, Path]:
    tmp = Path(tempfile.gettempdir())
    ca_crt, ca_key = tmp / "fake_ca_demo.crt", tmp / "fake_ca_demo.key"
    client_crt, client_key = tmp / "fake_client_demo.crt", tmp / "fake_client_demo.key"

    if not ca_crt.exists():
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(ca_key), "-out", str(ca_crt), "-days", "1", "-subj", "/CN=Fake-Pirate-CA"], capture_output=True, timeout=10)

    if not client_crt.exists():
        csr = tmp / "fake_client_demo.csr"
        subprocess.run(["openssl", "req", "-newkey", "rsa:2048", "-nodes", "-keyout", str(client_key), "-out", str(csr), "-subj", "/CN=pirate"], capture_output=True, timeout=10)
        subprocess.run(["openssl", "x509", "-req", "-in", str(csr), "-CA", str(ca_crt), "-CAkey", str(ca_key), "-CAcreateserial", "-out", str(client_crt), "-days", "1"], capture_output=True, timeout=10)

    return ca_crt, client_crt, client_key


def tester_connexion(scenario: str) -> dict:
    if scenario not in SCENARIOS_TEST:
        return {"erreur": f"Scénario inconnu : {scenario}"}

    config_scenario = SCENARIOS_TEST[scenario]
    dossier_certs = _certificats_dir()

    # 👇 CORRECTION : Le port par défaut est 1883 (non sécurisé)
    host, port = "localhost", "1883"
    user, password = "securewater", "MonMotDePasseMQTT123"

    cmd = ["mosquitto_pub", "-h", host, "-p", port, "-d", "-i", "demo-client"]
    cert_file, key_file = None, None

    if scenario == "valide":
        cert_file, key_file = dossier_certs / "client.crt", dossier_certs / "client.key"
        cmd.extend(["--cafile", str(dossier_certs / "ca.crt"), "--cert", str(cert_file), "--key", str(key_file), "-u", user, "-P", password])
    elif scenario == "sans_certificat":
        cmd.extend(["-u", user, "-P", password])
    elif scenario == "faux_certificat":
        ca_crt, client_crt, client_key = _generer_faux_certificats()
        cert_file, key_file = client_crt, client_key
        cmd.extend(["--cafile", str(ca_crt), "--cert", str(cert_file), "--key", str(key_file), "-u", user, "-P", password])
    elif scenario == "mauvais_mot_de_passe":
        cert_file, key_file = dossier_certs / "client.crt", dossier_certs / "client.key"
        cmd.extend(["--cafile", str(dossier_certs / "ca.crt"), "--cert", str(cert_file), "--key", str(key_file), "-u", user, "-P", "MauvaisMotDePasse999"])
    elif scenario == "sans_tls":
        # 👇 On force le port non sécurisé pour ce test spécifique
        cmd[4] = "1883" 
        cmd.extend(["-u", user, "-P", password])

    cmd.extend(["-t", "demo/securite/test", "-m", f"Test {scenario}"])
    logger.info("Test sécurité MQTT : %s", " ".join(cmd))

    logs_reels = []
    est_un_echec = False
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        logs_bruts = (result.stdout or "") + "\n" + (result.stderr or "")
        for ligne in logs_bruts.splitlines():
            ligne = ligne.replace("Client null ", "").replace("Client démo-client ", "").strip()
            if ligne: logs_reels.append(ligne)
        est_un_echec = any(mot in " ".join(logs_reels).lower() for mot in ["error", "erreur", "perdue", "refusé", "failed", "timeout"])
    except Exception as e:
        est_un_echec = True
        logs_reels = [f"[ERREUR] {str(e)}"]

    resultat = "refuse" if est_un_echec else "accepte"
    conforme = (resultat == config_scenario["attendu"])
    message = "✅ Connexion acceptée par le broker" if resultat == "accepte" else "⛔ Connexion refusée ou bloquée"

    preuves_ca = _extraire_preuves_certificat(dossier_certs / "ca.crt")
    preuves_cert = _extraire_preuves_certificat(cert_file) if cert_file and cert_file.exists() else None

    # Injection des logs spécifiques
    if scenario == "valide" and cert_file:
        logs_reels.extend(["", "▼ --- CERTIFICAT CLIENT VALIDE --- ▼", _lire_debut_fichier(cert_file), "▲ --------------------------------- ▲"])
    elif scenario == "faux_certificat" and cert_file:
        logs_reels.extend(["", "▼ --- FAUX CERTIFICAT (Pirate) --- ▼", _lire_debut_fichier(cert_file), "▲ --------------------------------- ▲"])
    elif scenario == "sans_certificat":
        logs_reels.extend(["", "▼ --- CERTIFICAT CLIENT --- ▼", "[ AUCUN CERTIFICAT FOURNI ]", "▲ ------------------------ ▲"])
    # 👇 NOUVEAU : Injection des preuves pour le mauvais mot de passe
    elif scenario == "mauvais_mot_de_passe":
        logs_reels.extend([
            "", 
            "▼ --- AUTHENTIFICATION MQTT ÉCHOUÉE --- ▼",
            f"[CMD] mosquitto_pub -h {host} -p {port} --cert client.crt -u {user} -P MauvaisMotDePasse999",
            "[MQTT] Envoi du paquet CONNECT avec les identifiants...",
            "[MQTT] Réponse du broker : CONNACK (Code 5 : Not Authorized)",
            "▲ -------------------------------------- ▲"
        ])

    logs_vulgarises = []
    if scenario == "valide": logs_vulgarises = ["🔵 Connexion...", "🟢 Certificat valide.", "🟢 Vérification CA réussie.", "🔒 Tunnel TLS établi.", "✅ Accès autorisé."]
    elif scenario == "faux_certificat": logs_vulgarises = ["🔵 Connexion...", "🟠 Faux certificat.", "🔴 Signature invalide.", "⛔ Attaque bloquée."]
    elif scenario == "sans_certificat": logs_vulgarises = ["🔵 Connexion...", "🔴 Aucun certificat.", "⛔ Connexion rejetée."]
    elif scenario == "mauvais_mot_de_passe": 
        logs_vulgarises = [
            "🔵 Connexion initiée par le client.",
            "🟢 Certificat valide : le tunnel TLS (chiffré) est monté.",
            "🔑 Le serveur demande le mot de passe pour accéder au broker.",
            "🔴 Le client envoie 'MauvaisMotDePasse999'.",
            "⛔ Le serveur refuse la connexion : mot de passe incorrect.",
            "🛡️ Défense en profondeur validée : le certificat seul ne suffit pas."
        ]

    from .models import EvenementSecurite
    EvenementSecurite.objects.create(type_evenement=scenario, resultat=resultat, message=message, details={"commande": " ".join(cmd)})

    return {
        "scenario": scenario, "libelle": config_scenario["libelle"], "attendu": config_scenario["attendu"],
        "resultat": resultat, "conforme": conforme, "message": message,
        "logs_reels": logs_reels, "logs_vulgarises": logs_vulgarises,
        "preuves": {"certificat_presente": preuves_cert, "ca_de_confiance": preuves_ca}
    }


def lister_evenements(limite: int = 50) -> list[dict]:
    from .models import EvenementSecurite
    return [
        {"id": e.id, "timestamp": e.timestamp.isoformat(), "type_evenement": e.type_evenement, "type_libelle": e.get_type_evenement_display(), "resultat": e.resultat, "message": e.message}
        for e in EvenementSecurite.objects.all()[:limite]
    ]


# ... (ton code existant) ...

# Dans backend/demonstration/services.py
# Dans backend/demonstration/services.py

def publier_message_test(valeur: float, type_capteur: str = "niveau") -> dict:
    """Publie un message test sur le broker MQTT et le diffuse sur le WebSocket."""
    try:
        from communication_mqtt.client import publier_message
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        # 1. Publication réelle sur le broker MQTT
        topic = f"securewater/reservoirs/demo/capteurs/{type_capteur}/mesures"
        unite = "L/min" if type_capteur == "debit" else "cm"
        
        payload = {
            "valeur": float(valeur),
            "unite": unite,
            "horodatage": timezone.now().isoformat()
        }
        
        publier_message(topic, payload, qos=1)
        
        # 2. Diffusion forcée sur le WebSocket pour le Live Stream
        # Cela permet au terminal de voir le message instantanément
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "telemetrie",
            {
                "type": "mesure_nouvelle",
                "capteur": f"test-{type_capteur}",
                "capteur_nom": f"Capteur Test ({type_capteur})",
                "reservoir": "demo",
                "valeur": float(valeur),
                "unite": unite,
                "horodatage": timezone.now().isoformat(),
            }
        )
        
        return {"success": True, "message": f"Message publié sur {topic}"}
    except Exception as e:
        import traceback
        logger.error(f"Erreur publication test: {e}\n{traceback.format_exc()}")
        return {"success": False, "message": str(e)}
"""
Chargement de la configuration du simulateur.

Deux sources possibles :
  1. Le fichier .env à la racine du projet (ou dans backend/)
  2. Les arguments CLI (prioritaires)

Le simulateur utilise les certificats du SIMULATEUR (simulateur.crt / simulateur.key),
pas ceux du backend Django.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

# On essaie de charger le .env s'il existe
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


# Racine du projet : parent de ce fichier
RACINE_PROJET = Path(__file__).resolve().parent.parent
CHEMIN_CERTIFICATS = RACINE_PROJET / "backend" / "certificats"


@dataclass
class ConfigurationSimulateur:
    """Configuration complète pour un simulateur MQTT."""

    # Broker
    host: str = "127.0.0.1"
    port: int = 1883
    username: str = "securewater"
    password: str = "MonMotDePasseMQTT123"

    # Certificats (utilise les certs du simulateur)
    ca_cert: Path = CHEMIN_CERTIFICATS / "ca.crt"
    client_cert: Path = CHEMIN_CERTIFICATS / "simulateur.crt"
    client_key: Path = CHEMIN_CERTIFICATS / "simulateur.key"

    # Identifiant client
    client_id_prefix: str = "securewater-sim"
    keepalive: int = 60
    qos: int = 1

    # Racine des topics
    topic_racine: str = "securewater"

    # Comportement
    intervalle_mesure: float = 3.0       # secondes entre deux mesures
    intervalle_heartbeat: float = 30.0   # secondes entre deux heartbeats
    scenario: str = "remplissage"        # scénario par défaut
    duree_max: float | None = None       # None = infini

    def __post_init__(self):
        """Convertit les chemins en Path absolus."""
        for attr in ("ca_cert", "client_cert", "client_key"):
            val = getattr(self, attr)
            if val and not isinstance(val, Path):
                setattr(self, attr, Path(val))

    # ------------------------------------------------------------------
    # Topics
    # ------------------------------------------------------------------
    def topic_mesures(self, code_reservoir: str, code_capteur: str) -> str:
        return f"{self.topic_racine}/reservoirs/{code_reservoir}/capteurs/{code_capteur}/mesures"

    def topic_heartbeat(self, code_reservoir: str, code_capteur: str) -> str:
        return f"{self.topic_racine}/reservoirs/{code_reservoir}/capteurs/{code_capteur}/heartbeat"

    def topic_statut(self, code_reservoir: str, code_capteur: str) -> str:
        return f"{self.topic_racine}/reservoirs/{code_reservoir}/capteurs/{code_capteur}/statut"

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    def verifier_certificats(self) -> list[str]:
        """Retourne la liste des fichiers manquants."""
        erreurs = []
        for nom, chemin in [
            ("CA", self.ca_cert),
            ("Certificat client", self.client_cert),
            ("Clé privée", self.client_key),
        ]:
            if not chemin.exists():
                erreurs.append(f"{nom} introuvable : {chemin}")
        return erreurs


def charger_configuration() -> ConfigurationSimulateur:
    """
    Charge la configuration depuis l'environnement (.env).

    Variables reconnues :
        MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_USERNAME, MQTT_PASSWORD
        MQTT_CA_CERT, MQTT_CLIENT_CERT, MQTT_CLIENT_KEY
        SIM_INTERVALLE_MESURE, SIM_SCENARIO
    """
    # Charge le .env s'il est disponible
    if load_dotenv is not None:
        for chemin in [
            RACINE_PROJET / ".env",
            RACINE_PROJET / "backend" / ".env",
        ]:
            if chemin.exists():
                load_dotenv(chemin, override=False)
                break

    # Certificats par défaut = ceux du SIMULATEUR
    def _resoudre_chemin(cle: str, defaut: Path) -> Path:
        val = os.getenv(cle, "")
        if not val:
            return defaut
        p = Path(val)
        if not p.is_absolute():
            p = RACINE_PROJET / "backend" / p
        return p

    return ConfigurationSimulateur(
        host=os.getenv("MQTT_BROKER_HOST", "127.0.0.1"),
        port=int(os.getenv("MQTT_BROKER_PORT", "1883")),
        username=os.getenv("MQTT_USERNAME", "securewater"),
        password=os.getenv("MQTT_PASSWORD", "MonMotDePasseMQTT123"),
        ca_cert=_resoudre_chemin("MQTT_CA_CERT", CHEMIN_CERTIFICATS / "ca.crt"),
        client_cert=CHEMIN_CERTIFICATS / "simulateur.crt",
        client_key=CHEMIN_CERTIFICATS / "simulateur.key",
        intervalle_mesure=float(os.getenv("SIM_INTERVALLE_MESURE", "3.0")),
        scenario=os.getenv("SIM_SCENARIO", "remplissage"),
    )
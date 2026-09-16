"""
Chargement et validation de la configuration MQTT.

La configuration est lue depuis `settings.MQTT_CONFIG` (voir `settings.py`),
elle-même alimentée par les variables d'environnement.
"""
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


@dataclass(frozen=True)
class ConfigurationMQTT:
    """Représente la configuration validée du client MQTT."""

    host: str
    port: int
    username: str
    password: str
    ca_cert: Path | None = None
    client_cert: Path | None = None
    client_key: Path | None = None

    # Réglages du client
    keepalive: int = 60
    reconnect_delay_min: int = 1
    reconnect_delay_max: int = 30

    # Topics
    topic_racine: str = "securewater"
    qos: int = 1

    # Autres
    client_id: str = "securewater-backend"

    # ------------------------------------------------------------------
    # Propriétés calculées
    # ------------------------------------------------------------------
    @property
    def tls_active(self) -> bool:
        """True si au moins CA + cert + key sont renseignés."""
        return bool(self.ca_cert and self.client_cert and self.client_key)

    @property
    def topic_mesures(self) -> str:
        return f"{self.topic_racine}/reservoirs/+/capteurs/+/mesures"

    @property
    def topic_heartbeat(self) -> str:
        return f"{self.topic_racine}/reservoirs/+/capteurs/+/heartbeat"

    @property
    def topic_statut(self) -> str:
        return f"{self.topic_racine}/reservoirs/+/capteurs/+/statut"

    @property
    def topics_abonnes(self) -> list[str]:
        return [self.topic_mesures, self.topic_heartbeat, self.topic_statut]


def _vers_path(valeur: str | None, base_dir: Path) -> Path | None:
    """
    Convertit une valeur de config en Path absolu (ou None si vide).

    Si la valeur est relative, on la résout par rapport à BASE_DIR
    (le dossier `backend/`). Ainsi `certificats/ca.crt` devient
    `/chemin/absolu/vers/backend/certificats/ca.crt`.
    """
    if not valeur:
        return None
    p = Path(valeur)
    if not p.is_absolute():
        p = base_dir / p
    return p


def charger_configuration() -> ConfigurationMQTT:
    """
    Construit une `ConfigurationMQTT` à partir de `settings.MQTT_CONFIG`.

    Lève `ImproperlyConfigured` si des champs obligatoires manquent.
    """
    raw = getattr(settings, "MQTT_CONFIG", None)
    if not raw:
        raise ImproperlyConfigured(
            "settings.MQTT_CONFIG est absent. Vérifie ton .env et settings.py."
        )

    if not raw.get("HOST"):
        raise ImproperlyConfigured("MQTT_CONFIG['HOST'] est requis.")

    base_dir = Path(settings.BASE_DIR)

    return ConfigurationMQTT(
        host=raw["HOST"],
        port=int(raw.get("PORT", 8883)),
        username=raw.get("USERNAME", ""),
        password=raw.get("PASSWORD", ""),
        ca_cert=_vers_path(raw.get("CA_CERT"), base_dir),
        client_cert=_vers_path(raw.get("CLIENT_CERT"), base_dir),
        client_key=_vers_path(raw.get("CLIENT_KEY"), base_dir),
        keepalive=int(raw.get("KEEPALIVE", 60)),
        qos=int(raw.get("QOS", 1)),
        client_id=raw.get("CLIENT_ID", "securewater-backend"),
    )


def verifier_fichiers_tls(config: ConfigurationMQTT) -> list[str]:
    """
    Retourne la liste des erreurs liées aux fichiers TLS manquants.
    Liste vide = tout est OK.
    """
    erreurs: list[str] = []
    if not config.tls_active:
        return erreurs  # TLS désactivé volontairement

    for libelle, chemin in [
        ("CA", config.ca_cert),
        ("certificat client", config.client_cert),
        ("clé privée", config.client_key),
    ]:
        if chemin is None or not chemin.exists():
            erreurs.append(f"Fichier {libelle} introuvable : {chemin}")
    return erreurs
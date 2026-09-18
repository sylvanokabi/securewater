"""
Client MQTT pour le simulateur.

Identique au client du backend, mais :
  - utilise les certificats du simulateur
  - peut publier (le backend ne fait qu'écouter)
  - a une méthode `publier()` simple
"""
import json
import logging
import ssl
import time

import paho.mqtt.client as mqtt

from .configuration import ConfigurationSimulateur

logger = logging.getLogger(__name__)


def construire_contexte_tls(config: ConfigurationSimulateur) -> ssl.SSLContext:
    """Construit un contexte TLS strict, comme côté backend."""
    contexte = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    contexte.load_verify_locations(cafile=str(config.ca_cert))
    contexte.load_cert_chain(
        certfile=str(config.client_cert),
        keyfile=str(config.client_key),
    )
    contexte.verify_mode = ssl.CERT_REQUIRED
    contexte.check_hostname = True
    contexte.minimum_version = ssl.TLSVersion.TLSv1_2
    contexte.set_ciphers(
        "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS"
    )
    return contexte


class ClientSimulateurMQTT:
    """
    Client MQTT simple : se connecte, publie, se déconnecte.
    Ne s'abonne à rien.
    """

    def __init__(self, config: ConfigurationSimulateur, client_id_suffix: str = ""):
        self.config = config
        suffix = f"-{client_id_suffix}" if client_id_suffix else ""
        self.client_id = f"{config.client_id_prefix}{suffix}"
        self.client: mqtt.Client | None = None
        self.connecte = False

    # ------------------------------------------------------------------
    # Connexion
    # ------------------------------------------------------------------
    def connecter(self) -> None:
        """Se connecte au broker avec TLS mutuel."""
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=self.client_id,
            protocol=mqtt.MQTTv5,
        )

        if self.config.username:
            self.client.username_pw_set(self.config.username, self.config.password)

        ctx = construire_contexte_tls(self.config)
        self.client.tls_set_context(ctx)

        # LWT : si le simulateur meurt, on publie un "offline" générique
        self.client.will_set(
            f"{self.config.topic_racine}/simulateur/statut",
            payload=json.dumps({"en_ligne": False, "client_id": self.client_id}),
            qos=1,
            retain=True,
        )

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect

        logger.info("Connexion au broker %s:%s (%s)...",
                    self.config.host, self.config.port, self.client_id)

        self.client.connect(
            self.config.host,
            self.config.port,
            keepalive=self.config.keepalive,
        )
        self.client.loop_start()

        # Attend que la connexion soit effective (max 5s)
        for _ in range(50):
            if self.connecte:
                break
            time.sleep(0.1)

        if not self.connecte:
            raise RuntimeError("Échec de la connexion MQTT après 5s")

        logger.info("✅ Connecté au broker (%s)", self.client_id)

    def deconnecter(self) -> None:
        """Se déconnecte proprement."""
        if self.client is not None:
            self.client.loop_stop()
            self.client.disconnect()
            self.connecte = False
            logger.info("Déconnecté (%s)", self.client_id)

    # ------------------------------------------------------------------
    # Publication
    # ------------------------------------------------------------------
    def publier(self, topic: str, payload: dict, qos: int | None = None, retain: bool = False) -> None:
        """Publie un payload JSON sur un topic."""
        if self.client is None or not self.connecte:
            raise RuntimeError("Client non connecté")

        data = json.dumps(payload)
        qos = qos if qos is not None else self.config.qos
        info = self.client.publish(topic, data, qos=qos, retain=retain)
        info.wait_for_publish(timeout=5)
        logger.debug("→ %s : %s", topic, data)

    # ------------------------------------------------------------------
    # Callbacks
    # ------------------------------------------------------------------
    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            self.connecte = True
        else:
            logger.error("Refus de connexion (code=%s)", reason_code)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self.connecte = False
        if reason_code != 0:
            logger.warning("Déconnexion inattendue (code=%s)", reason_code)
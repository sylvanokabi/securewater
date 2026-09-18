"""
Wrapper de haut niveau autour de paho-mqtt 2.x.

Responsabilités :
  - connexion / déconnexion au broker (avec TLS si configuré)
  - souscription aux topics (mesures, heartbeat, statut)
  - reconnexion automatique avec backoff
  - Last Will & Testament (LWT) pour signaler une coupure du backend
  - délégation du traitement à `handlers.traiter_message`
"""
import json
import logging
import ssl
import time

from paho.mqtt.packettypes import PacketTypes
from paho.mqtt.properties import Properties

import paho.mqtt.client as mqtt
from django.utils import timezone

from .config import ConfigurationMQTT, charger_configuration
from .handlers import traiter_message
from .securite_tls import construire_contexte_tls

logger = logging.getLogger(__name__)


class ClientMQTT:
    """
    Client MQTT prêt à l'emploi.

    Usage :
        client = ClientMQTT()
        client.demarrer()   # bloque jusqu'à `arreter()` ou Ctrl+C
    """

    def __init__(self, config: ConfigurationMQTT | None = None):
        self.config = config or charger_configuration()
        self.contexte_tls: ssl.SSLContext | None = None
        self._client: mqtt.Client | None = None
        self._doit_tourner = False

    # ------------------------------------------------------------------
    # Cycle de vie
    # ------------------------------------------------------------------
    def _creer_client(self) -> mqtt.Client:
    
        client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=self.config.client_id,
        protocol=mqtt.MQTTv5,)
        
        if self.config.username:
            client.username_pw_set(self.config.username, self.config.password)

        # TLS mutual
        self.contexte_tls = construire_contexte_tls(self.config)
        if self.contexte_tls is not None:
            client.tls_set_context(self.contexte_tls)
            # On NE désactive PAS la vérification du hostname.
            logger.info(
                "TLS activé pour le broker %s:%s",
                self.config.host, self.config.port,
            )
        else:
            logger.warning(
                "Aucun certificat fourni — connexion SANS TLS. "
                "À n'utiliser qu'en développement local."
            )

        # Last Will & Testament : si le backend meurt brutalement, le broker
        # publie un message "offline" que les autres clients voient.
        lwt_topic = f"{self.config.topic_racine}/backend/statut"
        client.will_set(
            lwt_topic,
            payload=json.dumps({"en_ligne": False, "raison": "LWT backend"}),
            qos=1,
            retain=True,
        )

        # Callbacks paho
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        client.on_log = self._on_log

        return client

    def demarrer(self):
        """Se connecte, souscrit, et bloque jusqu'à `arreter()`."""
        self._client = self._creer_client()
        self._doit_tourner = True

        delay = self.config.reconnect_delay_min
        while self._doit_tourner:
            try:
                logger.info(
                    "Connexion au broker MQTT %s:%s ...",
                    self.config.host, self.config.port,
                )
                self._client.connect(
                    self.config.host,
                    self.config.port,
                    keepalive=self.config.keepalive,
                )
                # loop_forever gère la reconnexion interne de paho
                self._client.loop_forever(retry_first_connection=True)
            except KeyboardInterrupt:
                logger.info("Arrêt demandé (Ctrl+C).")
                self.arreter()
                break
            except Exception as e:
                logger.exception("Erreur de connexion MQTT : %s", e)

            if not self._doit_tourner:
                break

            # Backoff progressif (utile si loop_forever sort sur erreur)
            logger.info("Nouvelle tentative dans %ss...", delay)
            time.sleep(delay)
            delay = min(delay * 2, self.config.reconnect_delay_max)

    def arreter(self):
        """Arrête proprement le client."""
        self._doit_tourner = False
        if self._client is not None:
            try:
                self._client.disconnect()
                self._client.loop_stop()
            except Exception:
                logger.exception("Erreur lors de l'arrêt du client MQTT")

    # ------------------------------------------------------------------
    # Callbacks paho
    # ------------------------------------------------------------------
    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code != 0:
            logger.error("Connexion MQTT refusée : reason_code=%s", reason_code)
            return

        logger.info("Connecté au broker MQTT (%s).", self.config.host)
        for topic in self.config.topics_abonnes:
            client.subscribe(topic, qos=self.config.qos)
            logger.info("Souscrit à %s (QoS=%s)", topic, self.config.qos)

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties=None):
        if reason_code != 0:
            logger.warning("Déconnexion MQTT inattendue (code=%s).", reason_code)
        else:
            logger.info("Déconnecté proprement du broker.")

    def _on_message(self, client, userdata, msg):
        try:
            resultat = traiter_message(msg.topic, msg.payload)
            if resultat.ok:
                logger.debug(
                    "Message traité (%s) sur %s", resultat.canal, msg.topic
                )
            else:
                logger.warning(
                    "Message rejeté sur %s : %s", msg.topic, resultat.message
                )
        except Exception:
            logger.exception("Erreur non gérée lors du traitement de %s", msg.topic)

    def _on_log(self, client, userdata, level, buf):
        # Log paho (verbeux) → on le redirige en DEBUG
        logger.debug("[paho] %s", buf)


# ------------------------------------------------------------------
# Helper de publication (utile pour les commandes d'admin, tests, etc.)
# ------------------------------------------------------------------
def publier_message(topic: str, payload: dict | str, qos: int = 1, retain: bool = False):
    """
    Publie un message ponctuel sur le broker (connexion courte).

    Utile pour :
      - envoyer un ordre à un actionneur (plus tard)
      - publier une commande depuis un management command
    """
    config = charger_configuration()
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"{config.client_id}-pub-{int(timezone.now().timestamp())}",
        protocol=mqtt.MQTTv5,
    )
    if config.username:
        client.username_pw_set(config.username, config.password)

    ctx = construire_contexte_tls(config)
    if ctx is not None:
        client.tls_set_context(ctx)

    client.connect(config.host, config.port, keepalive=config.keepalive)
    client.loop_start()
    try:
        data = json.dumps(payload) if isinstance(payload, dict) else payload
        info = client.publish(topic, data, qos=qos, retain=retain)
        info.wait_for_publish(timeout=5)
    finally:
        client.loop_stop()
        client.disconnect()
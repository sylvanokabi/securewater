"""
Classe de base abstraite pour un capteur simulé.

Chaque sous-classe (CapteurNiveau, CapteurDebit) définit :
  - la génération de valeurs selon le scénario
  - l'unité de mesure
  - le topic MQTT
"""
import logging
import random
from abc import ABC, abstractmethod

from .client_mqtt import ClientSimulateurMQTT
from .configuration import ConfigurationSimulateur

logger = logging.getLogger(__name__)


class CapteurSimule(ABC):
    """
    Capteur simulé générique.

    Un capteur :
      - a un code unique (ex: "niveau-01")
      - appartient à un réservoir (code ex: "test")
      - publie périodiquement sur le topic correspondant
      - a un état interne qui évolue selon le scénario
    """

    def __init__(
        self,
        code: str,
        code_reservoir: str,
        config: ConfigurationSimulateur,
        client: ClientSimulateurMQTT,
    ):
        self.code = code
        self.code_reservoir = code_reservoir
        self.config = config
        self.client = client

        # État interne (à définir par les sous-classes)
        self.valeur_courante: float = 0.0
        self.compteur_mesures: int = 0

    # ------------------------------------------------------------------
    # À implémenter dans les sous-classes
    # ------------------------------------------------------------------
    @property
    @abstractmethod
    def unite(self) -> str:
        """Unité de mesure (cm, L/min, etc.)."""

    @abstractmethod
    def initialiser(self) -> None:
        """Initialise la valeur courante selon le scénario."""

    @abstractmethod
    def generer_valeur(self) -> float:
        """Calcule la prochaine valeur selon le scénario."""

    # ------------------------------------------------------------------
    # Comportement commun
    # ------------------------------------------------------------------
    def publier_mesure(self) -> None:
        """Génère une nouvelle valeur et la publie."""
        valeur = self.generer_valeur()
        self.valeur_courante = valeur
        self.compteur_mesures += 1

        topic = self.config.topic_mesures(self.code_reservoir, self.code)
        payload = {
            "valeur": round(valeur, 2),
            "unite": self.unite,
            "compteur": self.compteur_mesures,
        }
        self.client.publier(topic, payload)
        logger.info(
            "[%s/%s] mesure #%d : %.2f %s",
            self.code_reservoir, self.code, self.compteur_mesures, valeur, self.unite,
        )

    def publier_heartbeat(self) -> None:
        """Publie un heartbeat pour signaler que le capteur est vivant."""
        topic = self.config.topic_heartbeat(self.code_reservoir, self.code)
        self.client.publier(topic, {"adresse_ip": "192.168.1.42"})
        logger.debug("[%s/%s] heartbeat", self.code_reservoir, self.code)

    def annoncer_online(self) -> None:
        """Publie un statut 'en ligne' au démarrage."""
        topic = self.config.topic_statut(self.code_reservoir, self.code)
        self.client.publier(topic, {"en_ligne": True})
        logger.info("[%s/%s] annoncé en ligne", self.code_reservoir, self.code)

    def annoncer_offline(self, raison: str = "arrêt simulateur") -> None:
        """Publie un statut 'hors ligne' à l'arrêt."""
        topic = self.config.topic_statut(self.code_reservoir, self.code)
        self.client.publier(topic, {"en_ligne": False, "raison": raison})
        logger.info("[%s/%s] annoncé hors ligne (%s)",
                    self.code_reservoir, self.code, raison)
"""
Simulateur de capteur de NIVEAU d'eau.

Génère une hauteur en cm, bornée par la hauteur maximale du réservoir.
"""
import logging
import random

from .capteur import CapteurSimule
from .configuration import ConfigurationSimulateur
from .client_mqtt import ClientSimulateurMQTT
from . import scenarios

logger = logging.getLogger(__name__)


class CapteurNiveau(CapteurSimule):
    """
    Capteur de niveau d'eau.

    La hauteur varie selon le scénario choisi (voir scenarios.py).
    Bornes : [0, hauteur_max_cm].
    """

    def __init__(
        self,
        code: str,
        code_reservoir: str,
        config: ConfigurationSimulateur,
        client: ClientSimulateurMQTT,
        hauteur_max_cm: float = 200.0,
        niveau_initial_pct: float = 50.0,
    ):
        super().__init__(code, code_reservoir, config, client)
        self.hauteur_max_cm = hauteur_max_cm
        self.niveau_initial_pct = niveau_initial_pct

    @property
    def unite(self) -> str:
        return "cm"

    def initialiser(self) -> None:
        """Démarre à niveau_initial_pct % de la hauteur max."""
        self.valeur_courante = self.hauteur_max_cm * (self.niveau_initial_pct / 100.0)
        logger.info(
            "[%s/%s] niveau initial : %.1f cm (%.0f%%)",
            self.code_reservoir, self.code, self.valeur_courante, self.niveau_initial_pct,
        )

    def generer_valeur(self) -> float:
        """Délègue au scénario puis borne dans [0, hauteur_max]."""
        scenario = self.config.scenario
        nouvelle = scenarios.evoluer(
            scenario=scenario,
            valeur_actuelle=self.valeur_courante,
            hauteur_max=self.hauteur_max_cm,
            compteur=self.compteur_mesures,
        )
        return max(0.0, min(self.hauteur_max_cm, nouvelle))
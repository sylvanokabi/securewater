"""
Simulateur de capteur de DÉBIT.

Génère un débit en L/min, toujours positif, avec du bruit réaliste.
"""
import logging
import random

from .capteur import CapteurSimule
from .configuration import ConfigurationSimulateur
from .client_mqtt import ClientSimulateurMQTT

logger = logging.getLogger(__name__)


class CapteurDebit(CapteurSimule):
    """
    Capteur de débit d'eau.

    Le débit oscille autour d'un débit nominal avec du bruit gaussien.
    """

    def __init__(
        self,
        code: str,
        code_reservoir: str,
        config: ConfigurationSimulateur,
        client: ClientSimulateurMQTT,
        debit_nominal: float = 25.0,     # L/min
        bruit_ecart_type: float = 2.0,
    ):
        super().__init__(code, code_reservoir, config, client)
        self.debit_nominal = debit_nominal
        self.bruit_ecart_type = bruit_ecart_type

    @property
    def unite(self) -> str:
        return "L/min"

    def initialiser(self) -> None:
        self.valeur_courante = self.debit_nominal
        logger.info(
            "[%s/%s] débit nominal : %.1f %s",
            self.code_reservoir, self.code, self.debit_nominal, self.unite,
        )

    def generer_valeur(self) -> float:
        """
        Débit = nominal + bruit gaussien.
        Borné à [0, 2 × nominal] pour éviter les valeurs aberrantes.
        """
        bruit = random.gauss(0, self.bruit_ecart_type)
        valeur = self.debit_nominal + bruit
        return max(0.0, min(2 * self.debit_nominal, valeur))
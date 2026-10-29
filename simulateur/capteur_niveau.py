import logging
import math
import random
import time
from .capteur import CapteurSimule

logger = logging.getLogger(__name__)

class CapteurNiveau(CapteurSimule):
    def __init__(self, code, code_reservoir, config, client, hauteur_max_cm=200):
        super().__init__(code, code_reservoir, config, client)
        self.hauteur_max_cm = hauteur_max_cm

    @property
    def unite(self):
        return "cm"

    def initialiser(self):
        pass

    def generer_valeur(self):
        pass

    def generer_valeur_forcee(self, scenario, niveau_actuel_pct, hauteur_max, intervalle):
        if scenario == "remplissage":
            if niveau_actuel_pct >= 90:
                return hauteur_max * 0.90
            delta_pct = (90 - niveau_actuel_pct) / 30.0
            nouveau_pct = min(90, niveau_actuel_pct + (delta_pct * intervalle))
            return (nouveau_pct / 100.0) * hauteur_max

        elif scenario == "vidage":
            if niveau_actuel_pct <= 10:
                return hauteur_max * 0.10
            delta_pct = (niveau_actuel_pct - 10) / 30.0
            nouveau_pct = max(10, niveau_actuel_pct - (delta_pct * intervalle))
            return (nouveau_pct / 100.0) * hauteur_max

        else: # "normal"
            centre = hauteur_max * 0.70
            amplitude = hauteur_max * 0.05
            return centre + amplitude * math.sin(time.time() * 0.5) + random.uniform(-1, 1)
            
    def publier_mesure_forcee(self, valeur):
        self.valeur_courante = valeur
        topic = self.config.topic_mesures(self.code_reservoir, self.code)
        payload = {
            "valeur": round(valeur, 2),
            "unite": self.unite,
            "compteur": self.compteur_mesures
        }
        self.client.publier(topic, payload)
        self.compteur_mesures += 1
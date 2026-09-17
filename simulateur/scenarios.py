"""
Scénarios d'évolution pour les capteurs de niveau.

Chaque scénario prend l'état actuel et retourne la prochaine valeur.
Tous les scénarios sont déterministes (ou pseudo-aléatoires reproductibles).
"""
import math
import random


# ==================================================================
# Scénarios pour capteurs de NIVEAU
# ==================================================================
def scenario_remplissage(valeur, hauteur_max, compteur):
    """Le niveau monte de 1.5 cm à chaque mesure."""
    return valeur + 1.5


def scenario_vidange(valeur, hauteur_max, compteur):
    """Le niveau descend de 1.5 cm à chaque mesure."""
    return valeur - 1.5


def scenario_oscillation(valeur, hauteur_max, compteur):
    """Le niveau oscille en sinusoïde autour de 50% (période ~20 mesures)."""
    amplitude = hauteur_max * 0.3
    centre = hauteur_max * 0.5
    return centre + amplitude * math.sin(compteur * 0.3)


def scenario_fuite(valeur, hauteur_max, compteur):
    """
    Vidange anormalement rapide (fuite) après 10 mesures normales.
    Simule une fuite soudaine.
    """
    if compteur < 10:
        return valeur - 0.5
    # Fuite : -4 cm par mesure
    return valeur - 4.0


def scenario_debordement(valeur, hauteur_max, compteur):
    """Remplissage rapide jusqu'au débordement."""
    return valeur + 5.0


def scenario_normal(valeur, hauteur_max, compteur):
    """Oscillation douce autour de 50% avec petit bruit."""
    centre = hauteur_max * 0.5
    bruit = random.gauss(0, hauteur_max * 0.02)
    return valeur * 0.9 + (centre + bruit) * 0.1


# ==================================================================
# Table de routage
# ==================================================================
SCENARIOS_DISPONIBLES = {
    "remplissage": scenario_remplissage,
    "vidange": scenario_vidange,
    "oscillation": scenario_oscillation,
    "fuite": scenario_fuite,
    "debordement": scenario_debordement,
    "normal": scenario_normal,
}


def evoluer(scenario: str, valeur_actuelle: float, hauteur_max: float, compteur: int) -> float:
    """
    Point d'entrée unique.

    Lève ValueError si le scénario est inconnu.
    """
    if scenario not in SCENARIOS_DISPONIBLES:
        raise ValueError(
            f"Scénario inconnu : '{scenario}'. "
            f"Disponibles : {list(SCENARIOS_DISPONIBLES.keys())}"
        )
    return SCENARIOS_DISPONIBLES[scenario](valeur_actuelle, hauteur_max, compteur)
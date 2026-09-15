"""
Couche service pour l'application reservoirs.

Contient :
  - les opérations CRUD (créer / mettre à jour / supprimer)
  - les helpers métier réutilisables par capteurs et alertes
    (conversion hauteur → litres, calcul d'état de niveau, etc.)
"""
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Reservoir


# ==================================================================
# Validations métier
# ==================================================================
def valider_seuils(critique_bas, alerte_bas, alerte_haut, critique_haut):
    """
    Vérifie que les seuils sont dans [0, 100] et strictement croissants :
        0 ≤ critique_bas < alerte_bas < alerte_haut < critique_haut ≤ 100
    """
    seuils = [critique_bas, alerte_bas, alerte_haut, critique_haut]
    if any(s < 0 or s > 100 for s in seuils):
        raise ValidationError(
            {"seuils": "Les seuils doivent être compris entre 0 et 100."}
        )
    if not (critique_bas < alerte_bas < alerte_haut < critique_haut):
        raise ValidationError(
            {
                "seuils": (
                    "Les seuils doivent respecter : "
                    "critique_bas < alerte_bas < alerte_haut < critique_haut."
                )
            }
        )


def _valider_dimensions(capacite_max_litres, hauteur_max_cm):
    if capacite_max_litres <= 0:
        raise ValidationError(
            {"capacite_max_litres": "La capacité doit être strictement positive."}
        )
    if hauteur_max_cm <= 0:
        raise ValidationError(
            {"hauteur_max_cm": "La hauteur maximale doit être strictement positive."}
        )


# ==================================================================
# CRUD
# ==================================================================
@transaction.atomic
def creer_reservoir(*, nom, code, capacite_max_litres, hauteur_max_cm, **extra):
    """Crée un réservoir après validation métier."""
    if Reservoir.objects.filter(code=code).exists():
        raise ValidationError({"code": "Ce code est déjà utilisé."})
    if Reservoir.objects.filter(nom=nom).exists():
        raise ValidationError({"nom": "Ce nom est déjà utilisé."})

    _valider_dimensions(capacite_max_litres, hauteur_max_cm)
    valider_seuils(
        extra.get("seuil_critique_bas", 10.0),
        extra.get("seuil_alerte_bas", 25.0),
        extra.get("seuil_alerte_haut", 90.0),
        extra.get("seuil_critique_haut", 95.0),
    )

    return Reservoir.objects.create(
        nom=nom,
        code=code,
        capacite_max_litres=capacite_max_litres,
        hauteur_max_cm=hauteur_max_cm,
        **extra,
    )


@transaction.atomic
def mettre_a_jour_reservoir(reservoir, **data):
    """Met à jour partiellement un réservoir et revalide les seuils."""
    # Empêcher le changement de code (identifiant technique stable)
    if "code" in data and data["code"] != reservoir.code:
        raise ValidationError({"code": "Le code d'un réservoir ne peut pas être modifié."})

    # Revalider les seuils si l'un d'eux est modifié
    seuils_effectifs = {
        "seuil_critique_bas": data.get("seuil_critique_bas", reservoir.seuil_critique_bas),
        "seuil_alerte_bas": data.get("seuil_alerte_bas", reservoir.seuil_alerte_bas),
        "seuil_alerte_haut": data.get("seuil_alerte_haut", reservoir.seuil_alerte_haut),
        "seuil_critique_haut": data.get("seuil_critique_haut", reservoir.seuil_critique_haut),
    }
    if any(k in data for k in seuils_effectifs):
        valider_seuils(**seuils_effectifs)

    # Revalider les dimensions si modifiées
    if "capacite_max_litres" in data or "hauteur_max_cm" in data:
        _valider_dimensions(
            data.get("capacite_max_litres", reservoir.capacite_max_litres),
            data.get("hauteur_max_cm", reservoir.hauteur_max_cm),
        )

    for cle, valeur in data.items():
        setattr(reservoir, cle, valeur)
    reservoir.save()
    return reservoir


@transaction.atomic
def supprimer_reservoir(reservoir):
    """
    Supprime un réservoir.
    (À étendre plus tard : refuser si des capteurs y sont rattachés.)
    """
    # if reservoir.capteurs.exists():
    #     raise ValidationError(
    #         {"detail": "Impossible de supprimer un réservoir ayant des capteurs rattachés."}
    #     )
    reservoir.delete()


# ==================================================================
# Helpers métier (utilisés par capteurs, alertes, temps_reel)
# ==================================================================
def calculer_volume_litres(reservoir, hauteur_cm: float) -> float:
    """Convertit une hauteur d'eau (cm) en litres selon la géométrie simplifiée."""
    if hauteur_cm <= 0:
        return 0.0
    hauteur = min(hauteur_cm, reservoir.hauteur_max_cm)
    ratio = hauteur / reservoir.hauteur_max_cm
    return round(ratio * reservoir.capacite_max_litres, 2)


def calculer_pourcentage_remplissage(reservoir, hauteur_cm: float) -> float:
    """Retourne le % de remplissage (0-100) à partir d'une hauteur en cm."""
    if hauteur_cm <= 0:
        return 0.0
    if hauteur_cm >= reservoir.hauteur_max_cm:
        return 100.0
    return round((hauteur_cm / reservoir.hauteur_max_cm) * 100, 2)


def determiner_etat_niveau(reservoir, pourcentage: float) -> str:
    """
    Retourne l'état qualitatif du niveau selon les seuils du réservoir.

    Valeurs possibles :
        'debordement' | 'haut' | 'normal' | 'bas' | 'critique'
    """
    if pourcentage >= reservoir.seuil_critique_haut:
        return "debordement"
    if pourcentage >= reservoir.seuil_alerte_haut:
        return "haut"
    if pourcentage <= reservoir.seuil_critique_bas:
        return "critique"
    if pourcentage <= reservoir.seuil_alerte_bas:
        return "bas"
    return "normal"
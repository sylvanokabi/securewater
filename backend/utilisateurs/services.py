from django.db import transaction
from rest_framework.exceptions import ValidationError
from .models import Utilisateur


@transaction.atomic
def desactiver_utilisateur(utilisateur):
    """
    Désactive complètement le compte utilisateur.
    """

    utilisateur.actif = False
    utilisateur.is_active = False

    utilisateur.save(
        update_fields=[
            "actif",
            "is_active",
            "date_modification",
        ]
    )

    return utilisateur


@transaction.atomic
def activer_utilisateur(utilisateur):
    """
    Active complètement le compte utilisateur.
    """

    utilisateur.actif = True
    utilisateur.is_active = True

    utilisateur.save(
        update_fields=[
            "actif",
            "is_active",
            "date_modification",
        ]
    )

    return utilisateur


def mettre_a_jour_derniere_connexion(utilisateur):
    """
    Enregistre la date de dernière connexion.
    """

    from django.utils import timezone

    utilisateur.derniere_connexion = timezone.now()

    utilisateur.save(
        update_fields=["derniere_connexion"]
    )

    return utilisateur

@transaction.atomic
def supprimer_utilisateur(utilisateur: Utilisateur, demandeur: Utilisateur) -> None:
    """Empêche un admin de se supprimer lui-même."""
    if utilisateur.id == demandeur.id:
        raise ValidationError("Vous ne pouvez pas supprimer votre propre compte.")
    utilisateur.delete()
"""
Signaux de l'application alertes.

Le signal post_save sur Mesure déclenche l'analyse automatique des seuils.
Cela évite tout couplage entre capteurs et alertes : capteurs ignore
totalement l'existence de l'app alertes.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from capteurs.models import Mesure

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Mesure, dispatch_uid="alertes.analyser_mesure")
def analyser_mesure_signal(sender, instance, created, **kwargs):
    if not created:
        return
    # Import local pour éviter les imports circulaires au démarrage
    from .services import analyser_mesure

    try:
        analyser_mesure(instance)
    except Exception:  # pragma: no cover
        # On ne veut jamais qu'une erreur d'alerte casse l'enregistrement d'une mesure
        logger.exception("Erreur lors de l'analyse d'une mesure pour les alertes")
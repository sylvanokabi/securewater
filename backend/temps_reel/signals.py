"""
Signaux de diffusion temps réel.

Écoute les créations/modifications :
  - Mesure créée     → diffuse dans le groupe du réservoir
  - Alerte créée     → diffuse dans le groupe du réservoir
  - Capteur modifié  → diffuse un changement d'état (en_ligne, etat_connexion)
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from alertes.models import Alerte
from capteurs.models import Capteur, Mesure

logger = logging.getLogger(__name__)


def _diffuser(groupe: str, type_message: str, payload: dict):
    """
    Envoie un message dans un groupe Channels.

    Diffuse AUSSI dans le groupe global "telemetrie" pour les clients
    qui écoutent /ws/telemetrie/ (dashboard global).

    `type_message` doit correspondre à une méthode du consumer :
        "mesure.nouvelle"  → consumer.mesure_nouvelle()
        "alerte.nouvelle"  → consumer.alerte_nouvelle()
        "capteur.etat"     → consumer.capteur_etat()
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("Pas de channel_layer configuré — diffusion ignorée")
        return

    cibles = {groupe, "telemetrie"}   # groupe spécifique + global

    for cible in cibles:
        try:
            async_to_sync(channel_layer.group_send)(
                cible,
                {"type": type_message, **payload},
            )
        except Exception:
            logger.exception("Erreur de diffusion dans le groupe %s", cible)
# ==================================================================
# Mesure créée → diffuse
# ==================================================================
@receiver(post_save, sender=Mesure, dispatch_uid="temps_reel.mesure_nouvelle")
def diffuser_mesure(sender, instance, created, **kwargs):
    if not created:
        return

    capteur = instance.capteur
    reservoir = capteur.reservoir

    _diffuser(
        groupe=f"reservoir_{reservoir.code}",
        type_message="mesure.nouvelle",
        payload={
            "capteur": capteur.code,
            "capteur_nom": capteur.nom,
            "reservoir": reservoir.code,
            "valeur": instance.valeur,
            "unite": instance.unite,
            "volume_litres": instance.volume_litres,
            "pourcentage_remplissage": instance.pourcentage_remplissage,
            "etat_niveau": instance.etat_niveau,
            "horodatage": instance.horodatage.isoformat(),
        },
    )


# ==================================================================
# Alerte créée → diffuse
# ==================================================================
@receiver(post_save, sender=Alerte, dispatch_uid="temps_reel.alerte_nouvelle")
def diffuser_alerte(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.reservoir_id:
        return   # alerte orpheline → pas de groupe cible

    _diffuser(
        groupe=f"reservoir_{instance.reservoir.code}",
        type_message="alerte.nouvelle",
        payload={
            "alerte_id": instance.id,
            "gravite": instance.gravite,
            "type_alerte": instance.type,
            "message": instance.message,
            "capteur": instance.capteur.code if instance.capteur else None,
            "valeur_mesure": instance.valeur_mesure,
            "date_declenchement": instance.date_declenchement.isoformat(),
        },
    )


# ==================================================================
# Capteur modifié → diffuse un changement d'état
# ==================================================================
@receiver(post_save, sender=Capteur, dispatch_uid="temps_reel.capteur_etat")
def diffuser_capteur_etat(sender, instance, created, **kwargs):
    # À la création, pas de client abonné → inutile
    if created:
        return

    _diffuser(
        groupe=f"reservoir_{instance.reservoir.code}",
        type_message="capteur.etat",
        payload={
            "capteur": instance.code,
            "en_ligne": instance.en_ligne,
            "etat_connexion": instance.etat_connexion,
        },
    )
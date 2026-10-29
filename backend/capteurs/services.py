"""
Couche service pour l'application capteurs.
"""
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from reservoirs.services import (
    calculer_pourcentage_remplissage,
    calculer_volume_litres,
    determiner_etat_niveau,
)

from .models import Capteur, Mesure

# ==================================================================
# Validations
# ==================================================================
def _generer_topic_mqtt(reservoir, code_capteur: str) -> str:
    return f"securewater/reservoirs/{reservoir.code}/capteurs/{code_capteur}"


def _valider_valeur_mesure(capteur, valeur: float):
    if capteur.type == Capteur.Type.NIVEAU:
        if valeur < 0:
            raise ValidationError({"valeur": "Une hauteur d'eau ne peut pas être négative."})
        if valeur > capteur.reservoir.hauteur_max_cm:
            raise ValidationError(
                {"valeur": "La hauteur dépasse la hauteur maximale du réservoir."}
            )
    elif capteur.type == Capteur.Type.DEBIT:
        if valeur < 0:
            raise ValidationError({"valeur": "Un débit ne peut pas être négatif."})


# ==================================================================
# CRUD capteur
# ==================================================================
@transaction.atomic
def creer_capteur(
    *,
    nom,
    code,
    type,
    reservoir,
    topic_mqtt="",
    unite="",
    adresse_ip=None,
    firmware_version="",
    certificat_fingerprint="",
    metadata=None,
    **extra,
):
    """Crée un capteur après validation métier."""
    if Capteur.objects.filter(code=code).exists():
        raise ValidationError({"code": "Ce code est déjà utilisé."})
    if Capteur.objects.filter(nom=nom).exists():
        raise ValidationError({"nom": "Ce nom est déjà utilisé."})
    if type not in Capteur.Type.values:
        raise ValidationError({"type": f"Type invalide. Valeurs : {Capteur.Type.values}."})

    if not topic_mqtt:
        topic_mqtt = _generer_topic_mqtt(reservoir, code)
    if Capteur.objects.filter(topic_mqtt=topic_mqtt).exists():
        raise ValidationError({"topic_mqtt": "Ce topic MQTT est déjà utilisé."})

    if not unite:
        unite = Capteur.UNITE_PAR_TYPE.get(type, "")

    return Capteur.objects.create(
        nom=nom,
        code=code,
        type=type,
        reservoir=reservoir,
        topic_mqtt=topic_mqtt,
        unite=unite,
        adresse_ip=adresse_ip,
        firmware_version=firmware_version,
        certificat_fingerprint=certificat_fingerprint,
        metadata=metadata or {},
        **extra,
    )


@transaction.atomic
def mettre_a_jour_capteur(capteur, **data):
    """Mise à jour partielle avec garde-fous."""
    if "code" in data and data["code"] != capteur.code:
        raise ValidationError({"code": "Le code d'un capteur ne peut pas être modifié."})
    if "type" in data and data["type"] != capteur.type:
        raise ValidationError({"type": "Le type d'un capteur ne peut pas être modifié."})

    if "reservoir" in data and data["reservoir"] != capteur.reservoir:
        if "topic_mqtt" not in data:
            data["topic_mqtt"] = _generer_topic_mqtt(data["reservoir"], capteur.code)

    for cle, valeur in data.items():
        setattr(capteur, cle, valeur)
    capteur.save()
    return capteur


@transaction.atomic
def supprimer_capteur(capteur):
    """Supprime un capteur et, par cascade, toutes ses mesures."""
    capteur.delete()


# ==================================================================
# Cycle de vie IoT
# ==================================================================
@transaction.atomic
def marquer_authentification(capteur, *, adresse_ip=None, certificat_fingerprint=None):
    capteur.derniere_authentification = timezone.now()
    if adresse_ip:
        capteur.adresse_ip = adresse_ip
    if certificat_fingerprint:
        capteur.certificat_fingerprint = certificat_fingerprint
    capteur.save(update_fields=[
        "derniere_authentification",
        "adresse_ip",
        "certificat_fingerprint",
        "date_modification",
    ])
    return capteur


@transaction.atomic
def marquer_connexion(capteur, *, adresse_ip=None, firmware_version=None):
    capteur.derniere_connexion = timezone.now()
    capteur.en_ligne = True
    capteur.etat_connexion = Capteur.EtatConnexion.EN_LIGNE
    capteur.derniere_erreur = ""

    update_fields = [
        "derniere_connexion",
        "en_ligne",
        "etat_connexion",
        "derniere_erreur",
        "date_modification",
    ]

    if adresse_ip:
        capteur.adresse_ip = adresse_ip
        update_fields.append("adresse_ip")
    if firmware_version:
        capteur.firmware_version = firmware_version
        update_fields.append("firmware_version")

    capteur.save(update_fields=update_fields)
    return capteur


@transaction.atomic
def marquer_deconnexion(capteur, *, raison=""):
    capteur.en_ligne = False
    capteur.etat_connexion = Capteur.EtatConnexion.HORS_LIGNE
    if raison:
        capteur.derniere_erreur = raison
    capteur.save(update_fields=[
        "en_ligne",
        "etat_connexion",
        "derniere_erreur",
        "date_modification",
    ])
    return capteur


@transaction.atomic
def marquer_erreur(capteur, *, message: str):
    capteur.en_ligne = False
    capteur.etat_connexion = Capteur.EtatConnexion.EN_ERREUR
    capteur.derniere_erreur = message
    capteur.save(update_fields=[
        "en_ligne",
        "etat_connexion",
        "derniere_erreur",
        "date_modification",
    ])
    return capteur


@transaction.atomic
def traiter_heartbeat(capteur, *, adresse_ip=None):
    capteur.derniere_connexion = timezone.now()
    capteur.en_ligne = True
    capteur.etat_connexion = Capteur.EtatConnexion.EN_LIGNE

    update_fields = [
        "derniere_connexion",
        "en_ligne",
        "etat_connexion",
        "date_modification",
    ]
    if adresse_ip:
        capteur.adresse_ip = adresse_ip
        update_fields.append("adresse_ip")

    capteur.save(update_fields=update_fields)
    return capteur


def rafraichir_etats_connexion():
    maintenant = timezone.now()
    seuil = maintenant - timezone.timedelta(
        seconds=Capteur.DELAI_HORS_LIGNE_SECONDES
    )

    silencieux = Capteur.objects.filter(
        en_ligne=True,
    ).filter(
        derniere_mesure__lt=seuil,
    ) | Capteur.objects.filter(
        en_ligne=True, derniere_mesure__isnull=True
    )

    mis_a_jour = silencieux.update(
        en_ligne=False,
        etat_connexion=Capteur.EtatConnexion.HORS_LIGNE,
        date_modification=maintenant,
    )
    return mis_a_jour


# ==================================================================
# Enregistrement d'une mesure
# ==================================================================
@transaction.atomic
def enregistrer_mesure(*, capteur, valeur: float, horodatage=None, payload_brut=None):
    if horodatage is None:
        horodatage = timezone.now()

    _valider_valeur_mesure(capteur, valeur)

    volume_litres = None
    pourcentage = None
    etat = None

    if capteur.type == Capteur.Type.NIVEAU:
        volume_litres = calculer_volume_litres(capteur.reservoir, valeur)
        pourcentage = calculer_pourcentage_remplissage(capteur.reservoir, valeur)
        etat = determiner_etat_niveau(capteur.reservoir, pourcentage)

    mesure = Mesure.objects.create(
        capteur=capteur,
        valeur=valeur,
        unite=capteur.unite,
        volume_litres=volume_litres,
        pourcentage_remplissage=pourcentage,
        etat_niveau=etat,
        horodatage=horodatage,
        payload_brut=payload_brut,
    )

    # Mise à jour atomique côté capteur (compteur + états)
    Capteur.objects.filter(pk=capteur.pk).update(
        derniere_mesure=timezone.now(),
        en_ligne=True,
        etat_connexion=Capteur.EtatConnexion.EN_LIGNE,
        nombre_mesures=F("nombre_mesures") + 1,
        date_modification=timezone.now(),
    )
    # 👇 SUPPRESSION DE capteur.refresh_from_db() QUI CAUSAIT LE CRASH

    # Met à jour le niveau actuel du réservoir (pour l'affichage initial)
    if capteur.type == Capteur.Type.NIVEAU and pourcentage is not None:
        reservoir = capteur.reservoir
        reservoir.niveau_actuel_pct = pourcentage
        reservoir.save(update_fields=["niveau_actuel_pct"])

    return mesure


# ==================================================================
# Lecture
# ==================================================================
def recuperer_derniere_mesure(capteur):
    return capteur.mesures.order_by("-horodatage").first()


def calculer_etat_connexion_courant(capteur) -> dict:
    capteur.refresh_from_db()
    etat = capteur.calculer_etat_connexion()
    if etat != capteur.etat_connexion:
        Capteur.objects.filter(pk=capteur.pk).update(etat_connexion=etat)
        capteur.etat_connexion = etat

    return {
        "etat": etat,
        "en_ligne": capteur.en_ligne,
        "derniere_authentification": capteur.derniere_authentification,
        "derniere_connexion": capteur.derniere_connexion,
        "derniere_mesure": capteur.derniere_mesure,
        "secondes_depuis_derniere_mesure": capteur.secondes_depuis_derniere_mesure,
        "est_silencieux": capteur.est_silencieux,
        "nombre_mesures": capteur.nombre_mesures,
        "derniere_erreur": capteur.derniere_erreur,
    }
"""
Couche service pour l'application capteurs.

Contient :
  - CRUD capteur avec validations métier
  - gestion du cycle de vie IoT (auth, connexion, heartbeat, déconnexion)
  - enregistrement de mesure (point d'entrée MQTT et HTTP)
  - helpers de lecture (dernière mesure, état de connexion)
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
    """
    Appelée quand le broker MQTT confirme une authentification TLS réussie.
    Ne marque PAS le capteur en ligne à elle seule : voir `marquer_connexion`.
    """
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
    """
    Appelée quand une connexion MQTT est établie (CONNACK reçu).
    Passe le capteur en ligne.
    """
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
    """Appelée quand le broker détecte une déconnexion (LWT ou DISCONNECT)."""
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
    """Enregistre une erreur remontée par le client MQTT."""
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
    """
    Enregistre un heartbeat (le capteur est vivant sans nouvelle mesure).
    Met à jour `derniere_connexion` et repasse l'état en ligne.
    """
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
    """
    Parcourt les capteurs et met à jour `etat_connexion` selon les délais.
    Utile pour un cron / management command / Celery beat.

    Retourne le nombre de capteurs modifiés.
    """
    maintenant = timezone.now()
    seuil = maintenant - timezone.timedelta(
        seconds=Capteur.DELAI_HORS_LIGNE_SECONDES
    )

    # Capteurs en ligne mais silencieux depuis trop longtemps
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
    """
    Enregistre une mesure et met à jour l'état du capteur.

    Effets de bord :
      - calcule les champs dérivés (niveau uniquement)
      - met à jour `derniere_mesure`, `nombre_mesures`, `en_ligne`
      - repasse `etat_connexion` à EN_LIGNE
    """
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
    capteur.refresh_from_db()

    return mesure


# ==================================================================
# Lecture
# ==================================================================
def recuperer_derniere_mesure(capteur):
    """Retourne la mesure la plus récente du capteur, ou None."""
    return capteur.mesures.order_by("-horodatage").first()


def calculer_etat_connexion_courant(capteur) -> dict:
    """
    Retourne un dict prêt à sérialiser pour les endpoints d'état :
        {
            "etat": "en_ligne",
            "en_ligne": true,
            "derniere_mesure": "...",
            "secondes_depuis_derniere_mesure": 12.3,
            "est_silencieux": false,
        }
    """
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
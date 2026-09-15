"""
Couche service pour l'application alertes.

Trois responsabilités :
  1. Déclencher / résoudre des alertes de manière idempotente.
  2. Analyser une mesure pour détecter un franchissement de seuil.
  3. Scanner l'ensemble des capteurs pour détecter les anomalies
     d'état (silencieux, hors ligne, en erreur).
"""
import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from capteurs.models import Capteur, Mesure

from .models import Alerte

logger = logging.getLogger(__name__)


# ==================================================================
# Mapping état → type d'alerte (niveau)
# ==================================================================
# Chaque état de niveau correspond à un type d'alerte (ou None si normal).
ETAT_VERS_TYPE_ALERTE = {
    "critique": Alerte.Type.NIVEAU_CRITIQUE_BAS,
    "bas": Alerte.Type.NIVEAU_BAS,
    "haut": Alerte.Type.NIVEAU_HAUT,
    "debordement": Alerte.Type.DEBORDEMENT,
}

# Gravité associée à chaque type
GRAVITE_PAR_TYPE = {
    Alerte.Type.NIVEAU_CRITIQUE_BAS: Alerte.Gravite.CRITIQUE,
    Alerte.Type.NIVEAU_BAS: Alerte.Gravite.AVERTISSEMENT,
    Alerte.Type.NIVEAU_HAUT: Alerte.Gravite.AVERTISSEMENT,
    Alerte.Type.DEBORDEMENT: Alerte.Gravite.CRITIQUE,
    Alerte.Type.CAPTEUR_HORS_LIGNE: Alerte.Gravite.AVERTISSEMENT,
    Alerte.Type.CAPTEUR_SILENCIEUX: Alerte.Gravite.AVERTISSEMENT,
    Alerte.Type.ERREUR_CAPTEUR: Alerte.Gravite.CRITIQUE,
    Alerte.Type.MANUELLE: Alerte.Gravite.AVERTISSEMENT,
}


# ==================================================================
# Déclenchement / résolution
# ==================================================================
@transaction.atomic
def declencher_alerte(
    *,
    type,
    message,
    capteur=None,
    reservoir=None,
    mesure_declencheuse=None,
    valeur_mesure=None,
    seuil_franchi=None,
    gravite=None,
):
    """
    Crée une alerte si aucune alerte ACTIVE du même (capteur, type)
    n'existe déjà. Sinon, retourne l'alerte existante sans la dupliquer.
    """
    if capteur is None and reservoir is None:
        raise ValidationError(
            {"detail": "Une alerte doit référencer au moins un capteur ou un réservoir."}
        )

    if gravite is None:
        gravite = GRAVITE_PAR_TYPE.get(type, Alerte.Gravite.AVERTISSEMENT)

    # Idempotence : on cherche une alerte ACTIVE identique
    existing = Alerte.objects.filter(
        capteur=capteur,
        type=type,
        statut=Alerte.Statut.ACTIVE,
    ).first()

    if existing:
        # Mise à jour légère du message si la valeur change
        existing.message = message
        existing.valeur_mesure = valeur_mesure
        existing.seuil_franchi = seuil_franchi
        if mesure_declencheuse is not None:
            existing.mesure_declencheuse = mesure_declencheuse
        existing.save(update_fields=[
            "message", "valeur_mesure", "seuil_franchi", "mesure_declencheuse"
        ])
        return existing

    return Alerte.objects.create(
        type=type,
        gravite=gravite,
        statut=Alerte.Statut.ACTIVE,
        message=message,
        capteur=capteur,
        reservoir=reservoir or (capteur.reservoir if capteur else None),
        mesure_declencheuse=mesure_declencheuse,
        valeur_mesure=valeur_mesure,
        seuil_franchi=seuil_franchi,
    )


@transaction.atomic
def resoudre_alerte(alerte, utilisateur=None, auto=False):
    """Marque une alerte comme résolue."""
    if alerte.statut == Alerte.Statut.RESOLUE:
        return alerte
    alerte.marquer_resolue(utilisateur=utilisateur, auto=auto)
    return alerte


@transaction.atomic
def acquitter_alerte(alerte, utilisateur):
    """Marque une alerte comme acquittée (reconnaissance humaine)."""
    if alerte.statut == Alerte.Statut.RESOLUE:
        raise ValidationError(
            {"detail": "Impossible d'acquitter une alerte déjà résolue."}
        )
    alerte.marquer_acquittee(utilisateur=utilisateur)
    return alerte


def resoudre_alertes_par_type(capteur, types, utilisateur=None, auto=True):
    """
    Résout toutes les alertes ACTIVES d'un capteur pour les types donnés.
    Retourne le nombre d'alertes résolues.
    """
    qs = Alerte.objects.filter(
        capteur=capteur,
        type__in=types,
        statut=Alerte.Statut.ACTIVE,
    )
    n = 0
    for alerte in qs:
        alerte.marquer_resolue(utilisateur=utilisateur, auto=auto)
        n += 1
    return n


# ==================================================================
# Analyse d'une mesure
# ==================================================================
def _message_niveau(etat, capteur, pourcentage, seuil):
    label = {
        "critique": "Niveau critique bas",
        "bas": "Niveau bas",
        "haut": "Niveau haut",
        "debordement": "Débordement",
    }.get(etat, etat)
    return (
        f"{label} sur le capteur '{capteur.nom}' ({capteur.code}) : "
        f"{pourcentage:.1f}% (seuil {seuil:.1f}%)."
    )


def _seuil_pour_etat(capteur, etat):
    r = capteur.reservoir
    return {
        "critique": r.seuil_critique_bas,
        "bas": r.seuil_alerte_bas,
        "haut": r.seuil_alerte_haut,
        "debordement": r.seuil_critique_haut,
    }.get(etat)


@transaction.atomic
def analyser_mesure(mesure: Mesure):
    """
    Analyse une mesure et met à jour les alertes de niveau associées.

    Comportement :
      - Si le niveau est normal → résout toutes les alertes de niveau actives.
      - Sinon → résout les alertes des autres états, déclenche celle de l'état courant.

    Les alertes d'état (hors ligne, erreur) sont résolues dès qu'une
    mesure fraîche arrive : le capteur est manifestement vivant.
    """
    capteur = mesure.capteur

    # Résolution des alertes d'état (le capteur vient de parler)
    resoudre_alertes_par_type(
        capteur,
        [Alerte.Type.CAPTEUR_HORS_LIGNE, Alerte.Type.CAPTEUR_SILENCIEUX],
        auto=True,
    )

    # Si c'est un capteur de débit, pas d'analyse de seuil pour l'instant
    if capteur.type != Capteur.Type.NIVEAU:
        return

    etat = mesure.etat_niveau
    pourcentage = mesure.pourcentage_remplissage
    if etat is None or pourcentage is None:
        return

    if etat == "normal":
        resoudre_alertes_par_type(
            capteur,
            list(ETAT_VERS_TYPE_ALERTE.values()),
            auto=True,
        )
        return

    type_attendu = ETAT_VERS_TYPE_ALERTE.get(etat)
    if type_attendu is None:
        return

    # Résoudre les autres types de niveau (changement d'état)
    autres_types = [
        t for t in ETAT_VERS_TYPE_ALERTE.values() if t != type_attendu
    ]
    resoudre_alertes_par_type(capteur, autres_types, auto=True)

    # Déclencher (ou mettre à jour) l'alerte attendue
    seuil = _seuil_pour_etat(capteur, etat)
    declencher_alerte(
        type=type_attendu,
        message=_message_niveau(etat, capteur, pourcentage, seuil or 0),
        capteur=capteur,
        mesure_declencheuse=mesure,
        valeur_mesure=pourcentage,
        seuil_franchi=seuil,
    )


# ==================================================================
# Détection d'anomalies d'état capteur
# ==================================================================
@transaction.atomic
def signaler_capteur_hors_ligne(capteur, *, raison="Aucune donnée reçue"):
    """Crée une alerte capteur hors ligne (idempotent)."""
    return declencher_alerte(
        type=Alerte.Type.CAPTEUR_HORS_LIGNE,
        message=f"Capteur '{capteur.nom}' ({capteur.code}) hors ligne. {raison}",
        capteur=capteur,
    )


@transaction.atomic
def signaler_erreur_capteur(capteur, *, message_erreur):
    """Crée une alerte d'erreur capteur."""
    return declencher_alerte(
        type=Alerte.Type.ERREUR_CAPTEUR,
        message=(
            f"Erreur sur le capteur '{capteur.nom}' ({capteur.code}) : "
            f"{message_erreur}"
        ),
        capteur=capteur,
    )


@transaction.atomic
def resoudre_alertes_capteur(capteur):
    """Résout toutes les alertes d'état actives d'un capteur (reconnexion réussie)."""
    return resoudre_alertes_par_type(
        capteur,
        [
            Alerte.Type.CAPTEUR_HORS_LIGNE,
            Alerte.Type.CAPTEUR_SILENCIEUX,
            Alerte.Type.ERREUR_CAPTEUR,
        ],
        auto=True,
    )


def detecter_anomalies_capteurs():
    """
    Parcourt tous les capteurs actifs et crée les alertes d'état nécessaires.

    À appeler périodiquement (cron, Celery beat, management command).
    Retourne un dict de statistiques.
    """
    seuil = timezone.now() - timezone.timedelta(
        seconds=Capteur.DELAI_HORS_LIGNE_SECONDES
    )

    stats = {"hors_ligne": 0, "erreur": 0, "total_analyses": 0}

    capteurs_actifs = Capteur.objects.filter(
        statut=Capteur.Statut.ACTIF
    ).select_related("reservoir")

    for capteur in capteurs_actifs:
        stats["total_analyses"] += 1

        # Erreur signalée
        if capteur.etat_connexion == Capteur.EtatConnexion.EN_ERREUR:
            signaler_erreur_capteur(capteur, message_erreur=capteur.derniere_erreur or "—")
            stats["erreur"] += 1
            continue

        # Jamais connecté : on n'alerte pas (le capteur n'a jamais fonctionné)
        if capteur.derniere_connexion is None:
            continue

        # Silencieux depuis trop longtemps ?
        reference = capteur.derniere_mesure or capteur.derniere_connexion
        if reference < seuil:
            raison = (
                f"Dernière activité : {reference.isoformat()}"
                if reference else "Aucune activité enregistrée"
            )
            signaler_capteur_hors_ligne(capteur, raison=raison)
            stats["hors_ligne"] += 1

    return stats


# ==================================================================
# Lecture
# ==================================================================
def compter_alertes_actives(capteur=None):
    qs = Alerte.objects.filter(statut=Alerte.Statut.ACTIVE)
    if capteur is not None:
        qs = qs.filter(capteur=capteur)
    return qs.count()
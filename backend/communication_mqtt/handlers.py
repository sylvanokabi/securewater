"""
Routage des messages MQTT entrants.

Format attendu d'un topic :
    securewater/reservoirs/<code_reservoir>/capteurs/<code_capteur>/<canal>

Avec `<canal>` ∈ { "mesures", "heartbeat", "statut" }

Format du payload JSON :
    Mesures    : {"valeur": 42.5, "horodatage": "2025-01-15T10:00:00Z"}  (horodatage optionnel)
    Heartbeat  : {} ou {"adresse_ip": "10.0.0.5"}
    Statut     : {"en_ligne": true} ou {"en_ligne": false, "raison": "LWT"}

Cette couche est **pure** (pas de paho, pas de réseau) → facile à tester.
"""
import json
import logging
from dataclasses import dataclass

from django.utils import timezone

from capteurs import services as capteurs_services
from capteurs.models import Capteur

logger = logging.getLogger(__name__)


# ==================================================================
# Résultat de traitement
# ==================================================================
@dataclass
class ResultatTraitement:
    ok: bool
    canal: str
    capteur: Capteur | None
    message: str = ""


# ==================================================================
# Parsing du topic
# ==================================================================
def parser_topic(topic: str) -> tuple[str, str, str] | None:
    """
    Décompose un topic en (code_reservoir, code_capteur, canal).

    Retourne None si le topic ne correspond pas au format attendu.
    """
    parties = topic.split("/")
    # Format : securewater / reservoirs / <reservoir> / capteurs / <capteur> / <canal>
    if len(parties) != 6:
        return None
    racine, cle_reservoirs, code_reservoir, cle_capteurs, code_capteur, canal = parties
    if cle_reservoirs != "reservoirs" or cle_capteurs != "capteurs":
        return None
    if not code_reservoir or not code_capteur or not canal:
        return None
    return code_reservoir, code_capteur, canal


# ==================================================================
# Traitement par canal
# ==================================================================
def _traiter_mesure(capteur: Capteur, payload: dict) -> ResultatTraitement:
    valeur = payload.get("valeur")
    if valeur is None:
        return ResultatTraitement(
            ok=False, canal="mesures", capteur=capteur,
            message="Payload sans champ 'valeur'.",
        )

    # Horodatage : soit une chaîne ISO, soit absent (on prend now())
    horodatage_brut = payload.get("horodatage")
    if isinstance(horodatage_brut, str):
        try:
            from django.utils.dateparse import parse_datetime
            horodatage = parse_datetime(horodatage_brut) or timezone.now()
        except Exception:
            horodatage = timezone.now()
    else:
        horodatage = timezone.now()

    try:
        capteurs_services.enregistrer_mesure(
            capteur=capteur,
            valeur=float(valeur),
            horodatage=horodatage,
            payload_brut=payload,
        )
    except Exception as e:
        logger.exception("Échec enregistrement mesure pour %s", capteur.code)
        return ResultatTraitement(
            ok=False, canal="mesures", capteur=capteur,
            message=f"Erreur d'enregistrement : {e}",
        )

    return ResultatTraitement(ok=True, canal="mesures", capteur=capteur)


def _traiter_heartbeat(capteur: Capteur, payload: dict) -> ResultatTraitement:
    capteurs_services.traiter_heartbeat(
        capteur,
        adresse_ip=payload.get("adresse_ip"),
    )
    return ResultatTraitement(ok=True, canal="heartbeat", capteur=capteur)


def _traiter_statut(capteur: Capteur, payload: dict) -> ResultatTraitement:
    en_ligne = bool(payload.get("en_ligne", True))
    raison = payload.get("raison", "")

    if en_ligne:
        capteurs_services.marquer_connexion(capteur)
    else:
        capteurs_services.marquer_deconnexion(capteur, raison=raison)

    return ResultatTraitement(ok=True, canal="statut", capteur=capteur)


# ==================================================================
# Point d'entrée public
# ==================================================================
def traiter_message(topic: str, payload_bytes: bytes) -> ResultatTraitement:
    """
    Point d'entrée utilisé par le client MQTT (et testable isolément).

    Étapes :
      1. Parse le topic → (code_reservoir, code_capteur, canal)
      2. Résout le capteur en base (doit être actif)
      3. Décode le payload JSON
      4. Route vers le handler approprié
    """
    parsed = parser_topic(topic)
    if parsed is None:
        return ResultatTraitement(
            ok=False, canal="", capteur=None,
            message=f"Topic invalide : {topic}",
        )

    code_reservoir, code_capteur, canal = parsed

    capteur = (
        Capteur.objects
        .select_related("reservoir")
        .filter(code=code_capteur, reservoir__code=code_reservoir)
        .first()
    )
    if capteur is None:
        return ResultatTraitement(
            ok=False, canal=canal, capteur=None,
            message=f"Capteur inconnu ({code_reservoir}/{code_capteur}).",
        )

    if capteur.statut != Capteur.Statut.ACTIF:
        return ResultatTraitement(
            ok=False, canal=canal, capteur=capteur,
            message=f"Capteur non actif (statut={capteur.statut}).",
        )

    # Décodage JSON
    try:
        payload = json.loads(payload_bytes.decode("utf-8")) if payload_bytes else {}
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return ResultatTraitement(
            ok=False, canal=canal, capteur=capteur,
            message=f"Payload JSON invalide : {e}",
        )

    if not isinstance(payload, dict):
        return ResultatTraitement(
            ok=False, canal=canal, capteur=capteur,
            message="Payload JSON attendu (objet).",
        )

    # Routage selon le canal
    if canal == "mesures":
        return _traiter_mesure(capteur, payload)
    if canal == "heartbeat":
        return _traiter_heartbeat(capteur, payload)
    if canal == "statut":
        return _traiter_statut(capteur, payload)

    return ResultatTraitement(
        ok=False, canal=canal, capteur=capteur,
        message=f"Canal inconnu : {canal}",
    )
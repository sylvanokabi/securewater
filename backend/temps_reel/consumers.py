"""
Consumer WebSocket pour un réservoir.

Connexion :
    ws://host/ws/reservoirs/<code_reservoir>/?token=<JWT>

Reçoit en direct :
  - nouvelle mesure d'un capteur du réservoir
  - nouvelle alerte sur ce réservoir
  - changement d'état d'un capteur (en ligne / hors ligne)

Peut recevoir du client :
  - {"action": "ping"}                         → {"type": "pong"}
  - {"action": "derniere_mesure", "capteur_code": "..."}
  - autre                                       → {"type": "erreur"}
"""
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class ReservoirConsumer(AsyncJsonWebsocketConsumer):
    """
    Consumer attaché à un réservoir via son code.

    Groupe Channels :
        reservoir_<code_reservoir>
    """

    # ==================================================================
    # Cycle de vie
    # ==================================================================
    async def connect(self):
        self.code_reservoir = self.scope["url_route"]["kwargs"]["code_reservoir"]
        self.groupe = f"reservoir_{self.code_reservoir}"
        self.utilisateur = self.scope.get("user")

        # 1. Authentification obligatoire
        if not self.utilisateur or not self.utilisateur.is_authenticated:
            logger.warning("WS refusé : anonyme sur %s", self.groupe)
            await self.close(code=4401)
            return

        # 2. Réservoir doit exister
        if not await self._reservoir_existe(self.code_reservoir):
            logger.warning("WS refusé : réservoir inconnu '%s'", self.code_reservoir)
            await self.close(code=4404)
            return

        # 3. Rejoindre le groupe
        await self.channel_layer.group_add(self.groupe, self.channel_name)
        await self.accept()

        logger.info(
            "WS connecté : user=%s reservoir=%s (channel=%s)",
            self.utilisateur.username,
            self.code_reservoir,
            self.channel_name,
        )

        # 4. Message de bienvenue
        await self.send_json({
            "type": "bienvenue",
            "reservoir": self.code_reservoir,
            "message": "Connecté au flux temps réel",
        })

    async def disconnect(self, code):
        if hasattr(self, "groupe"):
            await self.channel_layer.group_discard(self.groupe, self.channel_name)
            logger.info(
                "WS déconnecté : reservoir=%s (code=%s)",
                self.code_reservoir, code,
            )

    # ==================================================================
    # Messages entrants (du client)
    # ==================================================================
    async def receive_json(self, content, **kwargs):
        action = content.get("action")

        if action == "ping":
            await self.send_json({"type": "pong"})
            return

        if action == "derniere_mesure":
            capteur_code = content.get("capteur_code")
            if not capteur_code:
                await self.send_json({
                    "type": "erreur",
                    "message": "capteur_code requis",
                })
                return

            mesure = await self._derniere_mesure(capteur_code)
            await self.send_json({
                "type": "derniere_mesure",
                "capteur_code": capteur_code,
                "mesure": mesure,
            })
            return

        await self.send_json({
            "type": "erreur",
            "message": f"Action inconnue : {action}",
        })

    # ==================================================================
    # Handlers de diffusion (appelés par group_send)
    # ==================================================================
    async def mesure_nouvelle(self, event):
        """Diffuse une mesure fraîche."""
        await self.send_json({
            "type": "mesure",
            "capteur": event["capteur"],
            "capteur_nom": event.get("capteur_nom"),
            "reservoir": event.get("reservoir"),
            "valeur": event["valeur"],
            "unite": event["unite"],
            "volume_litres": event.get("volume_litres"),
            "pourcentage_remplissage": event.get("pourcentage_remplissage"),
            "etat_niveau": event.get("etat_niveau"),
            "horodatage": event["horodatage"],
        })

    async def alerte_nouvelle(self, event):
        """Diffuse une alerte fraîche."""
        await self.send_json({
            "type": "alerte",
            "alerte_id": event["alerte_id"],
            "gravite": event["gravite"],
            "type_alerte": event["type_alerte"],
            "message": event["message"],
            "capteur": event.get("capteur"),
            "valeur_mesure": event.get("valeur_mesure"),
            "date_declenchement": event["date_declenchement"],
        })

    async def capteur_etat(self, event):
        """Diffuse un changement d'état d'un capteur."""
        await self.send_json({
            "type": "capteur_etat",
            "capteur": event["capteur"],
            "en_ligne": event["en_ligne"],
            "etat_connexion": event["etat_connexion"],
        })

    # ==================================================================
    # Accès base de données (async-safe)
    # ==================================================================
    @database_sync_to_async
    def _reservoir_existe(self, code: str) -> bool:
        from reservoirs.models import Reservoir
        return Reservoir.objects.filter(code=code).exists()

    @database_sync_to_async
    def _derniere_mesure(self, capteur_code: str):
        from capteurs.models import Capteur

        capteur = (
            Capteur.objects
            .filter(code=capteur_code, reservoir__code=self.code_reservoir)
            .first()
        )
        if not capteur:
            return None

        mesure = capteur.mesures.order_by("-horodatage").first()
        if not mesure:
            return None

        return {
            "valeur": mesure.valeur,
            "unite": mesure.unite,
            "volume_litres": mesure.volume_litres,
            "pourcentage_remplissage": mesure.pourcentage_remplissage,
            "etat_niveau": mesure.etat_niveau,
            "horodatage": mesure.horodatage.isoformat(),
        }



# ==================================================================
# Consumer TÉLÉMÉTRIE GLOBALE — /ws/telemetrie/
# ==================================================================

class TelemetrieConsumer(AsyncJsonWebsocketConsumer):
    """
    Consumer qui diffuse la télémétrie de TOUS les réservoirs.

    Connexion :
        ws://host/ws/telemetrie/?token=<JWT>

    Il rejoint le groupe global "telemetrie" auquel tous les signaux
    diffusent en parallèle des groupes par réservoir.

    Utile pour un dashboard "vue globale" (frontend).
    """

    GROUPE = "telemetrie"

    async def connect(self):
        self.utilisateur = self.scope.get("user")

        # Auth obligatoire
        if not self.utilisateur or not self.utilisateur.is_authenticated:
            logger.warning("WS refusé : anonyme sur %s", self.GROUPE)
            await self.close(code=4401)
            return

        await self.channel_layer.group_add(self.GROUPE, self.channel_name)
        await self.accept()

        logger.info(
            "WS télémetrie connecté : user=%s (channel=%s)",
            self.utilisateur.username, self.channel_name,
        )

        await self.send_json({
            "type": "bienvenue",
            "scope": "telemetrie",
            "message": "Connecté au flux temps réel global",
        })

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.GROUPE, self.channel_name)
        logger.info("WS télémetrie déconnecté (code=%s)", code)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        if action == "ping":
            await self.send_json({"type": "pong"})
            return
        await self.send_json({
            "type": "erreur",
            "message": f"Action inconnue : {action}",
        })

    # Handlers de diffusion (mêmes noms que ReservoirConsumer)
    async def mesure_nouvelle(self, event):
        await self.send_json({
            "type": "mesure",
            "capteur": event["capteur"],
            "capteur_nom": event.get("capteur_nom"),
            "reservoir": event.get("reservoir"),
            "valeur": event["valeur"],
            "unite": event["unite"],
            "volume_litres": event.get("volume_litres"),
            "pourcentage_remplissage": event.get("pourcentage_remplissage"),
            "etat_niveau": event.get("etat_niveau"),
            "horodatage": event["horodatage"],
        })

    async def alerte_nouvelle(self, event):
        await self.send_json({
            "type": "alerte",
            "alerte_id": event["alerte_id"],
            "gravite": event["gravite"],
            "type_alerte": event["type_alerte"],
            "message": event["message"],
            "capteur": event.get("capteur"),
            "valeur_mesure": event.get("valeur_mesure"),
            "date_declenchement": event["date_declenchement"],
        })

    async def capteur_etat(self, event):
        await self.send_json({
            "type": "capteur_etat",
            "capteur": event["capteur"],
            "en_ligne": event["en_ligne"],
            "etat_connexion": event["etat_connexion"],
        })
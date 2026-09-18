"""
Vue fictive qui documente le WebSocket dans Swagger UI.

Ce n'est PAS un vrai endpoint métier. Il sert uniquement à faire
apparaître le protocole WebSocket dans `/api/docs/`, sous le tag
"websocket".
"""
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


@extend_schema(
    summary="[INFO] WebSocket temps réel",
    description=(
        "**Ceci n'est pas un endpoint REST.**\n\n"
        "Cette entrée documente le **flux WebSocket** disponible en parallèle "
        "de l'API REST.\n\n"
        "### URL\n"
        "```\n"
        "ws://<host>/ws/reservoirs/<code_reservoir>/?token=<JWT>\n"
        "```\n\n"
        "### Authentification\n"
        "JWT en **query string** (`?token=...`) — les navigateurs ne permettent "
        "pas de header `Authorization` en WebSocket.\n\n"
        "- Token invalide → fermeture **4401**\n"
        "- Réservoir inconnu → fermeture **4404**\n\n"
        "### Messages reçus du serveur\n"
        "| `type` | Description |\n"
        "|---|---|\n"
        "| `bienvenue` | Envoyé à la connexion |\n"
        "| `mesure` | Nouvelle mesure d'un capteur |\n"
        "| `alerte` | Nouvelle alerte sur le réservoir |\n"
        "| `capteur_etat` | Changement d'état en ligne / hors ligne |\n"
        "| `pong` | Réponse à `{action: 'ping'}` |\n"
        "| `erreur` | Message d'erreur |\n\n"
        "### Messages envoyés par le client\n"
        "- `{\"action\": \"ping\"}` → `{\"type\": \"pong\"}`\n"
        "- `{\"action\": \"derniere_mesure\", \"capteur_code\": \"niveau-01\"}`\n\n"
        "### Documentation complète\n"
        "Voir `documentation/websocket.md`."
    ),
    tags=["websocket"],
    responses={
        200: OpenApiResponse(
            description="Métadonnées du protocole WebSocket",
        ),
    },
)
class WebSocketInfoView(APIView):
    """
    Vue fictive : retourne les métadonnées WebSocket.
    Appelable via GET pour vérification rapide.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "documentation": "/documentation/websocket.md",
            "url_pattern": "ws://<host>/ws/reservoirs/<code_reservoir>/?token=<JWT>",
            "auth": "JWT en query string (?token=<access_token>)",
            "close_codes": {
                "4401": "Authentification requise (token absent ou invalide)",
                "4404": "Réservoir introuvable",
            },
            "message_types_recus": [
                "bienvenue", "mesure", "alerte", "capteur_etat", "pong", "erreur",
            ],
            "actions_envoyables": [
                {"action": "ping"},
                {"action": "derniere_mesure", "capteur_code": "<code>"},
            ],
        })
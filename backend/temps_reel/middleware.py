"""
Middleware d'authentification JWT pour les connexions WebSocket.

Contrairement aux requêtes HTTP, les WebSocket ne peuvent PAS porter de
header Authorization personnalisé dans un navigateur. Le token est donc
passé en query string :

    ws://host/ws/reservoirs/<code>/?token=<JWT>

Ce middleware lit le token, le valide (avec SimpleJWT, la même clé que
l'API REST), et attache l'utilisateur à `scope["user"]`.
"""
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)

Utilisateur = get_user_model()


@database_sync_to_async
def _recuperer_utilisateur(user_id: int):
    """
    Charge l'utilisateur en base (async-safe).

    Retourne AnonymousUser si l'utilisateur n'existe pas ou est inactif.
    """
    try:
        return Utilisateur.objects.get(id=user_id, is_active=True)
    except Utilisateur.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware ASGI à insérer avant l'URLRouter des WebSocket.

    Usage dans asgi.py :
        JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))
    """

    async def __call__(self, scope, receive, send):
        # On ne touche qu'aux WebSocket
        if scope["type"] != "websocket":
            return await super().__call__(scope, receive, send)

        # Récupère le token depuis la query string
        query_string = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        token_list = params.get("token", [])
        token = token_list[0] if token_list else None

        # Par défaut : anonyme
        scope["user"] = AnonymousUser()

        if token:
            try:
                access = AccessToken(token)
                user_id = access["user_id"]
                scope["user"] = await _recuperer_utilisateur(user_id)
            except (InvalidToken, TokenError) as e:
                logger.warning("WebSocket : token invalide (%s)", e)
            except Exception:
                logger.exception("WebSocket : erreur d'authentification inattendue")

        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """
    Raccourci à utiliser dans asgi.py :

        application = ProtocolTypeRouter({
            "websocket": JWTAuthMiddlewareStack(URLRouter(...)),
        })
    """
    return JWTAuthMiddleware(inner)
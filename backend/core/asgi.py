"""
Point d'entrée ASGI : HTTP + WebSocket.
"""
import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# IMPORTANT : initialiser Django AVANT d'importer les consumers
django_asgi_app = get_asgi_application()

from temps_reel.middleware import JWTAuthMiddlewareStack  # noqa: E402
from temps_reel.routing import websocket_urlpatterns      # noqa: E402


application = ProtocolTypeRouter({
    # HTTP classique (REST, admin, docs)
    "http": django_asgi_app,

    # WebSocket avec auth JWT
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
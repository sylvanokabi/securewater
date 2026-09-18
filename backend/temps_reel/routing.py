"""
Routes WebSocket.

URLs :
    ws://host/ws/reservoirs/<code_reservoir>/?token=<JWT>
    ws://host/ws/telemetrie/?token=<JWT>
"""
from django.urls import re_path

from .consumers import ReservoirConsumer, TelemetrieConsumer


websocket_urlpatterns = [
    # Télémétrie globale (tous les réservoirs)
    re_path(
        r"^ws/telemetrie/$",
        TelemetrieConsumer.as_asgi(),
        name="ws-telemetrie",
    ),

    # Par réservoir
    re_path(
        r"^ws/reservoirs/(?P<code_reservoir>[\w-]+)/$",
        ReservoirConsumer.as_asgi(),
        name="ws-reservoir",
    ),
]
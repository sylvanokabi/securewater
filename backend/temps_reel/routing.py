"""
Routes WebSocket.

URLs :
  ws://host/ws/reservoirs/<code_reservoir>/?token=<JWT>
"""
from django.urls import re_path

from .consumers import ReservoirConsumer


websocket_urlpatterns = [
    re_path(
        r"^ws/reservoirs/(?P<code_reservoir>[\w-]+)/$",
        ReservoirConsumer.as_asgi(),
        name="ws-reservoir",
    ),
]
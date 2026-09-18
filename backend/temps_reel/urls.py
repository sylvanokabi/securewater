from django.urls import path

from .views import WebSocketInfoView

app_name = "temps_reel"

urlpatterns = [
    path(
        "websocket/info/",
        WebSocketInfoView.as_view(),
        name="websocket-info",
    ),
]
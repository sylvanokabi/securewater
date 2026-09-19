from django.urls import path

from .views import (
    StatsMQTTView,
    ScenariosTestView,
    CertificatsView,
    TesterConnexionView,
    JournalView,
)

app_name = "demonstration"

urlpatterns = [
    path("demonstration/mqtt/stats/", StatsMQTTView.as_view(), name="mqtt-stats"),
    path("demonstration/scenarios/", ScenariosTestView.as_view(), name="scenarios"),
    path("demonstration/certificats/", CertificatsView.as_view(), name="certificats"),
    path("demonstration/tester-connexion/", TesterConnexionView.as_view(), name="tester-connexion"),
    path("demonstration/journal/", JournalView.as_view(), name="journal"),
]
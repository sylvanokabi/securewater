from django.urls import path

from .views import (
    ListeCreerCapteursView,
    DetailCapteurView,
    AuthentifierCapteurView,
    ConnecterCapteurView,
    DeconnecterCapteurView,
    HeartbeatCapteurView,
    EtatCapteurView,
    MesuresCapteurView,
    DerniereMesureCapteurView,
)

app_name = "capteurs"

urlpatterns = [
    # CRUD
    path("capteurs/", ListeCreerCapteursView.as_view(), name="liste-creer"),
    path("capteurs/<int:pk>/", DetailCapteurView.as_view(), name="detail"),

    # Cycle de vie IoT
    path("capteurs/<int:pk>/authentifier/", AuthentifierCapteurView.as_view(), name="authentifier"),
    path("capteurs/<int:pk>/connecter/", ConnecterCapteurView.as_view(), name="connecter"),
    path("capteurs/<int:pk>/deconnecter/", DeconnecterCapteurView.as_view(), name="deconnecter"),
    path("capteurs/<int:pk>/heartbeat/", HeartbeatCapteurView.as_view(), name="heartbeat"),
    path("capteurs/<int:pk>/etat/", EtatCapteurView.as_view(), name="etat"),

    # Mesures
    path("capteurs/<int:pk>/mesures/", MesuresCapteurView.as_view(), name="mesures"),
    path("capteurs/<int:pk>/derniere-mesure/", DerniereMesureCapteurView.as_view(), name="derniere-mesure"),
]
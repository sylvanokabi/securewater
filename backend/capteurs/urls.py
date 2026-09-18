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
    path("", ListeCreerCapteursView.as_view(), name="liste-creer"),
    path("<int:pk>/", DetailCapteurView.as_view(), name="detail"),

    # Cycle de vie IoT
    path("<int:pk>/authentifier/", AuthentifierCapteurView.as_view(), name="authentifier"),
    path("<int:pk>/connecter/", ConnecterCapteurView.as_view(), name="connecter"),
    path("<int:pk>/deconnecter/", DeconnecterCapteurView.as_view(), name="deconnecter"),
    path("<int:pk>/heartbeat/", HeartbeatCapteurView.as_view(), name="heartbeat"),
    path("<int:pk>/etat/", EtatCapteurView.as_view(), name="etat"),

    # Mesures
    path("<int:pk>/mesures/", MesuresCapteurView.as_view(), name="mesures"),
    path("<int:pk>/derniere-mesure/", DerniereMesureCapteurView.as_view(), name="derniere-mesure"),
]

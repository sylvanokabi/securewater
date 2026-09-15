from django.urls import path

from .views import (
    ListeAlertesView,
    DetailAlerteView,
    AcquitterAlerteView,
    ResoudreAlerteView,
    CreerAlerteManuelleView,
    StatistiquesAlertesView,
)

app_name = "alertes"

urlpatterns = [
    # Lecture
    path("alertes/", ListeAlertesView.as_view(), name="liste"),
    path("alertes/statistiques/", StatistiquesAlertesView.as_view(), name="statistiques"),
    path("alertes/<int:pk>/", DetailAlerteView.as_view(), name="detail"),

    # Cycle de vie
    path("alertes/<int:pk>/acquitter/", AcquitterAlerteView.as_view(), name="acquitter"),
    path("alertes/<int:pk>/resoudre/", ResoudreAlerteView.as_view(), name="resoudre"),

    # Création manuelle
    path("alertes/manuel/", CreerAlerteManuelleView.as_view(), name="creer-manuelle"),
]
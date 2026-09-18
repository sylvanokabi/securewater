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
    path("", ListeAlertesView.as_view(), name="liste"),
    path("statistiques/", StatistiquesAlertesView.as_view(), name="statistiques"),
    path("<int:pk>/", DetailAlerteView.as_view(), name="detail"),

    # Cycle de vie
    path("<int:pk>/acquitter/", AcquitterAlerteView.as_view(), name="acquitter"),
    path("<int:pk>/resoudre/", ResoudreAlerteView.as_view(), name="resoudre"),

    # Création manuelle
    path("manuel/", CreerAlerteManuelleView.as_view(), name="creer-manuelle"),
]

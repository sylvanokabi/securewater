from django.urls import path

from .views import (
    DemarrerSimulationView,
    ArreterSimulationView,
    EtatSimulationView,
)

app_name = "simulation"

urlpatterns = [
    path("simulation/demarrer/", DemarrerSimulationView.as_view(), name="demarrer"),
    path("simulation/arreter/", ArreterSimulationView.as_view(), name="arreter"),
    path("simulation/etat/", EtatSimulationView.as_view(), name="etat"),
]
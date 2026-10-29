from django.urls import path
from .views import ListeCreerReservoirsView, DetailReservoirView, EtatGlobalSimulationView

app_name = "reservoirs"

urlpatterns = [
    path("reservoirs/", ListeCreerReservoirsView.as_view(), name="liste-creer"),
    path("reservoirs/etat-global/", EtatGlobalSimulationView.as_view(), name="etat-global"), # 👈 Ajouté
    path("reservoirs/<int:pk>/", DetailReservoirView.as_view(), name="detail"),
]
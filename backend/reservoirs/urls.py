from django.urls import path

from .views import ListeCreerReservoirsView, DetailReservoirView

app_name = "reservoirs"

urlpatterns = [
    path("reservoirs/", ListeCreerReservoirsView.as_view(), name="liste-creer"),
    path("reservoirs/<int:pk>/", DetailReservoirView.as_view(), name="detail"),
]
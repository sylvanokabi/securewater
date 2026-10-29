from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from .models import Reservoir
from .permissions import PeutGererReservoir
from .serializers import ReservoirSerializer, ReservoirListeSerializer
from capteurs.models import Capteur

class ListeCreerReservoirsView(ListCreateAPIView):
    permission_classes = [PeutGererReservoir]
    queryset = Reservoir.objects.all().order_by("nom")
    def get_serializer_class(self):
        return ReservoirListeSerializer if self.request.method == "GET" else ReservoirSerializer

class DetailReservoirView(RetrieveUpdateDestroyAPIView):
    permission_classes = [PeutGererReservoir]
    queryset = Reservoir.objects.all()
    serializer_class = ReservoirSerializer

# 👇 NOUVEL ENDPOINT POUR LE SIMULATEUR
class EtatGlobalSimulationView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        reservoirs = Reservoir.objects.filter(statut="actif")
        data = []
        for r in reservoirs:
            capteurs_niveau = list(Capteur.objects.filter(reservoir=r, type="niveau").values_list("code", flat=True))
            capteurs_debit = list(Capteur.objects.filter(reservoir=r, type="debit").values_list("code", flat=True))
            
            if capteurs_niveau: # On ne simule que si le réservoir a au moins un capteur
                data.append({
                    "code": r.code,
                    "scenario": r.scenario_actuel,
                    "niveau_pct": r.niveau_actuel_pct,
                    "hauteur_max_cm": r.hauteur_max_cm,
                    "capteurs_niveau": capteurs_niveau,
                    "capteurs_debit": capteurs_debit
                })
        return Response(data)
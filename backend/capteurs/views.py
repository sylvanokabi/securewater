from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Capteur
from .permissions import PeutGererCapteur
from .serializers import (
    CapteurSerializer,
    CapteurListeSerializer,
    CapteurEtatSerializer,
    MesureSerializer,
)


# ==================================================================
# Capteurs
# ==================================================================
class ListeCreerCapteursView(ListCreateAPIView):
    permission_classes = [PeutGererCapteur]
    queryset = Capteur.objects.select_related("reservoir").order_by("nom")
    filterset_fields = ["type", "statut", "etat_connexion", "reservoir"]
    search_fields = ["nom", "code", "topic_mqtt", "adresse_ip"]
    ordering_fields = ["nom", "date_creation", "derniere_mesure", "nombre_mesures"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return CapteurListeSerializer
        return CapteurSerializer

    def create(self, request, *args, **kwargs):
        serializer = CapteurSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        capteur = services.creer_capteur(
            nom=data["nom"],
            code=data.get("code"), # Le code est maintenant géré par le serializer
            type=data["type"],
            reservoir=data["reservoir"],
            statut=data.get("statut", Capteur.Statut.ACTIF),
            adresse_ip=data.get("adresse_ip"),
            firmware_version=data.get("firmware_version", ""),
            certificat_fingerprint=data.get("certificat_fingerprint", ""),
            metadata=data.get("metadata") or {},
        )
        return Response(CapteurSerializer(capteur).data, status=status.HTTP_201_CREATED)


class DetailCapteurView(RetrieveUpdateDestroyAPIView):
    permission_classes = [PeutGererCapteur]
    queryset = Capteur.objects.select_related("reservoir").all()
    serializer_class = CapteurSerializer

    def update(self, request, *args, **kwargs):
        capteur = self.get_object()
        serializer = CapteurSerializer(capteur, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # Si le code est modifié, on ne veut pas casser le topic MQTT. 
        # On le laisse au serializer qui gère l'update.
        capteur = services.mettre_a_jour_capteur(
            capteur, **serializer.validated_data
        )
        return Response(CapteurSerializer(capteur).data)

    def destroy(self, request, *args, **kwargs):
        capteur = self.get_object()
        services.supprimer_capteur(capteur)
        return Response({"message": "Capteur supprimé."}, status=status.HTTP_204_NO_CONTENT)


# ==================================================================
# Cycle de vie IoT
# ==================================================================
class AuthentifierCapteurView(APIView):
    permission_classes = [PeutGererCapteur]
    def post(self, request, pk):
        capteur = get_object_or_404(Capteur, pk=pk)
        services.marquer_authentification(capteur, adresse_ip=request.data.get("adresse_ip"), certificat_fingerprint=request.data.get("certificat_fingerprint"))
        return Response(CapteurSerializer(capteur).data)

class ConnecterCapteurView(APIView):
    permission_classes = [PeutGererCapteur]
    def post(self, request, pk):
        capteur = get_object_or_404(Capteur, pk=pk)
        services.marquer_connexion(capteur, adresse_ip=request.data.get("adresse_ip"), firmware_version=request.data.get("firmware_version"))
        return Response(CapteurSerializer(capteur).data)

class DeconnecterCapteurView(APIView):
    permission_classes = [PeutGererCapteur]
    def post(self, request, pk):
        capteur = get_object_or_404(Capteur, pk=pk)
        services.marquer_deconnexion(capteur, raison=request.data.get("raison", ""))
        return Response(CapteurSerializer(capteur).data)

class HeartbeatCapteurView(APIView):
    permission_classes = [PeutGererCapteur]
    def post(self, request, pk):
        capteur = get_object_or_404(Capteur, pk=pk)
        services.traiter_heartbeat(capteur, adresse_ip=request.data.get("adresse_ip"))
        return Response(CapteurSerializer(capteur).data)

class EtatCapteurView(APIView):
    permission_classes = [PeutGererCapteur]
    def get(self, request, pk):
        capteur = get_object_or_404(Capteur, pk=pk)
        etat = services.calculer_etat_connexion_courant(capteur)
        return Response(CapteurEtatSerializer(etat).data)


# ==================================================================
# Mesures
# ==================================================================
class MesuresCapteurView(ListAPIView):
    permission_classes = [PeutGererCapteur]
    serializer_class = MesureSerializer

    def get_queryset(self):
        capteur = get_object_or_404(Capteur, pk=self.kwargs["pk"])
        qs = capteur.mesures.all().order_by("-horodatage")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        etat_niveau = self.request.query_params.get("etat_niveau")
        if date_from: qs = qs.filter(horodatage__gte=date_from)
        if date_to: qs = qs.filter(horodatage__lte=date_to)
        if etat_niveau: qs = qs.filter(etat_niveau=etat_niveau)
        return qs

class DerniereMesureCapteurView(APIView):
    permission_classes = [PeutGererCapteur]
    def get(self, request, pk):
        capteur = get_object_or_404(Capteur, pk=pk)
        mesure = services.recuperer_derniere_mesure(capteur)
        if mesure is None:
            return Response({"detail": "Aucune mesure."}, status=status.HTTP_404_NOT_FOUND)
        return Response(MesureSerializer(mesure).data)
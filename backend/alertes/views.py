from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from capteurs.models import Capteur
from reservoirs.models import Reservoir
from . import services
from .models import Alerte
from .permissions import PeutGererAlerte
from .serializers import (
    AlerteSerializer,
    AlerteListeSerializer,
    AlerteManuelleSerializer,
)


# ==================================================================
# Lecture
# ==================================================================
class ListeAlertesView(ListAPIView):
    """
    GET /api/alertes/
    Filtres : ?statut=&gravite=&type=&capteur=&reservoir=
    """

    permission_classes = [PeutGererAlerte]
    queryset = Alerte.objects.select_related(
        "capteur", "reservoir", "acquittee_par", "resolue_par"
    ).order_by("-date_declenchement")
    serializer_class = AlerteListeSerializer
    filterset_fields = ["statut", "gravite", "type", "capteur", "reservoir"]
    search_fields = ["message", "capteur__nom", "capteur__code"]
    ordering_fields = ["date_declenchement", "gravite", "statut"]


class DetailAlerteView(RetrieveAPIView):
    """GET /api/alertes/<id>/"""

    permission_classes = [PeutGererAlerte]
    queryset = Alerte.objects.select_related("capteur", "reservoir").all()
    serializer_class = AlerteSerializer


# ==================================================================
# Cycle de vie
# ==================================================================
class AcquitterAlerteView(APIView):
    """POST /api/alertes/<id>/acquitter/"""

    permission_classes = [PeutGererAlerte]

    def post(self, request, pk):
        alerte = get_object_or_404(Alerte, pk=pk)
        services.acquitter_alerte(alerte, utilisateur=request.user)
        return Response(AlerteSerializer(alerte).data, status=status.HTTP_200_OK)


class ResoudreAlerteView(APIView):
    """POST /api/alertes/<id>/resoudre/"""

    permission_classes = [PeutGererAlerte]

    def post(self, request, pk):
        alerte = get_object_or_404(Alerte, pk=pk)
        services.resoudre_alerte(alerte, utilisateur=request.user, auto=False)
        return Response(AlerteSerializer(alerte).data, status=status.HTTP_200_OK)


# ==================================================================
# Création manuelle
# ==================================================================
class CreerAlerteManuelleView(APIView):
    """POST /api/alertes/manuel/"""

    permission_classes = [PeutGererAlerte]

    def post(self, request):
        serializer = AlerteManuelleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        capteur = None
        reservoir = None
        if data.get("capteur"):
            capteur = get_object_or_404(Capteur, pk=data["capteur"])
            reservoir = capteur.reservoir
        elif data.get("reservoir"):
            reservoir = get_object_or_404(Reservoir, pk=data["reservoir"])

        alerte = services.declencher_alerte(
            type=data["type"],
            gravite=data["gravite"],
            message=data["message"],
            capteur=capteur,
            reservoir=reservoir,
        )
        return Response(AlerteSerializer(alerte).data, status=status.HTTP_201_CREATED)


# ==================================================================
# Statistiques
# ==================================================================
class StatistiquesAlertesView(APIView):
    """GET /api/alertes/statistiques/"""

    permission_classes = [PeutGererAlerte]

    def get(self, request):
        qs = Alerte.objects.filter(statut=Alerte.Statut.ACTIVE)
        par_gravite = {}
        for g, _ in Alerte.Gravite.choices:
            par_gravite[g] = qs.filter(gravite=g).count()

        par_type = {}
        for t, _ in Alerte.Type.choices:
            count = qs.filter(type=t).count()
            if count:
                par_type[t] = count

        return Response({
            "total_actives": qs.count(),
            "par_gravite": par_gravite,
            "par_type": par_type,
        })
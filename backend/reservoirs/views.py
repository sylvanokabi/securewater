from rest_framework import status
from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.response import Response

from . import services
from .models import Reservoir
from .permissions import PeutGererReservoir
from .serializers import ReservoirSerializer, ReservoirListeSerializer


class ListeCreerReservoirsView(ListCreateAPIView):
    """
    GET  /api/reservoirs/   → liste paginée et filtrable.
    POST /api/reservoirs/   → création (admin/opérateur).
    """

    permission_classes = [PeutGererReservoir]
    queryset = Reservoir.objects.all().order_by("nom")
    filterset_fields = ["statut"]
    search_fields = ["nom", "code", "localisation"]
    ordering_fields = ["nom", "date_creation", "date_modification"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return ReservoirListeSerializer
        return ReservoirSerializer

    def create(self, request, *args, **kwargs):
        serializer = ReservoirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reservoir = services.creer_reservoir(**serializer.validated_data)
        return Response(
            ReservoirSerializer(reservoir).data,
            status=status.HTTP_201_CREATED,
        )


class DetailReservoirView(RetrieveUpdateDestroyAPIView):
    """
    GET    /api/reservoirs/<id>/   → détail.
    PATCH  /api/reservoirs/<id>/   → modification (admin/opérateur).
    DELETE /api/reservoirs/<id>/   → suppression (admin).
    """

    permission_classes = [PeutGererReservoir]
    queryset = Reservoir.objects.all()
    serializer_class = ReservoirSerializer

    def update(self, request, *args, **kwargs):
        reservoir = self.get_object()
        serializer = ReservoirSerializer(reservoir, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        reservoir = services.mettre_a_jour_reservoir(
            reservoir, **serializer.validated_data
        )
        return Response(ReservoirSerializer(reservoir).data)

    def destroy(self, request, *args, **kwargs):
        reservoir = self.get_object()
        services.supprimer_reservoir(reservoir)
        return Response(
            {"message": "Réservoir supprimé."},
            status=status.HTTP_204_NO_CONTENT,
        )
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import PeutControlerSimulation
from .serializers import DemarrerSimulationSerializer
from . import services


class DemarrerSimulationView(APIView):
    """POST /api/simulation/demarrer/"""
    permission_classes = [PeutControlerSimulation]

    def post(self, request):
        serializer = DemarrerSimulationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            etat = services.demarrer_simulation(**serializer.validated_data)
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(etat, status=status.HTTP_201_CREATED)


class ArreterSimulationView(APIView):
    """POST /api/simulation/arreter/"""
    permission_classes = [PeutControlerSimulation]

    def post(self, request):
        try:
            etat = services.arreter_simulation()
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(etat, status=status.HTTP_200_OK)


class EtatSimulationView(APIView):
    """GET /api/simulation/etat/"""
    permission_classes = [PeutControlerSimulation]

    def get(self, request):
        return Response(services.etat_simulation(), status=status.HTTP_200_OK)
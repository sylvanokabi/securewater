from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .permissions import PeutVoirDemonstration
from .serializers import TesterConnexionSerializer


class StatsMQTTView(APIView):
    """GET /api/demonstration/mqtt/stats/ — compteurs MQTT en temps réel."""
    permission_classes = [PeutVoirDemonstration]

    def get(self, request):
        return Response(services.get_stats_mqtt())


class ScenariosTestView(APIView):
    """GET /api/demonstration/scenarios/ — liste des scénarios disponibles."""
    permission_classes = [PeutVoirDemonstration]

    def get(self, request):
        return Response([
            {"id": k, **v} for k, v in services.SCENARIOS_TEST.items()
        ])


class CertificatsView(APIView):
    """GET /api/demonstration/certificats/ — métadonnées des certificats."""
    permission_classes = [PeutVoirDemonstration]

    def get(self, request):
        return Response(services.lister_certificats())


class TesterConnexionView(APIView):
    """POST /api/demonstration/tester-connexion/ — lance un test."""
    permission_classes = [PeutVoirDemonstration]

    def post(self, request):
        serializer = TesterConnexionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resultat = services.tester_connexion(serializer.validated_data["scenario"])
        return Response(resultat)


class JournalView(APIView):
    """GET /api/demonstration/journal/ — historique des événements."""
    permission_classes = [PeutVoirDemonstration]

    def get(self, request):
        limite = int(request.query_params.get("limite", 50))
        return Response(services.lister_evenements(limite))
# Dans backend/demonstration/views.py

class PublierMessageTestView(APIView):
    permission_classes = [PeutVoirDemonstration]

    def post(self, request):
        valeur = request.data.get("valeur", 50.0)
        type_capteur = request.data.get("type_capteur", "niveau")
        
        try:
            resultat = services.publier_message_test(valeur, type_capteur)
            if resultat["success"]:
                return Response(resultat, status=status.HTTP_200_OK)
            # Si ça échoue, on renvoie le message d'erreur exact
            return Response(resultat, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
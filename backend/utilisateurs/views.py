from django.shortcuts import get_object_or_404

from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError

from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Utilisateur
from .permissions import EstAdministrateur
from .serializers import (
    ConnexionSerializer,
    GestionUtilisateurSerializer,
    InscriptionSerializer,
    ProfilSerializer,
    UtilisateurSerializer,
)
from .services import (
    activer_utilisateur,
    desactiver_utilisateur,
    mettre_a_jour_derniere_connexion,
    supprimer_utilisateur,
)


class InscriptionView(generics.CreateAPIView):
    """
    Création d'un compte utilisateur.
    """

    serializer_class = InscriptionSerializer
    permission_classes = [AllowAny]



class ConnexionView(TokenObtainPairView):
    """
    Authentification JWT.
    """

    serializer_class = ConnexionSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            email = request.data.get("email")
            utilisateur = Utilisateur.objects.filter(email=email).first()

            if utilisateur:
                mettre_a_jour_derniere_connexion(utilisateur)

        return response
    

class ProfilView(generics.RetrieveUpdateAPIView):
    """
    Consultation et modification du profil
    de l'utilisateur authentifié.
    """

    serializer_class = ProfilSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ListeUtilisateursView(generics.ListAPIView):
    """
    Liste des utilisateurs.
    """

    queryset = Utilisateur.objects.all().order_by("id")
    serializer_class = UtilisateurSerializer
    permission_classes = [EstAdministrateur]


class DetailUtilisateurView(generics.RetrieveUpdateAPIView):
    """
    Consultation et modification d'un utilisateur.
    """

    queryset = Utilisateur.objects.all()
    serializer_class = GestionUtilisateurSerializer
    permission_classes = [EstAdministrateur]

    lookup_url_kwarg = "utilisateur_id"


class ActiverUtilisateurView(generics.UpdateAPIView):
    """
    Active un compte utilisateur.
    """

    queryset = Utilisateur.objects.all()
    permission_classes = [EstAdministrateur]

    lookup_url_kwarg = "utilisateur_id"

    def update(self, request, *args, **kwargs):
        utilisateur = get_object_or_404(
            Utilisateur,
            id=kwargs["utilisateur_id"],
        )

        activer_utilisateur(utilisateur)

        serializer = GestionUtilisateurSerializer(utilisateur)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class DesactiverUtilisateurView(generics.UpdateAPIView):
    """
    Désactive un compte utilisateur.
    """

    queryset = Utilisateur.objects.all()
    permission_classes = [EstAdministrateur]

    lookup_url_kwarg = "utilisateur_id"

    def update(self, request, *args, **kwargs):
        utilisateur = get_object_or_404(
            Utilisateur,
            id=kwargs["utilisateur_id"],
        )

        desactiver_utilisateur(utilisateur)

        serializer = GestionUtilisateurSerializer(utilisateur)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, utilisateur_id):   
        utilisateur = get_object_or_404(Utilisateur, id=utilisateur_id)
        demandeur = request.user

        try:
            supprimer_utilisateur(utilisateur, demandeur)
            return Response(
                {"message": "Utilisateur supprimé avec succès."},
                status=status.HTTP_204_NO_CONTENT,
            )
        except ValidationError as e:              
            return Response(
                {"error": e.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )
from django.urls import path

from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenRefreshView,
)

from .views import (
    ActiverUtilisateurView,
    ConnexionView,
    DesactiverUtilisateurView,
    DetailUtilisateurView,
    InscriptionView,
    ListeUtilisateursView,
    ProfilView,
)


urlpatterns = [

    # Authentification
    path(
        "auth/inscription/",
        InscriptionView.as_view(),
        name="inscription",
    ),

    path(
        "auth/connexion/",
        ConnexionView.as_view(),
        name="connexion",
    ),

    path(
        "auth/rafraichir/",
        TokenRefreshView.as_view(),
        name="token-refresh",
    ),

    path(
        "auth/deconnexion/",
        TokenBlacklistView.as_view(),
        name="deconnexion",
    ),

    # Profil
    path(
        "auth/profil/",
        ProfilView.as_view(),
        name="profil",
    ),

    # Administration des utilisateurs
    path(
        "utilisateurs/",
        ListeUtilisateursView.as_view(),
        name="liste-utilisateurs",
    ),

    path(
        "utilisateurs/<int:utilisateur_id>/",
        DetailUtilisateurView.as_view(),
        name="detail-utilisateur",
    ),

    path(
        "utilisateurs/<int:utilisateur_id>/activer/",
        ActiverUtilisateurView.as_view(),
        name="activer-utilisateur",
    ),

    path(
        "utilisateurs/<int:utilisateur_id>/desactiver/",
        DesactiverUtilisateurView.as_view(),
        name="desactiver-utilisateur",
    ),
]
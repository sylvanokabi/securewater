from rest_framework.permissions import BasePermission,SAFE_METHODS

from .models import Utilisateur


class EstAdministrateur(BasePermission):
    """
    Autorise uniquement les utilisateurs ayant le rôle Administrateur.
    """

    message = "Cette action nécessite le rôle Administrateur."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == Utilisateur.Role.ADMINISTRATEUR
        )


class EstOperateur(BasePermission):
    """
    Autorise les Administrateurs et Opérateurs.
    """

    message = "Cette action nécessite le rôle Administrateur ou Opérateur."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.role in [
            Utilisateur.Role.ADMINISTRATEUR,
            Utilisateur.Role.OPERATEUR,
        ]


class EstAdministrateurOuOperateur(BasePermission):
    """
    Alias explicite pour les opérations métier nécessitant
    un Administrateur ou un Opérateur.
    """

    message = "Cette action nécessite le rôle Administrateur ou Opérateur."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.role in [
            Utilisateur.Role.ADMINISTRATEUR,
            Utilisateur.Role.OPERATEUR,
        ]


class LectureSeule(BasePermission):
    """Autorise uniquement les méthodes GET/HEAD/OPTIONS."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
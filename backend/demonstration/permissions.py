from rest_framework.permissions import BasePermission

from utilisateurs.models import Utilisateur


class PeutVoirDemonstration(BasePermission):
    """Tout utilisateur authentifié peut voir et tester."""

    message = "Authentification requise."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
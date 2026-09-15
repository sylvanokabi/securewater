"""
Permissions locales pour l'application alertes.

Règles :
  - Lecture (GET)                 : tout utilisateur authentifié.
  - Acquitter / créer (POST/PATCH): Administrateur ou Opérateur.
  - Supprimer (DELETE)            : Administrateur uniquement.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS

from utilisateurs.models import Utilisateur


class PeutGererAlerte(BasePermission):
    message = "Cette action nécessite le rôle Administrateur ou Opérateur."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.method in SAFE_METHODS:
            return True

        if request.method == "DELETE":
            return request.user.role == Utilisateur.Role.ADMINISTRATEUR

        return request.user.role in [
            Utilisateur.Role.ADMINISTRATEUR,
            Utilisateur.Role.OPERATEUR,
        ]
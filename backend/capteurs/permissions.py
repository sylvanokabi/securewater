"""
Permissions locales pour l'application capteurs.

Règles (identiques à reservoirs, pour cohérence) :
  - Lecture (GET)             : tout utilisateur authentifié.
  - Écriture (POST/PATCH)     : Administrateur ou Opérateur.
  - Suppression (DELETE)      : Administrateur uniquement.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS

from utilisateurs.models import Utilisateur


class PeutGererCapteur(BasePermission):
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
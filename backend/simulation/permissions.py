"""
Permissions pour le contrôle du simulateur.
Réservé aux Administrateurs et Opérateurs.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS

from utilisateurs.models import Utilisateur


class PeutControlerSimulation(BasePermission):
    message = (
        "Cette action nécessite le rôle Administrateur ou Opérateur. "
        "Les observateurs peuvent seulement consulter l'état."
    )

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        # Lecture : tout utilisateur authentifié
        if request.method in SAFE_METHODS:
            return True

        # Écriture : admin ou opérateur
        return request.user.role in [
            Utilisateur.Role.ADMINISTRATEUR,
            Utilisateur.Role.OPERATEUR,
        ]
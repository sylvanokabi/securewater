from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):

    list_display = (
        "username",
        "email",
        "role",
        "actif",
        "is_staff",
        "is_superuser",
        "derniere_connexion",
    )

    list_filter = (
        "role",
        "actif",
        "is_staff",
        "is_superuser",
    )

    search_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
    )

    ordering = ("username",)

    fieldsets = UserAdmin.fieldsets + (
        (
            "Informations SECUREWATER",
            {
                "fields": (
                    "role",
                    "actif",
                    "date_creation",
                    "date_modification",
                    "derniere_connexion",
                )
            },
        ),
    )

    readonly_fields = (
        "date_creation",
        "date_modification",
        "derniere_connexion",
    )
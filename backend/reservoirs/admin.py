from django.contrib import admin

from .models import Reservoir


@admin.register(Reservoir)
class ReservoirAdmin(admin.ModelAdmin):
    list_display = (
        "nom",
        "code",
        "statut",
        "localisation",
        "capacite_max_litres",
        "hauteur_max_cm",
        "date_modification",
    )
    list_filter = ("statut",)
    search_fields = ("nom", "code", "localisation")
    ordering = ("nom",)
    readonly_fields = ("date_creation", "date_modification")

    fieldsets = (
        ("Identification", {
            "fields": ("nom", "code", "description", "localisation", "latitude", "longitude")
        }),
        ("Caractéristiques physiques", {
            "fields": ("capacite_max_litres", "hauteur_max_cm")
        }),
        ("Seuils d'alerte (%)", {
            "fields": (
                "seuil_critique_bas",
                "seuil_alerte_bas",
                "seuil_alerte_haut",
                "seuil_critique_haut",
            )
        }),
        ("Statut & traçabilité", {
            "fields": ("statut", "date_creation", "date_modification")
        }),
    )
from django.contrib import admin

from .models import Alerte


@admin.register(Alerte)
class AlerteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "get_gravite_display",
        "get_type_display",
        "capteur",
        "statut",
        "date_declenchement",
        "date_resolution",
    )
    list_filter = ("gravite", "type", "statut", "resolution_auto")
    search_fields = ("message", "capteur__nom", "capteur__code")
    ordering = ("-date_declenchement",)
    date_hierarchy = "date_declenchement"
    readonly_fields = (
        "date_declenchement",
        "date_acquittement",
        "date_resolution",
        "resolution_auto",
        "mesure_declencheuse",
    )

    fieldsets = (
        ("Description", {
            "fields": ("type", "gravite", "statut", "message")
        }),
        ("Références", {
            "fields": (
                "capteur", "reservoir", "mesure_declencheuse",
                "valeur_mesure", "seuil_franchi",
            )
        }),
        ("Cycle de vie", {
            "fields": (
                "date_declenchement", "date_acquittement", "date_resolution",
                "acquittee_par", "resolue_par", "resolution_auto",
            )
        }),
    )

    def has_add_permission(self, request):
        # Les alertes sont générées automatiquement ; on bloque l'ajout manuel
        # (utiliser l'endpoint /api/alertes/manuel/ pour créer manuellement).
        return False
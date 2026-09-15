from django.contrib import admin

from .models import Capteur, Mesure


@admin.register(Capteur)
class CapteurAdmin(admin.ModelAdmin):
    list_display = (
        "nom",
        "code",
        "type",
        "reservoir",
        "statut",
        "etat_connexion",
        "en_ligne",
        "nombre_mesures",
        "derniere_mesure",
    )
    list_filter = (
        "type",
        "statut",
        "etat_connexion",
        "en_ligne",
        "reservoir",
    )
    search_fields = ("nom", "code", "topic_mqtt", "adresse_ip", "firmware_version")
    ordering = ("nom",)
    readonly_fields = (
        "en_ligne",
        "etat_connexion",
        "derniere_authentification",
        "derniere_connexion",
        "derniere_mesure",
        "derniere_erreur",
        "nombre_mesures",
        "date_creation",
        "date_modification",
    )

    fieldsets = (
        ("Identification", {
            "fields": ("nom", "code", "type", "reservoir", "statut")
        }),
        ("Technique & sécurité", {
            "fields": (
                "unite",
                "topic_mqtt",
                "adresse_ip",
                "firmware_version",
                "certificat_fingerprint",
                "metadata",
            )
        }),
        ("État IoT", {
            "fields": (
                "en_ligne",
                "etat_connexion",
                "derniere_authentification",
                "derniere_connexion",
                "derniere_mesure",
                "derniere_erreur",
                "nombre_mesures",
            )
        }),
        ("Traçabilité", {
            "fields": ("date_creation", "date_modification")
        }),
    )


@admin.register(Mesure)
class MesureAdmin(admin.ModelAdmin):
    list_display = (
        "capteur",
        "valeur",
        "unite",
        "etat_niveau",
        "horodatage",
        "date_reception",
    )
    list_filter = ("capteur__type", "etat_niveau", "capteur__reservoir")
    search_fields = ("capteur__nom", "capteur__code")
    ordering = ("-horodatage",)
    date_hierarchy = "horodatage"
    readonly_fields = (
        "capteur",
        "valeur",
        "unite",
        "volume_litres",
        "pourcentage_remplissage",
        "etat_niveau",
        "horodatage",
        "date_reception",
        "payload_brut",
        "date_creation",
    )
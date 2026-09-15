from rest_framework import serializers

from reservoirs.models import Reservoir
from .models import Capteur, Mesure


# ------------------------------------------------------------------
# Capteur
# ------------------------------------------------------------------
class CapteurSerializer(serializers.ModelSerializer):
    """Serializer complet (lecture + écriture)."""

    reservoir_nom = serializers.CharField(source="reservoir.nom", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    etat_connexion_display = serializers.CharField(
        source="get_etat_connexion_display", read_only=True
    )

    class Meta:
        model = Capteur
        fields = [
            "id",
            "nom",
            "code",
            "type",
            "type_display",
            "reservoir",
            "reservoir_nom",
            "unite",
            "topic_mqtt",
            "adresse_ip",
            "firmware_version",
            "certificat_fingerprint",
            "metadata",
            "statut",
            "statut_display",
            "en_ligne",
            "etat_connexion",
            "etat_connexion_display",
            "derniere_authentification",
            "derniere_connexion",
            "derniere_mesure",
            "derniere_erreur",
            "nombre_mesures",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = [
            "id",
            "unite",
            "topic_mqtt",
            "en_ligne",
            "etat_connexion",
            "derniere_authentification",
            "derniere_connexion",
            "derniere_mesure",
            "derniere_erreur",
            "nombre_mesures",
            "date_creation",
            "date_modification",
        ]

    def validate_code(self, value):
        if not value.replace("-", "").isalnum():
            raise serializers.ValidationError(
                "Le code ne peut contenir que des lettres, chiffres et tirets."
            )
        return value.lower()

    def validate_reservoir(self, value):
        if not isinstance(value, Reservoir):
            raise serializers.ValidationError("Réservoir invalide.")
        return value


class CapteurListeSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes."""

    reservoir_nom = serializers.CharField(source="reservoir.nom", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Capteur
        fields = [
            "id",
            "nom",
            "code",
            "type",
            "type_display",
            "reservoir",
            "reservoir_nom",
            "statut",
            "en_ligne",
            "etat_connexion",
            "derniere_mesure",
            "nombre_mesures",
        ]


class CapteurEtatSerializer(serializers.Serializer):
    """Serializer pour l'endpoint /etat/."""

    etat = serializers.CharField()
    en_ligne = serializers.BooleanField()
    derniere_authentification = serializers.DateTimeField(allow_null=True)
    derniere_connexion = serializers.DateTimeField(allow_null=True)
    derniere_mesure = serializers.DateTimeField(allow_null=True)
    secondes_depuis_derniere_mesure = serializers.FloatField(allow_null=True)
    est_silencieux = serializers.BooleanField()
    nombre_mesures = serializers.IntegerField()
    derniere_erreur = serializers.CharField(allow_blank=True)


# ------------------------------------------------------------------
# Mesure
# ------------------------------------------------------------------
class MesureSerializer(serializers.ModelSerializer):
    capteur_code = serializers.CharField(source="capteur.code", read_only=True)

    class Meta:
        model = Mesure
        fields = [
            "id",
            "capteur",
            "capteur_code",
            "valeur",
            "unite",
            "volume_litres",
            "pourcentage_remplissage",
            "etat_niveau",
            "horodatage",
            "date_reception",
            "payload_brut",
            "date_creation",
        ]
        read_only_fields = fields


class MesureCreationSerializer(serializers.Serializer):
    """Serializer d'écriture pour les handlers MQTT / ingestion HTTP."""

    valeur = serializers.FloatField()
    horodatage = serializers.DateTimeField(required=False)
    payload_brut = serializers.JSONField(required=False, allow_null=True)
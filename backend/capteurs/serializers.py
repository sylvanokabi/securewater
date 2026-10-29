from rest_framework import serializers
from django.utils.text import slugify
import uuid
from reservoirs.models import Reservoir
from .models import Capteur, Mesure

# ------------------------------------------------------------------
# Capteur
# ------------------------------------------------------------------
class CapteurSerializer(serializers.ModelSerializer):
    """Serializer complet (lecture + écriture)."""
    code = serializers.SlugField(required=False, allow_blank=True)
    topic_mqtt = serializers.CharField(required=False, allow_blank=True)

    reservoir_nom = serializers.CharField(source="reservoir.nom", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    etat_connexion_display = serializers.CharField(source="get_etat_connexion_display", read_only=True)

    class Meta:
        model = Capteur
        fields = [
            "id", "nom", "code", "type", "type_display", "reservoir", "reservoir_nom",
            "unite", "topic_mqtt", "adresse_ip", "firmware_version", "certificat_fingerprint",
            "metadata", "statut", "statut_display", "en_ligne", "etat_connexion",
            "etat_connexion_display", "derniere_authentification", "derniere_connexion",
            "derniere_mesure", "derniere_erreur", "nombre_mesures", "date_creation", "date_modification"
        ]
        read_only_fields = [
            "id", "unite", "en_ligne", "etat_connexion", "derniere_authentification",
            "derniere_connexion", "derniere_mesure", "derniere_erreur", "nombre_mesures",
            "date_creation", "date_modification"
        ]

    def validate(self, attrs):
        # Génération automatique du code si absent
        if not attrs.get('code'):
            base_slug = slugify(attrs.get('nom', 'capteur'))
            attrs['code'] = f"{base_slug}-{uuid.uuid4().hex[:4]}"
            
        # Génération automatique du topic MQTT
        if not attrs.get('topic_mqtt'):
            reservoir = attrs.get('reservoir')
            if reservoir:
                attrs['topic_mqtt'] = f"securewater/reservoirs/{reservoir.code}/capteurs/{attrs['code']}"
                
        # Génération de l'unité selon le type
        if not attrs.get('unite'):
            if attrs.get('type') == 'niveau':
                attrs['unite'] = 'cm'
            elif attrs.get('type') == 'debit':
                attrs['unite'] = 'L/min'
                
        return super().validate(attrs)


class CapteurListeSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes."""
    reservoir_nom = serializers.CharField(source="reservoir.nom", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Capteur
        fields = [
            "id", "nom", "code", "type", "type_display", "reservoir", "reservoir_nom",
            "statut", "en_ligne", "etat_connexion", "derniere_mesure", "nombre_mesures",
            "unite"
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
            "id", "capteur", "capteur_code", "valeur", "unite",
            "volume_litres", "pourcentage_remplissage", "etat_niveau",
            "horodatage", "date_reception", "payload_brut", "date_creation",
        ]
        read_only_fields = fields


class MesureCreationSerializer(serializers.Serializer):
    """Serializer d'écriture pour les handlers MQTT / ingestion HTTP."""
    valeur = serializers.FloatField()
    horodatage = serializers.DateTimeField(required=False)
    payload_brut = serializers.JSONField(required=False, allow_null=True)
from rest_framework import serializers

from .models import Alerte


class AlerteSerializer(serializers.ModelSerializer):
    """Serializer complet (lecture)."""

    type_display = serializers.CharField(source="get_type_display", read_only=True)
    gravite_display = serializers.CharField(source="get_gravite_display", read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    capteur_nom = serializers.CharField(source="capteur.nom", read_only=True)
    capteur_code = serializers.CharField(source="capteur.code", read_only=True)
    reservoir_nom = serializers.CharField(source="reservoir.nom", read_only=True)
    acquittee_par_nom = serializers.CharField(
        source="acquittee_par.username", read_only=True, default=None
    )
    resolue_par_nom = serializers.CharField(
        source="resolue_par.username", read_only=True, default=None
    )

    class Meta:
        model = Alerte
        fields = [
            "id",
            "type",
            "type_display",
            "gravite",
            "gravite_display",
            "statut",
            "statut_display",
            "message",
            "capteur",
            "capteur_nom",
            "capteur_code",
            "reservoir",
            "reservoir_nom",
            "mesure_declencheuse",
            "valeur_mesure",
            "seuil_franchi",
            "date_declenchement",
            "date_acquittement",
            "date_resolution",
            "acquittee_par",
            "acquittee_par_nom",
            "resolue_par",
            "resolue_par_nom",
            "resolution_auto",
        ]
        read_only_fields = fields


class AlerteListeSerializer(serializers.ModelSerializer):
    """Version allégée pour les listes."""

    type_display = serializers.CharField(source="get_type_display", read_only=True)
    gravite_display = serializers.CharField(source="get_gravite_display", read_only=True)
    capteur_code = serializers.CharField(source="capteur.code", read_only=True)
    reservoir_nom = serializers.CharField(source="reservoir.nom", read_only=True)

    class Meta:
        model = Alerte
        fields = [
            "id",
            "type",
            "type_display",
            "gravite",
            "gravite_display",
            "statut",
            "message",
            "capteur",
            "capteur_code",
            "reservoir",
            "reservoir_nom",
            "valeur_mesure",
            "seuil_franchi",
            "date_declenchement",
            "date_resolution",
            "resolution_auto",
        ]


class AlerteManuelleSerializer(serializers.Serializer):
    """Serializer pour créer manuellement une alerte."""

    type = serializers.ChoiceField(
        choices=Alerte.Type.choices, default=Alerte.Type.MANUELLE
    )
    gravite = serializers.ChoiceField(
        choices=Alerte.Gravite.choices, default=Alerte.Gravite.AVERTISSEMENT
    )
    message = serializers.CharField()
    capteur = serializers.IntegerField(required=False, allow_null=True)
    reservoir = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("capteur") is None and attrs.get("reservoir") is None:
            raise serializers.ValidationError(
                "Il faut fournir au moins 'capteur' ou 'reservoir'."
            )
        return attrs
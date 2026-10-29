from rest_framework import serializers
from django.utils.text import slugify
import uuid
from .models import Reservoir

class ReservoirSerializer(serializers.ModelSerializer):
    code = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Reservoir
        fields = [
            "id", "nom", "code", "description", "localisation", "latitude", "longitude",
            "capacite_max_litres", "hauteur_max_cm", "seuil_critique_bas", "seuil_alerte_bas",
            "seuil_alerte_haut", "seuil_critique_haut", "statut",
            "niveau_actuel_pct", "scenario_actuel",
            "date_creation", "date_modification"
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]

    def validate(self, attrs):
        if not attrs.get('code'):
            base_slug = slugify(attrs.get('nom', 'reservoir'))
            attrs['code'] = f"{base_slug}-{uuid.uuid4().hex[:4]}"
        return super().validate(attrs)

# 👇 LE SERIALIZER OUBLIÉ
class ReservoirListeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservoir
        fields = [
            "id", "nom", "code", "localisation", "capacite_max_litres", "statut",
            "niveau_actuel_pct", "scenario_actuel",
            "date_modification"
        ]
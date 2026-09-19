from rest_framework import serializers

from capteurs.models import Capteur
from reservoirs.models import Reservoir


SCENARIOS_VALIDES = [
    "normal",
    "remplissage",
    "vidange",
    "oscillation",
    "fuite",
    "debordement",
]


class DemarrerSimulationSerializer(serializers.Serializer):
    """Payload pour démarrer une simulation."""

    reservoir = serializers.SlugField(
        max_length=50,
        help_text="Code du réservoir cible (ex: test)",
    )
    scenario = serializers.ChoiceField(
        choices=SCENARIOS_VALIDES,
        default="normal",
    )
    intervalle = serializers.FloatField(min_value=0.5, max_value=60, default=3.0)
    hauteur_max_cm = serializers.FloatField(min_value=1, default=200)
    duree_max = serializers.FloatField(
        required=False, allow_null=True, default=None,
        help_text="Durée max en secondes (null = infini)",
    )

    def validate_reservoir(self, value):
        if not Reservoir.objects.filter(code=value).exists():
            raise serializers.ValidationError(
                f"Aucun réservoir avec le code '{value}'."
            )

        # Vérifie qu'il y a au moins un capteur actif
        reservoir = Reservoir.objects.get(code=value)
        if not Capteur.objects.filter(reservoir=reservoir, statut="actif").exists():
            raise serializers.ValidationError(
                "Ce réservoir n'a aucun capteur actif. "
                "Créez-en au moins un avant de lancer la simulation."
            )

        return value
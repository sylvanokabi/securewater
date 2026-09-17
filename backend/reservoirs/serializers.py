from rest_framework import serializers

from .models import Reservoir


class ReservoirSerializer(serializers.ModelSerializer):
    """Serializer complet (lecture + écriture)."""

    class Meta:
        model = Reservoir
        fields = [
            "id",
            "nom",
            "code",
            "description",
            "localisation",
            "latitude",
            "longitude",
            "capacite_max_litres",
            "hauteur_max_cm",
            "seuil_critique_bas",
            "seuil_alerte_bas",
            "seuil_alerte_haut",
            "seuil_critique_haut",
            "statut",
            "date_creation",
            "date_modification",
        ]
        read_only_fields = ["id", "date_creation", "date_modification"]

    def validate_code(self, value):
        # Le code doit être un slug valide (a-z, 0-9, tirets)
        if not value.replace("-", "").isalnum():
            raise serializers.ValidationError(
                "Le code ne peut contenir que des lettres, chiffres et tirets."
            )
        return value.lower()

    def validate(self, attrs):
        critique_bas = attrs.get("seuil_critique_bas", 10.0)
        alerte_bas = attrs.get("seuil_alerte_bas", 25.0)
        alerte_haut = attrs.get("seuil_alerte_haut", 90.0)
        critique_haut = attrs.get("seuil_critique_haut", 95.0)

        seuils = [critique_bas, alerte_bas, alerte_haut, critique_haut]
        if any(s < 0 or s > 100 for s in seuils):
            raise serializers.ValidationError(
                {"seuils": "Les seuils doivent être compris entre 0 et 100."}
            )
        if not (critique_bas < alerte_bas < alerte_haut < critique_haut):
            raise serializers.ValidationError(
                {
                    "seuils": (
                        "Les seuils doivent respecter : "
                        "critique_bas < alerte_bas < alerte_haut < critique_haut."
                    )
                }
            )

        # Vérif unicité nom (au cas où on n'utilise pas la couche service)
        nom = attrs.get("nom")
        if nom and self.instance is None:
            if Reservoir.objects.filter(nom=nom).exists():
                raise serializers.ValidationError({"nom": "Ce nom est déjà utilisé."})

        return attrs


class ReservoirListeSerializer(serializers.ModelSerializer):
    """Version allégée pour les endpoints de liste."""

    class Meta:
        model = Reservoir
        fields = '__all__'
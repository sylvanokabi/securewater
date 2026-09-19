from rest_framework import serializers


class TesterConnexionSerializer(serializers.Serializer):
    """Payload pour tester une connexion MQTT."""
    scenario = serializers.ChoiceField(
        choices=[
            "valide",
            "sans_certificat",
            "faux_certificat",
            "mauvais_mot_de_passe",
            "sans_tls",
        ],
    )
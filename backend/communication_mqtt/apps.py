from django.apps import AppConfig


class CommunicationMqttConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "communication_mqtt"
    verbose_name = "Communication MQTT"

    # On ne démarre volontairement PAS le client ici :
    # démarrage explicite via `manage.py demarrer_mqtt`.
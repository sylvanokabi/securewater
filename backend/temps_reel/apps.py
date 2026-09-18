from django.apps import AppConfig


class TempsReelConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "temps_reel"
    verbose_name = "Temps réel (WebSocket)"

    def ready(self):
        """
        Enregistre les signaux de diffusion au démarrage de Django.

        Sans ce hook, le signal `post_save` sur Mesure ne serait pas
        branché → les mesures créées ne seraient pas poussées aux clients
        WebSocket.
        """
        from . import signals  # noqa: F401
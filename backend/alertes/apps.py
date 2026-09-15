from django.apps import AppConfig


class AlertesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "alertes"
    verbose_name = "Alertes"

    def ready(self):
        # Enregistre les signaux (analyse automatique des mesures)
        from . import signals  # noqa: F401
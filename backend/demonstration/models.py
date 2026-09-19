from django.db import models


class EvenementSecurite(models.Model):
    """Journal des événements de sécurité (tentatives de connexion MQTT)."""

    class Resultat(models.TextChoices):
        ACCEPTE = "accepte", "Accepté"
        REFUSE = "refuse", "Refusé"

    class TypeEvenement(models.TextChoices):
        CONNEXION_VALIDE = "connexion_valide", "Connexion avec certificat valide"
        SANS_CERTIFICAT = "sans_certificat", "Connexion sans certificat"
        FAUX_CERTIFICAT = "faux_certificat", "Faux certificat"
        MAUVAIS_MOT_DE_PASSE = "mauvais_mot_de_passe", "Mauvais mot de passe"
        SANS_TLS = "sans_tls", "Connexion sans TLS"

    timestamp = models.DateTimeField(auto_now_add=True)
    type_evenement = models.CharField(max_length=30, choices=TypeEvenement.choices)
    resultat = models.CharField(max_length=20, choices=Resultat.choices)
    message = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Événement de sécurité"
        verbose_name_plural = "Événements de sécurité"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"[{self.timestamp:%H:%M:%S}] {self.get_type_evenement_display()} → {self.resultat}"
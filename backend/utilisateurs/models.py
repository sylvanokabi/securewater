from django.contrib.auth.models import AbstractUser
from django.db import models


class Utilisateur(AbstractUser):

    """Utilisateur personnalisé avec rôles (admin / opérateur / observateur)."""

    class Role(models.TextChoices):
        ADMINISTRATEUR = "ADMINISTRATEUR", "Administrateur"
        OPERATEUR = "OPERATEUR", "Opérateur"
        OBSERVATEUR = "OBSERVATEUR", "Observateur"

    email = models.EmailField(
        unique=True,
        verbose_name="Adresse e-mail",
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OBSERVATEUR,
        verbose_name="Rôle",
    )

    actif = models.BooleanField(
        default=True,
        verbose_name="Compte actif",
    )

    date_creation = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création",
    )

    date_modification = models.DateTimeField(
        auto_now=True,
        verbose_name="Date de modification",
    )

    derniere_connexion = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Dernière connexion",
    )

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["-date_creation"]


    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.username} ({self.role})"

    
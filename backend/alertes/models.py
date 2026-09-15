from django.db import models
from django.utils import timezone

from capteurs.models import Capteur
from reservoirs.models import Reservoir
from utilisateurs.models import Utilisateur


class Alerte(models.Model):
    """
    Alerte générée automatiquement ou manuellement.

    Contrainte : pour un couple (capteur, type), il ne peut y avoir
    qu'UNE alerte au statut `active` à la fois. Cette contrainte évite
    le spam (une mesure par seconde ne crée pas 3600 alertes/heure).
    """

    class Type(models.TextChoices):
        # Basées sur les seuils du réservoir
        NIVEAU_CRITIQUE_BAS = "niveau_critique_bas", "Niveau critique bas"
        NIVEAU_BAS = "niveau_bas", "Niveau bas"
        NIVEAU_HAUT = "niveau_haut", "Niveau haut"
        DEBORDEMENT = "debordement", "Débordement"

        # Basées sur l'état du capteur
        CAPTEUR_HORS_LIGNE = "capteur_hors_ligne", "Capteur hors ligne"
        CAPTEUR_SILENCIEUX = "capteur_silencieux", "Capteur silencieux"
        ERREUR_CAPTEUR = "erreur_capteur", "Erreur capteur"

        # Manuelles
        MANUELLE = "manuelle", "Alerte manuelle"

    class Gravite(models.TextChoices):
        INFO = "info", "Information"
        AVERTISSEMENT = "avertissement", "Avertissement"
        CRITIQUE = "critique", "Critique"

    class Statut(models.TextChoices):
        ACTIVE = "active", "Active"
        ACQUITTEE = "acquittee", "Acquittée"
        RESOLUE = "resolue", "Résolue"

    # ------------------------------------------------------------------
    # Description
    # ------------------------------------------------------------------
    type = models.CharField(max_length=30, choices=Type.choices, verbose_name="Type")
    gravite = models.CharField(
        max_length=20,
        choices=Gravite.choices,
        default=Gravite.AVERTISSEMENT,
        verbose_name="Gravité",
    )
    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.ACTIVE,
        verbose_name="Statut",
    )
    message = models.TextField(verbose_name="Message")

    # ------------------------------------------------------------------
    # Références
    # ------------------------------------------------------------------
    capteur = models.ForeignKey(
        Capteur,
        on_delete=models.CASCADE,
        related_name="alertes",
        null=True,
        blank=True,
        verbose_name="Capteur",
    )
    reservoir = models.ForeignKey(
        Reservoir,
        on_delete=models.CASCADE,
        related_name="alertes",
        null=True,
        blank=True,
        verbose_name="Réservoir",
    )
    mesure_declencheuse = models.ForeignKey(
        "capteurs.Mesure",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alertes_declenchees",
        verbose_name="Mesure déclencheuse",
    )

    # Snapshot de la valeur au moment du déclenchement (utile pour l'audit)
    valeur_mesure = models.FloatField(null=True, blank=True, verbose_name="Valeur mesurée")
    seuil_franchi = models.FloatField(null=True, blank=True, verbose_name="Seuil franchi")

    # ------------------------------------------------------------------
    # Cycle de vie
    # ------------------------------------------------------------------
    date_declenchement = models.DateTimeField(
        auto_now_add=True, verbose_name="Date de déclenchement"
    )
    date_acquittement = models.DateTimeField(
        null=True, blank=True, verbose_name="Date d'acquittement"
    )
    date_resolution = models.DateTimeField(
        null=True, blank=True, verbose_name="Date de résolution"
    )

    acquittee_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alertes_acquittees",
        verbose_name="Acquittée par",
    )
    resolue_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alertes_resolues",
        verbose_name="Résolue par",
    )
    resolution_auto = models.BooleanField(
        default=False, verbose_name="Résolution automatique"
    )

    class Meta:
        verbose_name = "Alerte"
        verbose_name_plural = "Alertes"
        ordering = ["-date_declenchement"]
        indexes = [
            models.Index(fields=["statut", "-date_declenchement"]),
            models.Index(fields=["gravite", "statut"]),
            models.Index(fields=["type"]),
            models.Index(fields=["capteur", "statut"]),
        ]
        constraints = [
            # Une seule alerte ACTIVE par (capteur, type)
            models.UniqueConstraint(
                fields=["capteur", "type"],
                condition=models.Q(statut="active"),
                name="unique_alerte_active_par_capteur_type",
            ),
        ]

    def __str__(self):
        cible = self.capteur.code if self.capteur else "—"
        return f"[{self.get_gravite_display()}] {self.get_type_display()} · {cible}"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @property
    def est_active(self) -> bool:
        return self.statut == self.Statut.ACTIVE

    @property
    def est_critique(self) -> bool:
        return self.gravite == self.Gravite.CRITIQUE

    def marquer_acquittee(self, utilisateur=None):
        self.statut = self.Statut.ACQUITTEE
        self.date_acquittement = timezone.now()
        if utilisateur is not None and getattr(utilisateur, "pk", None):
            self.acquittee_par = utilisateur
        self.save(update_fields=[
            "statut", "date_acquittement", "acquittee_par"
        ])

    def marquer_resolue(self, utilisateur=None, auto=False):
        self.statut = self.Statut.RESOLUE
        self.date_resolution = timezone.now()
        self.resolution_auto = auto
        if utilisateur is not None and getattr(utilisateur, "pk", None):
            self.resolue_par = utilisateur
        self.save(update_fields=[
            "statut", "date_resolution", "resolue_par", "resolution_auto"
        ])
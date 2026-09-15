from django.db import models


class Reservoir(models.Model):
    """
    Représente un réservoir d'eau physique équipé de capteurs IoT.

    Le `code` sert d'identifiant stable (utilisé plus tard dans les topics MQTT
    du type `securewater/reservoirs/<code>/capteurs/<capteur_id>`).
    """

    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        INACTIF = "inactif", "Inactif"
        MAINTENANCE = "maintenance", "En maintenance"

    # ------------------------------------------------------------------
    # Identification
    # ------------------------------------------------------------------
    nom = models.CharField(max_length=100, unique=True, verbose_name="Nom")
    code = models.SlugField(
        max_length=50,
        unique=True,
        verbose_name="Code",
        help_text="Identifiant technique (a-z, 0-9, tirets). Utilisé pour les topics MQTT.",
    )
    description = models.TextField(blank=True, verbose_name="Description")
    localisation = models.CharField(max_length=200, blank=True, verbose_name="Localisation")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="Latitude"
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="Longitude"
    )

    # ------------------------------------------------------------------
    # Caractéristiques physiques
    # ------------------------------------------------------------------
    capacite_max_litres = models.FloatField(verbose_name="Capacité maximale (L)")
    hauteur_max_cm = models.FloatField(
        verbose_name="Hauteur maximale (cm)",
        help_text="Utilisé pour convertir la hauteur d'eau (cm) en volume (L).",
    )

    # ------------------------------------------------------------------
    # Seuils d'alerte (en pourcentage de remplissage)
    # ------------------------------------------------------------------
    seuil_critique_bas = models.FloatField(
        default=10.0, verbose_name="Seuil critique bas (%)"
    )
    seuil_alerte_bas = models.FloatField(
        default=25.0, verbose_name="Seuil d'alerte bas (%)"
    )
    seuil_alerte_haut = models.FloatField(
        default=90.0, verbose_name="Seuil d'alerte haut (%)"
    )
    seuil_critique_haut = models.FloatField(
        default=95.0, verbose_name="Seuil critique haut (%)"
    )

    # ------------------------------------------------------------------
    # Statut & traçabilité
    # ------------------------------------------------------------------
    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.ACTIF,
        verbose_name="Statut",
    )
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Date de création")
    date_modification = models.DateTimeField(auto_now=True, verbose_name="Date de modification")

    class Meta:
        verbose_name = "Réservoir"
        verbose_name_plural = "Réservoirs"
        ordering = ["nom"]
        indexes = [
            models.Index(fields=["statut"]),
            models.Index(fields=["code"]),
        ]

    def __str__(self):
        return f"{self.nom} ({self.code})"
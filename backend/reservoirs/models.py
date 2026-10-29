from django.db import models

class Reservoir(models.Model):
    class Statut(models.TextChoices):
        ACTIF = "actif", "Actif"
        INACTIF = "inactif", "Inactif"
        MAINTENANCE = "maintenance", "En maintenance"

    nom = models.CharField(max_length=100, unique=True)
    code = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    localisation = models.CharField(max_length=200, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    capacite_max_litres = models.FloatField()
    hauteur_max_cm = models.FloatField()
    seuil_critique_bas = models.FloatField(default=10.0)
    seuil_alerte_bas = models.FloatField(default=25.0)
    seuil_alerte_haut = models.FloatField(default=90.0)
    seuil_critique_haut = models.FloatField(default=95.0)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.ACTIF)
    
    # 👇 NOUVEAUX CHAMPS
    niveau_actuel_pct = models.FloatField(default=70.0, verbose_name="Niveau actuel (%)")
    scenario_actuel = models.CharField(
        max_length=20,
        choices=[
            ("normal", "Normal (Fluctuation)"),
            ("remplissage", "Remplissage (30s)"),
            ("vidage", "Vidage (30s)"),
        ],
        default="normal",
        verbose_name="Scénario"
    )
    
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Réservoir"
        verbose_name_plural = "Réservoirs"
        ordering = ["nom"]

    def __str__(self):
        return f"{self.nom} ({self.code})"
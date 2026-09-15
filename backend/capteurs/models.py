from django.db import models
from django.utils import timezone

from reservoirs.models import Reservoir


class Capteur(models.Model):
    """
    Capteur virtuel rattaché à un réservoir.

    Suit le cycle de vie IoT complet :
        authentification TLS → connexion MQTT → mesures périodiques.

    Le couple (type, code) définit la nature physique du capteur :
      - NIVEAU  → hauteur d'eau en cm
      - DEBIT   → débit en L/min

    `topic_mqtt` est l'adresse de publication/subscription sur le broker.
    Format : securewater/reservoirs/<code_reservoir>/capteurs/<code_capteur>
    """

    # ------------------------------------------------------------------
    # Énumérations
    # ------------------------------------------------------------------
    class Type(models.TextChoices):
        NIVEAU = "niveau", "Niveau"
        DEBIT = "debit", "Débit"

    class Statut(models.TextChoices):
        """Statut logique (administratif)."""
        ACTIF = "actif", "Actif"
        INACTIF = "inactif", "Inactif"
        MAINTENANCE = "maintenance", "Maintenance"
        DESACTIVE = "desactive", "Désactivé"
        INCONNU = "inconnu", "Inconnu"

    class EtatConnexion(models.TextChoices):
        """État réseau temps-réel (déduit des heartbeats et mesures)."""
        JAMAIS_CONNECTE = "jamais_connecte", "Jamais connecté"
        EN_LIGNE = "en_ligne", "En ligne"
        HORS_LIGNE = "hors_ligne", "Hors ligne"
        EN_ERREUR = "en_erreur", "En erreur"

    UNITE_PAR_TYPE = {
        Type.NIVEAU: "cm",
        Type.DEBIT: "L/min",
    }

    # Durée après laquelle un capteur silencieux est considéré hors ligne
    DELAI_HORS_LIGNE_SECONDES = 120

    # ------------------------------------------------------------------
    # Identification
    # ------------------------------------------------------------------
    nom = models.CharField(max_length=100, unique=True, verbose_name="Nom")
    code = models.SlugField(
        max_length=50,
        unique=True,
        verbose_name="Code",
        help_text="Identifiant technique (a-z, 0-9, tirets). Utilisé dans le topic MQTT.",
    )
    type = models.CharField(max_length=20, choices=Type.choices, verbose_name="Type")

    # ------------------------------------------------------------------
    # Rattachement
    # ------------------------------------------------------------------
    reservoir = models.ForeignKey(
        Reservoir,
        on_delete=models.CASCADE,
        related_name="capteurs",
        verbose_name="Réservoir",
    )

    # ------------------------------------------------------------------
    # Technique / sécurité
    # ------------------------------------------------------------------
    unite = models.CharField(max_length=20, blank=True, verbose_name="Unité")
    topic_mqtt = models.CharField(
        max_length=200,
        unique=True,
        blank=True,
        verbose_name="Topic MQTT",
        help_text="Généré automatiquement si vide.",
    )
    adresse_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="Dernière adresse IP",
        help_text="Dernière IP connue du client MQTT (renseignée par le broker).",
    )
    firmware_version = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Version du firmware",
    )
    certificat_fingerprint = models.CharField(
        max_length=128,
        blank=True,
        verbose_name="Empreinte du certificat TLS",
        help_text="SHA-256 du certificat client utilisé pour l'authentification mutuelle.",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Métadonnées",
        help_text="Champs libres (modèle matériel, emplacement physique, etc.).",
    )

    # ------------------------------------------------------------------
    # Statut logique
    # ------------------------------------------------------------------
    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.ACTIF,
        verbose_name="Statut",
    )

    # ------------------------------------------------------------------
    # Suivi du cycle de vie IoT
    # ------------------------------------------------------------------
    en_ligne = models.BooleanField(
        default=False,
        verbose_name="En ligne",
        help_text="Raccourci booléen synchronisé avec etat_connexion.",
    )
    etat_connexion = models.CharField(
        max_length=20,
        choices=EtatConnexion.choices,
        default=EtatConnexion.JAMAIS_CONNECTE,
        verbose_name="État de connexion",
    )
    derniere_authentification = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Dernière authentification",
        help_text="Dernière authentification TLS réussie auprès du broker.",
    )
    derniere_connexion = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Dernière connexion",
        help_text="Dernière connexion MQTT établie (peut être antérieure à la dernière mesure).",
    )
    derniere_mesure = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Dernière mesure",
        help_text="Date de réception de la dernière mesure (horodatage serveur).",
    )
    derniere_erreur = models.TextField(
        blank=True,
        verbose_name="Dernière erreur",
        help_text="Dernier message d'erreur remonté par le client MQTT.",
    )
    nombre_mesures = models.PositiveBigIntegerField(
        default=0,
        verbose_name="Nombre total de mesures",
    )

    # ------------------------------------------------------------------
    # Traçabilité
    # ------------------------------------------------------------------
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Date de création")
    date_modification = models.DateTimeField(auto_now=True, verbose_name="Date de modification")

    class Meta:
        verbose_name = "Capteur"
        verbose_name_plural = "Capteurs"
        ordering = ["nom"]
        indexes = [
            models.Index(fields=["type"]),
            models.Index(fields=["statut"]),
            models.Index(fields=["etat_connexion"]),
            models.Index(fields=["reservoir", "type"]),
        ]

    def __str__(self):
        return f"{self.nom} [{self.get_type_display()}] · {self.reservoir.code}"

    # ------------------------------------------------------------------
    # Propriétés calculées
    # ------------------------------------------------------------------
    @property
    def est_actif(self) -> bool:
        """Un capteur est opérationnel s'il est actif ET en ligne."""
        return self.statut == self.Statut.ACTIF and self.en_ligne

    @property
    def secondes_depuis_derniere_mesure(self):
        """Nombre de secondes écoulées depuis la dernière mesure, ou None."""
        if self.derniere_mesure is None:
            return None
        return (timezone.now() - self.derniere_mesure).total_seconds()

    @property
    def est_silencieux(self) -> bool:
        """True si le capteur n'a rien envoyé depuis > DELAI_HORS_LIGNE."""
        delta = self.secondes_depuis_derniere_mesure
        return delta is not None and delta > self.DELAI_HORS_LIGNE_SECONDES

    def calculer_etat_connexion(self) -> str:
        """
        Déduit l'état de connexion à partir des horodatages connus.
        Utilisé par les services et par un futur endpoint d'état.
        """
        if self.statut == self.Statut.DESACTIVE:
            return self.EtatConnexion.HORS_LIGNE
        if self.derniere_connexion is None:
            return self.EtatConnexion.JAMAIS_CONNECTE
        if self.est_silencieux:
            return self.EtatConnexion.HORS_LIGNE
        return self.EtatConnexion.EN_LIGNE


class Mesure(models.Model):
    """
    Une mesure ponctuelle d'un capteur.

    Pour un capteur de niveau, des champs dérivés sont calculés
    automatiquement (volume, pourcentage, état qualitatif).
    """

    class EtatNiveau(models.TextChoices):
        CRITIQUE = "critique", "Critique"
        BAS = "bas", "Bas"
        NORMAL = "normal", "Normal"
        HAUT = "haut", "Haut"
        DEBORDEMENT = "debordement", "Débordement"

    capteur = models.ForeignKey(
        Capteur,
        on_delete=models.CASCADE,
        related_name="mesures",
        verbose_name="Capteur",
    )

    valeur = models.FloatField(verbose_name="Valeur")
    unite = models.CharField(max_length=20, verbose_name="Unité")

    volume_litres = models.FloatField(null=True, blank=True, verbose_name="Volume (L)")
    pourcentage_remplissage = models.FloatField(
        null=True, blank=True, verbose_name="Remplissage (%)"
    )
    etat_niveau = models.CharField(
        max_length=20,
        choices=EtatNiveau.choices,
        null=True,
        blank=True,
        verbose_name="État du niveau",
    )

    # `horodatage` = date de la mesure côté device (payload).
    # `date_reception` = date d'arrivée côté serveur (sécurité / audit).
    horodatage = models.DateTimeField(verbose_name="Horodatage")
    date_reception = models.DateTimeField(
        auto_now_add=True, verbose_name="Date de réception serveur"
    )
    payload_brut = models.JSONField(null=True, blank=True, verbose_name="Payload brut")

    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Date de création")

    class Meta:
        verbose_name = "Mesure"
        verbose_name_plural = "Mesures"
        ordering = ["-horodatage"]
        indexes = [
            models.Index(fields=["capteur", "-horodatage"]),
            models.Index(fields=["etat_niveau"]),
        ]

    def __str__(self):
        return f"{self.capteur.code} = {self.valeur} {self.unite} @ {self.horodatage:%Y-%m-%d %H:%M}"
"""
Commande : python manage.py demarrer_mqtt

Lance le client MQTT en avant-plan (bloquant).
À exécuter dans un conteneur/process dédié en production.
"""
import logging

from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand, CommandError

from communication_mqtt.client import ClientMQTT
from communication_mqtt.config import (
    charger_configuration,
    verifier_fichiers_tls,
)


class Command(BaseCommand):
    help = "Démarre le client MQTT (bloquant, Ctrl+C pour arrêter)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--verifier-seulement",
            action="store_true",
            help="Valide la configuration et les certificats, sans se connecter.",
        )

    def handle(self, *args, **options):
        # Logs colorés dans le terminal
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )

        # 1. Charger la config
        try:
            config = charger_configuration()
        except ImproperlyConfigured as e:
            raise CommandError(f"Configuration MQTT invalide : {e}")

        # 2. Vérifier les certificats
        erreurs = verifier_fichiers_tls(config)
        if erreurs:
            self.stderr.write(self.style.ERROR("Erreurs TLS :"))
            for e in erreurs:
                self.stderr.write(f"  - {e}")
            raise CommandError("Corrige les certificats avant de relancer.")

        # 3. Afficher la config validée
        self.stdout.write(self.style.SUCCESS("Configuration MQTT valide."))
        self.stdout.write(f"  Broker   : {config.host}:{config.port}")
        self.stdout.write(
            f"  TLS      : {'activé' if config.tls_active else 'désactivé'}"
        )
        self.stdout.write(f"  Client ID: {config.client_id}")
        for t in config.topics_abonnes:
            self.stdout.write(f"  Topic    : {t}")

        # 4. Mode "vérification seulement" ?
        if options["verifier_seulement"]:
            self.stdout.write(self.style.SUCCESS("Vérification terminée."))
            return

        # 5. Démarrage
        self.stdout.write(
            self.style.WARNING("Démarrage du client (Ctrl+C pour arrêter)...")
        )
        client = ClientMQTT(config)
        try:
            client.demarrer()
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\nArrêt en cours..."))
            client.arreter()
        self.stdout.write(self.style.SUCCESS("Client MQTT arrêté."))
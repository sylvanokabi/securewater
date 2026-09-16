"""
Tests de l'app communication_mqtt.

Aucun test ne se connecte réellement à un broker : on teste
uniquement la logique (parsing, routage, sécurité TLS).
"""
import json

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from capteurs import services as capteurs_services
from capteurs.models import Capteur
from reservoirs.models import Reservoir
from alertes.models import Alerte

from . import handlers
from .config import charger_configuration, verifier_fichiers_tls
from .securite_tls import construire_contexte_tls


# ==================================================================
# Configuration
# ==================================================================
class ConfigurationTests(TestCase):

    @override_settings(MQTT_CONFIG={
        "HOST": "broker.test", "PORT": 8883,
        "USERNAME": "u", "PASSWORD": "p",
    })
    def test_chargement_basique(self):
        cfg = charger_configuration()
        self.assertEqual(cfg.host, "broker.test")
        self.assertEqual(cfg.port, 8883)
        self.assertFalse(cfg.tls_active)

    @override_settings(MQTT_CONFIG=None)
    def test_erreur_si_config_absente(self):
        with self.assertRaises(ImproperlyConfigured):
            charger_configuration()

    @override_settings(MQTT_CONFIG={"PORT": 1883})
    def test_erreur_si_host_manquant(self):
        with self.assertRaises(ImproperlyConfigured):
            charger_configuration()

    @override_settings(MQTT_CONFIG={
        "HOST": "b", "PORT": 8883,
        "CA_CERT": "/tmp/inexistant_ca.crt",
        "CLIENT_CERT": "/tmp/inexistant_client.crt",
        "CLIENT_KEY": "/tmp/inexistant_client.key",
    })
    def test_verifier_fichiers_tls_erreurs(self):
        cfg = charger_configuration()
        erreurs = verifier_fichiers_tls(cfg)
        self.assertEqual(len(erreurs), 3)

    @override_settings(MQTT_CONFIG={"HOST": "b", "PORT": 8883})
    def test_topics_generes(self):
        cfg = charger_configuration()
        self.assertEqual(
            cfg.topic_mesures,
            "securewater/reservoirs/+/capteurs/+/mesures",
        )
        self.assertIn(cfg.topic_heartbeat, cfg.topics_abonnes)
        self.assertIn(cfg.topic_statut, cfg.topics_abonnes)


# ==================================================================
# Sécurité TLS
# ==================================================================
class SecuriteTLSTests(TestCase):

    @override_settings(MQTT_CONFIG={"HOST": "b", "PORT": 8883})
    def test_contexte_tls_none_si_pas_de_certificats(self):
        cfg = charger_configuration()
        self.assertIsNone(construire_contexte_tls(cfg))

    @override_settings(MQTT_CONFIG={
        "HOST": "b", "PORT": 8883,
        "CA_CERT": "/tmp/inexistant_ca.crt",
        "CLIENT_CERT": "/tmp/inexistant_cli.crt",
        "CLIENT_KEY": "/tmp/inexistant_cli.key",
    })
    def test_contexte_tls_erreur_si_fichiers_manquants(self):
        cfg = charger_configuration()
        with self.assertRaises(ImproperlyConfigured):
            construire_contexte_tls(cfg)


# ==================================================================
# Parsing de topic
# ==================================================================
class ParserTopicTests(TestCase):

    def test_topic_valide(self):
        r = handlers.parser_topic(
            "securewater/reservoirs/r1/capteurs/n1/mesures"
        )
        self.assertEqual(r, ("r1", "n1", "mesures"))

    def test_topic_trop_court(self):
        self.assertIsNone(handlers.parser_topic("securewater/reservoirs/r1"))

    def test_topic_mauvais_mot_cle(self):
        self.assertIsNone(
            handlers.parser_topic("securewater/zones/r1/capteurs/n1/mesures")
        )


# ==================================================================
# Handlers de messages
# ==================================================================
class HandlersTests(APITestCase):

    def setUp(self):
        self.reservoir = Reservoir.objects.create(
            nom="R1", code="r1",
            capacite_max_litres=1000, hauteur_max_cm=200,
        )
        self.capteur = Capteur.objects.create(
            nom="N1", code="n1", type="niveau", reservoir=self.reservoir,
            unite="cm",
            topic_mqtt="securewater/reservoirs/r1/capteurs/n1",
        )
        self.topic_mesure = "securewater/reservoirs/r1/capteurs/n1/mesures"
        self.topic_heartbeat = "securewater/reservoirs/r1/capteurs/n1/heartbeat"
        self.topic_statut = "securewater/reservoirs/r1/capteurs/n1/statut"

    def _payload(self, data):
        return json.dumps(data).encode("utf-8")

    # -----------------------------------------------------------
    # Mesures
    # -----------------------------------------------------------
    def test_mesure_valide(self):
        payload = self._payload({"valeur": 100.0})
        r = handlers.traiter_message(self.topic_mesure, payload)
        self.assertTrue(r.ok)
        self.assertEqual(r.canal, "mesures")
        self.capteur.refresh_from_db()
        self.assertEqual(self.capteur.nombre_mesures, 1)

    def test_mesure_declenche_alerte_si_critique(self):
        payload = self._payload({"valeur": 15.0})   # 7.5 % → critique
        r = handlers.traiter_message(self.topic_mesure, payload)
        self.assertTrue(r.ok)
        self.assertEqual(Alerte.objects.filter(statut="active").count(), 1)
        self.assertEqual(
            Alerte.objects.get(statut="active").type,
            Alerte.Type.NIVEAU_CRITIQUE_BAS,
        )

    def test_mesure_sans_valeur_refusee(self):
        payload = self._payload({"foo": "bar"})
        r = handlers.traiter_message(self.topic_mesure, payload)
        self.assertFalse(r.ok)
        self.assertIn("valeur", r.message)

    def test_mesure_valeur_negative_refusee(self):
        payload = self._payload({"valeur": -5.0})
        r = handlers.traiter_message(self.topic_mesure, payload)
        self.assertFalse(r.ok)

    def test_mesure_payload_json_invalide(self):
        r = handlers.traiter_message(self.topic_mesure, b"not-json")
        self.assertFalse(r.ok)
        self.assertIn("JSON", r.message)

    def test_mesure_horodatage_optionnel(self):
        payload = self._payload({
            "valeur": 50.0,
            "horodatage": "2025-01-15T10:00:00Z",
        })
        r = handlers.traiter_message(self.topic_mesure, payload)
        self.assertTrue(r.ok)

    # -----------------------------------------------------------
    # Heartbeat
    # -----------------------------------------------------------
    def test_heartbeat_marque_en_ligne(self):
        payload = self._payload({"adresse_ip": "10.0.0.5"})
        r = handlers.traiter_message(self.topic_heartbeat, payload)
        self.assertTrue(r.ok)
        self.capteur.refresh_from_db()
        self.assertTrue(self.capteur.en_ligne)
        self.assertEqual(self.capteur.adresse_ip, "10.0.0.5")

    # -----------------------------------------------------------
    # Statut (LWT)
    # -----------------------------------------------------------
    def test_statut_offline(self):
        capteurs_services.marquer_connexion(self.capteur)
        payload = self._payload({"en_ligne": False, "raison": "LWT"})
        r = handlers.traiter_message(self.topic_statut, payload)
        self.assertTrue(r.ok)
        self.capteur.refresh_from_db()
        self.assertFalse(self.capteur.en_ligne)
        self.assertEqual(self.capteur.derniere_erreur, "LWT")

    # -----------------------------------------------------------
    # Cas d'erreur
    # -----------------------------------------------------------
    def test_capteur_inconnu(self):
        topic = "securewater/reservoirs/xxx/capteurs/yyy/mesures"
        r = handlers.traiter_message(topic, self._payload({"valeur": 1}))
        self.assertFalse(r.ok)
        self.assertIn("inconnu", r.message.lower())

    def test_capteur_non_actif_refuse(self):
        Capteur.objects.filter(pk=self.capteur.pk).update(statut="inactif")
        r = handlers.traiter_message(
            self.topic_mesure, self._payload({"valeur": 50.0})
        )
        self.assertFalse(r.ok)
        self.assertIn("actif", r.message.lower())

    def test_canal_inconnu(self):
        topic = "securewater/reservoirs/r1/capteurs/n1/inconnu"
        r = handlers.traiter_message(topic, self._payload({}))
        self.assertFalse(r.ok)

    def test_topic_invalide(self):
        r = handlers.traiter_message("nimporte/quoi", self._payload({}))
        self.assertFalse(r.ok)
        self.assertIn("invalide", r.message.lower())

    def test_capteur_dun_autre_reservoir_non_touche(self):
        """Un message sur r2/n2 ne doit pas toucher le capteur r1/n1."""
        autre = Reservoir.objects.create(
            nom="R2", code="r2",
            capacite_max_litres=500, hauteur_max_cm=100,
        )
        capteur2 = Capteur.objects.create(
            nom="N2", code="n2", type="niveau", reservoir=autre,
            unite="cm",
            topic_mqtt="securewater/reservoirs/r2/capteurs/n2",
        )
        topic = "securewater/reservoirs/r2/capteurs/n2/mesures"
        r = handlers.traiter_message(topic, self._payload({"valeur": 50.0}))
        self.assertTrue(r.ok)
        capteur2.refresh_from_db()
        self.capteur.refresh_from_db()
        self.assertEqual(capteur2.nombre_mesures, 1)
        self.assertEqual(self.capteur.nombre_mesures, 0)   # r1/n1 non touché
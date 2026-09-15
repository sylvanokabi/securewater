from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from utilisateurs.models import Utilisateur
from reservoirs.models import Reservoir
from . import services
from .models import Capteur, Mesure


MDP = "MotDePasseTest123!"


def creer_reservoir():
    return Reservoir.objects.create(
        nom="R1", code="r1",
        capacite_max_litres=1000, hauteur_max_cm=200,
    )


def creer_capteur(reservoir, nom="Niveau 1", code="niveau-1", type="niveau"):
    return Capteur.objects.create(
        nom=nom, code=code, type=type, reservoir=reservoir,
        unite=Capteur.UNITE_PAR_TYPE.get(type, ""),
        topic_mqtt=f"securewater/reservoirs/{reservoir.code}/capteurs/{code}",
    )


class BaseCapteurTests(APITestCase):

    def creer_utilisateur(self, username, role):
        return Utilisateur.objects.create_user(
            username=username, email=f"{username}@test.com",
            password=MDP, role=role,
        )

    def token(self, email):
        r = self.client.post(
            "/api/auth/connexion/",
            {"email": email, "password": MDP},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        return r.data["access"]

    def authentifier(self, email):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token(email)}")


# ------------------------------------------------------------------
# CRUD capteur
# ------------------------------------------------------------------
class CRUDCapteurTests(BaseCapteurTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.authentifier("admin@test.com")
        self.reservoir = creer_reservoir()

    def test_creation_capteur_genere_topic_et_unite(self):
        r = self.client.post("/api/capteurs/", {
            "nom": "Niveau amont", "code": "niveau-amont",
            "type": "niveau", "reservoir": self.reservoir.id,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data["unite"], "cm")
        self.assertEqual(r.data["topic_mqtt"],
                         "securewater/reservoirs/r1/capteurs/niveau-amont")
        self.assertEqual(r.data["etat_connexion"], "jamais_connecte")
        self.assertEqual(r.data["nombre_mesures"], 0)

    def test_creation_avec_metadonnees(self):
        r = self.client.post("/api/capteurs/", {
            "nom": "Niveau X", "code": "niveau-x",
            "type": "niveau", "reservoir": self.reservoir.id,
            "adresse_ip": "10.0.0.42",
            "firmware_version": "1.2.3",
            "metadata": {"modele": "HC-SR04"},
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data["adresse_ip"], "10.0.0.42")
        self.assertEqual(r.data["firmware_version"], "1.2.3")
        self.assertEqual(r.data["metadata"]["modele"], "HC-SR04")

    def test_liste_capteurs_paginee(self):
        creer_capteur(self.reservoir, "N1", "n1")
        creer_capteur(self.reservoir, "N2", "n2", type="debit")
        r = self.client.get("/api/capteurs/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["count"], 2)

    def test_filtre_par_type(self):
        creer_capteur(self.reservoir, "N1", "n1")
        creer_capteur(self.reservoir, "D1", "d1", type="debit")
        r = self.client.get("/api/capteurs/?type=niveau")
        self.assertEqual(r.data["count"], 1)

    def test_filtre_par_etat_connexion(self):
        creer_capteur(self.reservoir, "N1", "n1")
        r = self.client.get("/api/capteurs/?etat_connexion=jamais_connecte")
        self.assertEqual(r.data["count"], 1)

    def test_suppression_capteur(self):
        capteur = creer_capteur(self.reservoir)
        r = self.client.delete(f"/api/capteurs/{capteur.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------
# Mesures via service
# ------------------------------------------------------------------
class MesureServiceTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def test_enregistrer_mesure_calcule_les_derives(self):
        mesure = services.enregistrer_mesure(capteur=self.capteur, valeur=100.0)
        self.assertEqual(mesure.volume_litres, 500.0)
        self.assertEqual(mesure.pourcentage_remplissage, 50.0)
        self.assertEqual(mesure.etat_niveau, "normal")

    def test_mise_a_jour_du_capteur_apres_mesure(self):
        self.assertFalse(self.capteur.en_ligne)
        self.assertIsNone(self.capteur.derniere_mesure)
        self.assertEqual(self.capteur.nombre_mesures, 0)

        services.enregistrer_mesure(capteur=self.capteur, valeur=80.0)

        self.capteur.refresh_from_db()
        self.assertTrue(self.capteur.en_ligne)
        self.assertIsNotNone(self.capteur.derniere_mesure)
        self.assertEqual(self.capteur.nombre_mesures, 1)
        self.assertEqual(self.capteur.etat_connexion, "en_ligne")

    def test_compteur_mesures_incremente(self):
        for i in range(3):
            services.enregistrer_mesure(capteur=self.capteur, valeur=50.0 + i)
        self.capteur.refresh_from_db()
        self.assertEqual(self.capteur.nombre_mesures, 3)

    def test_valeur_negative_refusee(self):
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            services.enregistrer_mesure(capteur=self.capteur, valeur=-5.0)


# ------------------------------------------------------------------
# Cycle de vie IoT (auth / connexion / heartbeat / déconnexion)
# ------------------------------------------------------------------
class CycleVieIoTServiceTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def test_marquer_authentification(self):
        services.marquer_authentification(
            self.capteur, adresse_ip="10.0.0.5",
            certificat_fingerprint="abc123",
        )
        self.capteur.refresh_from_db()
        self.assertIsNotNone(self.capteur.derniere_authentification)
        self.assertEqual(self.capteur.adresse_ip, "10.0.0.5")
        self.assertEqual(self.capteur.certificat_fingerprint, "abc123")
        # Pas encore en ligne tant qu'il n'y a pas de connexion
        self.assertFalse(self.capteur.en_ligne)

    def test_marquer_connexion(self):
        services.marquer_connexion(
            self.capteur, adresse_ip="10.0.0.6", firmware_version="2.0.0"
        )
        self.capteur.refresh_from_db()
        self.assertTrue(self.capteur.en_ligne)
        self.assertEqual(self.capteur.etat_connexion, "en_ligne")
        self.assertEqual(self.capteur.adresse_ip, "10.0.0.6")
        self.assertEqual(self.capteur.firmware_version, "2.0.0")

    def test_marquer_deconnexion(self):
        services.marquer_connexion(self.capteur)
        services.marquer_deconnexion(self.capteur, raison="LWT")
        self.capteur.refresh_from_db()
        self.assertFalse(self.capteur.en_ligne)
        self.assertEqual(self.capteur.etat_connexion, "hors_ligne")
        self.assertEqual(self.capteur.derniere_erreur, "LWT")

    def test_marquer_erreur(self):
        services.marquer_erreur(self.capteur, message="Certificat expiré")
        self.capteur.refresh_from_db()
        self.assertEqual(self.capteur.etat_connexion, "en_erreur")
        self.assertIn("expiré", self.capteur.derniere_erreur)

    def test_heartbeat(self):
        services.traiter_heartbeat(self.capteur, adresse_ip="10.0.0.9")
        self.capteur.refresh_from_db()
        self.assertTrue(self.capteur.en_ligne)
        self.assertIsNotNone(self.capteur.derniere_connexion)

    def test_rafraichir_etats_connexion_detecte_silencieux(self):
        services.marquer_connexion(self.capteur)
        # Simule une dernière mesure très ancienne
        Capteur.objects.filter(pk=self.capteur.pk).update(
            derniere_mesure=timezone.now() - timedelta(hours=1)
        )
        n = services.rafraichir_etats_connexion()
        self.assertEqual(n, 1)

        self.capteur.refresh_from_db()
        self.assertFalse(self.capteur.en_ligne)
        self.assertEqual(self.capteur.etat_connexion, "hors_ligne")

    def test_calculer_etat_connexion_jamais_connecte(self):
        etat = services.calculer_etat_connexion_courant(self.capteur)
        self.assertEqual(etat["etat"], "jamais_connecte")
        self.assertFalse(etat["en_ligne"])


# ------------------------------------------------------------------
# Endpoints cycle de vie
# ------------------------------------------------------------------
class CycleVieIoTEndpointsTests(BaseCapteurTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.authentifier("admin@test.com")
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def test_endpoint_authentifier(self):
        r = self.client.post(
            f"/api/capteurs/{self.capteur.id}/authentifier/",
            {"adresse_ip": "10.0.0.1", "certificat_fingerprint": "xx"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIsNotNone(r.data["derniere_authentification"])

    def test_endpoint_connecter(self):
        r = self.client.post(
            f"/api/capteurs/{self.capteur.id}/connecter/",
            {"adresse_ip": "10.0.0.2", "firmware_version": "1.0.0"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data["en_ligne"])
        self.assertEqual(r.data["firmware_version"], "1.0.0")

    def test_endpoint_deconnecter(self):
        services.marquer_connexion(self.capteur)
        r = self.client.post(
            f"/api/capteurs/{self.capteur.id}/deconnecter/",
            {"raison": "Client parti"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertFalse(r.data["en_ligne"])

    def test_endpoint_heartbeat(self):
        r = self.client.post(
            f"/api/capteurs/{self.capteur.id}/heartbeat/",
            {"adresse_ip": "10.0.0.3"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data["en_ligne"])

    def test_endpoint_etat(self):
        r = self.client.get(f"/api/capteurs/{self.capteur.id}/etat/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["etat"], "jamais_connecte")
        self.assertEqual(r.data["nombre_mesures"], 0)
        self.assertIsNone(r.data["secondes_depuis_derniere_mesure"])


# ------------------------------------------------------------------
# Endpoints mesures
# ------------------------------------------------------------------
class MesuresEndpointsTests(BaseCapteurTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.authentifier("admin@test.com")
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

        base = timezone.now()
        for i in range(5):
            services.enregistrer_mesure(
                capteur=self.capteur,
                valeur=50.0 + i * 10,
                horodatage=base - timedelta(minutes=10 - i),
            )

    def test_liste_mesures(self):
        r = self.client.get(f"/api/capteurs/{self.capteur.id}/mesures/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["count"], 5)

    def test_derniere_mesure(self):
        r = self.client.get(f"/api/capteurs/{self.capteur.id}/derniere-mesure/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["valeur"], 90.0)

    def test_derniere_mesure_404_si_aucune(self):
        capteur_vide = creer_capteur(self.reservoir, nom="Vide", code="vide")
        r = self.client.get(f"/api/capteurs/{capteur_vide.id}/derniere-mesure/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)


# ------------------------------------------------------------------
# Permissions
# ------------------------------------------------------------------
class PermissionsCapteurTests(BaseCapteurTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.creer_utilisateur("operateur", Utilisateur.Role.OPERATEUR)
        self.creer_utilisateur("observateur", Utilisateur.Role.OBSERVATEUR)
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def test_observateur_ne_peut_pas_creer(self):
        self.authentifier("observateur@test.com")
        r = self.client.post("/api/capteurs/", {
            "nom": "X", "code": "x", "type": "niveau",
            "reservoir": self.reservoir.id,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)

    def test_observateur_peut_lire(self):
        self.authentifier("observateur@test.com")
        r = self.client.get("/api/capteurs/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    def test_anonyme_refuse(self):
        r = self.client.get("/api/capteurs/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
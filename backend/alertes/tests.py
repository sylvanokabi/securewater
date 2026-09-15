from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from capteurs import services as capteurs_services
from capteurs.models import Capteur
from reservoirs.models import Reservoir
from utilisateurs.models import Utilisateur
from . import services
from .models import Alerte


MDP = "MotDePasseTest123!"


def creer_reservoir(**extra):
    defaults = {"nom": "R1", "code": "r1", "capacite_max_litres": 1000, "hauteur_max_cm": 200}
    defaults.update(extra)
    return Reservoir.objects.create(**defaults)


def creer_capteur(reservoir, nom="N1", code="n1", type="niveau"):
    return Capteur.objects.create(
        nom=nom, code=code, type=type, reservoir=reservoir,
        unite=Capteur.UNITE_PAR_TYPE.get(type, ""),
        topic_mqtt=f"securewater/reservoirs/{reservoir.code}/capteurs/{code}",
    )


class BaseAlerteTests(APITestCase):

    def creer_utilisateur(self, username, role):
        return Utilisateur.objects.create_user(
            username=username, email=f"{username}@test.com",
            password=MDP, role=role,
        )

    def token(self, email):
        r = self.client.post(
            "/api/auth/connexion/", {"email": email, "password": MDP},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        return r.data["access"]

    def authentifier(self, email):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token(email)}")


# ==================================================================
# Modèle
# ==================================================================
class AlerteModeleTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def test_unicite_alerte_active_par_capteur_type(self):
        services.declencher_alerte(
            type=Alerte.Type.NIVEAU_CRITIQUE_BAS,
            message="m1", capteur=self.capteur,
        )
        # Deuxième appel → retourne l'alerte existante
        a2 = services.declencher_alerte(
            type=Alerte.Type.NIVEAU_CRITIQUE_BAS,
            message="m2", capteur=self.capteur,
        )
        self.assertEqual(Alerte.objects.filter(statut="active").count(), 1)

    def test_deux_alertes_actives_meme_capteur_types_differents(self):
        services.declencher_alerte(
            type=Alerte.Type.NIVEAU_CRITIQUE_BAS,
            message="m1", capteur=self.capteur,
        )
        services.declencher_alerte(
            type=Alerte.Type.CAPTEUR_HORS_LIGNE,
            message="m2", capteur=self.capteur,
        )
        self.assertEqual(Alerte.objects.filter(statut="active").count(), 2)

    def test_gravite_auto_par_type(self):
        a = services.declencher_alerte(
            type=Alerte.Type.DEBORDEMENT,
            message="m", capteur=self.capteur,
        )
        self.assertEqual(a.gravite, Alerte.Gravite.CRITIQUE)

        b = services.declencher_alerte(
            type=Alerte.Type.NIVEAU_BAS,
            message="m", capteur=self.capteur,
        )
        self.assertEqual(b.gravite, Alerte.Gravite.AVERTISSEMENT)


# ==================================================================
# Service — analyse de mesure
# ==================================================================
class AnalyseMesureTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir()      # 200 cm, 1000 L
        self.capteur = creer_capteur(self.reservoir)

    def _creer_mesure(self, valeur):
        return capteurs_services.enregistrer_mesure(
            capteur=self.capteur, valeur=valeur
        )

    def test_mesure_normale_ne_cree_pas_alerte(self):
        self._creer_mesure(100.0)   # 50 %
        self.assertEqual(Alerte.objects.count(), 0)

    def test_mesure_critique_bas_declenche_alerte(self):
        self._creer_mesure(15.0)    # 7.5 %
        a = Alerte.objects.get(statut="active")
        self.assertEqual(a.type, Alerte.Type.NIVEAU_CRITIQUE_BAS)
        self.assertEqual(a.gravite, Alerte.Gravite.CRITIQUE)

    def test_mesure_niveau_bas_declenche_alerte_avertissement(self):
        self._creer_mesure(40.0)    # 20 %
        a = Alerte.objects.get(statut="active")
        self.assertEqual(a.type, Alerte.Type.NIVEAU_BAS)

    def test_mesure_debordement_declenche_alerte_critique(self):
        self._creer_mesure(195.0)   # 97.5 %
        a = Alerte.objects.get(statut="active")
        self.assertEqual(a.type, Alerte.Type.DEBORDEMENT)

    def test_escalade_critique_resolve_alerte_bas(self):
        self._creer_mesure(40.0)    # niveau bas → alerte
        self._creer_mesure(15.0)    # critique bas → escalade
        actives = Alerte.objects.filter(statut="active")
        self.assertEqual(actives.count(), 1)
        self.assertEqual(actives.first().type, Alerte.Type.NIVEAU_CRITIQUE_BAS)

        resolues = Alerte.objects.filter(statut="resolue")
        self.assertEqual(resolues.count(), 1)
        self.assertTrue(resolues.first().resolution_auto)

    def test_retour_a_normal_resout_alerte(self):
        self._creer_mesure(15.0)    # critique
        self._creer_mesure(100.0)   # retour normal
        self.assertEqual(Alerte.objects.filter(statut="active").count(), 0)
        self.assertEqual(Alerte.objects.filter(statut="resolue").count(), 1)

    def test_pas_de_doublons_sur_mesures_repetees(self):
        for _ in range(5):
            self._creer_mesure(15.0)
        self.assertEqual(Alerte.objects.filter(statut="active").count(), 1)

    def test_mesure_debit_nanalyse_pas_seuils(self):
        capteur_debit = creer_capteur(
            self.reservoir, nom="D1", code="d1", type="debit"
        )
        capteurs_services.enregistrer_mesure(capteur=capteur_debit, valeur=10.0)
        self.assertEqual(Alerte.objects.count(), 0)


# ==================================================================
# Service — cycle de vie
# ==================================================================
class CycleVieAlerteTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)
        self.utilisateur = Utilisateur.objects.create_user(
            username="admin", email="admin@test.com",
            password=MDP, role=Utilisateur.Role.ADMINISTRATEUR,
        )

    def test_acquitter_alerte(self):
        a = services.declencher_alerte(
            type=Alerte.Type.NIVEAU_CRITIQUE_BAS,
            message="m", capteur=self.capteur,
        )
        services.acquitter_alerte(a, utilisateur=self.utilisateur)
        a.refresh_from_db()
        self.assertEqual(a.statut, Alerte.Statut.ACQUITTEE)
        self.assertEqual(a.acquittee_par, self.utilisateur)
        self.assertIsNotNone(a.date_acquittement)

    def test_acquitter_alerte_resolue_refuse(self):
        from rest_framework.exceptions import ValidationError
        a = services.declencher_alerte(
            type=Alerte.Type.NIVEAU_CRITIQUE_BAS,
            message="m", capteur=self.capteur,
        )
        services.resoudre_alerte(a, utilisateur=self.utilisateur)
        with self.assertRaises(ValidationError):
            services.acquitter_alerte(a, utilisateur=self.utilisateur)

    def test_resoudre_alerte_auto(self):
        a = services.declencher_alerte(
            type=Alerte.Type.NIVEAU_BAS, message="m", capteur=self.capteur,
        )
        services.resoudre_alerte(a, auto=True)
        a.refresh_from_db()
        self.assertEqual(a.statut, Alerte.Statut.RESOLUE)
        self.assertTrue(a.resolution_auto)


# ==================================================================
# Service — détection capteurs silencieux
# ==================================================================
class DetectionAnomaliesTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def test_capteur_jamais_connecte_pas_alerte(self):
        stats = services.detecter_anomalies_capteurs()
        self.assertEqual(stats["hors_ligne"], 0)

    def test_capteur_silencieux_declenche_alerte(self):
        # Simule un capteur qui s'est connecté il y a 1h, sans mesure depuis
        ancien = timezone.now() - timedelta(hours=1)
        Capteur.objects.filter(pk=self.capteur.pk).update(
            derniere_connexion=ancien,
            derniere_mesure=ancien,
            en_ligne=True,
            etat_connexion=Capteur.EtatConnexion.EN_LIGNE,
        )
        stats = services.detecter_anomalies_capteurs()
        self.assertEqual(stats["hors_ligne"], 1)
        a = Alerte.objects.get(statut="active")
        self.assertEqual(a.type, Alerte.Type.CAPTEUR_HORS_LIGNE)

    def test_capteur_en_erreur_declenche_alerte(self):
        Capteur.objects.filter(pk=self.capteur.pk).update(
            etat_connexion=Capteur.EtatConnexion.EN_ERREUR,
            derniere_erreur="Certificat expiré",
        )
        stats = services.detecter_anomalies_capteurs()
        self.assertEqual(stats["erreur"], 1)
        a = Alerte.objects.get(statut="active")
        self.assertEqual(a.type, Alerte.Type.ERREUR_CAPTEUR)

    def test_capteur_inactif_ignore(self):
        Capteur.objects.filter(pk=self.capteur.pk).update(
            statut=Capteur.Statut.INACTIF,
            derniere_connexion=timezone.now() - timedelta(hours=1),
        )
        stats = services.detecter_anomalies_capteurs()
        self.assertEqual(stats["hors_ligne"], 0)

    def test_une_mesure_resout_alerte_hors_ligne(self):
        # Crée une alerte hors ligne
        services.signaler_capteur_hors_ligne(self.capteur)
        self.assertEqual(Alerte.objects.filter(statut="active").count(), 1)

        # Une mesure arrive → le signal post_save appelle analyser_mesure
        capteurs_services.enregistrer_mesure(capteur=self.capteur, valeur=100.0)

        self.assertEqual(Alerte.objects.filter(statut="active").count(), 0)
        self.assertEqual(Alerte.objects.filter(statut="resolue").count(), 1)


# ==================================================================
# Endpoints HTTP
# ==================================================================
class AlertesEndpointsTests(BaseAlerteTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.authentifier("admin@test.com")
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)

    def _creer_alerte(self, type=Alerte.Type.NIVEAU_CRITIQUE_BAS):
        return services.declencher_alerte(
            type=type, message="msg test", capteur=self.capteur,
        )

    def test_liste_paginee(self):
        self._creer_alerte()
        self._creer_alerte(Alerte.Type.CAPTEUR_HORS_LIGNE)
        r = self.client.get("/api/alertes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["count"], 2)

    def test_filtre_par_gravite(self):
        self._creer_alerte(Alerte.Type.NIVEAU_CRITIQUE_BAS)   # critique
        self._creer_alerte(Alerte.Type.NIVEAU_BAS)            # avertissement
        r = self.client.get("/api/alertes/?gravite=critique")
        self.assertEqual(r.data["count"], 1)

    def test_detail(self):
        a = self._creer_alerte()
        r = self.client.get(f"/api/alertes/{a.id}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["type"], "niveau_critique_bas")

    def test_acquitter_endpoint(self):
        a = self._creer_alerte()
        r = self.client.post(f"/api/alertes/{a.id}/acquitter/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["statut"], "acquittee")

    def test_resoudre_endpoint(self):
        a = self._creer_alerte()
        r = self.client.post(f"/api/alertes/{a.id}/resoudre/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["statut"], "resolue")

    def test_creation_manuelle(self):
        r = self.client.post("/api/alertes/manuel/", {
            "type": "manuelle",
            "gravite": "critique",
            "message": "Fuite détectée manuellement",
            "capteur": self.capteur.id,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data["type"], "manuelle")

    def test_creation_manuelle_sans_cible_refusee(self):
        r = self.client.post("/api/alertes/manuel/", {
            "message": "Alerte orpheline",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

    def test_statistiques(self):
        self._creer_alerte(Alerte.Type.NIVEAU_CRITIQUE_BAS)   # critique
        self._creer_alerte(Alerte.Type.NIVEAU_BAS)            # avertissement
        r = self.client.get("/api/alertes/statistiques/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["total_actives"], 2)
        self.assertEqual(r.data["par_gravite"]["critique"], 1)
        self.assertEqual(r.data["par_gravite"]["avertissement"], 1)


# ==================================================================
# Permissions
# ==================================================================
class PermissionsAlerteTests(BaseAlerteTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.creer_utilisateur("operateur", Utilisateur.Role.OPERATEUR)
        self.creer_utilisateur("observateur", Utilisateur.Role.OBSERVATEUR)
        self.reservoir = creer_reservoir()
        self.capteur = creer_capteur(self.reservoir)
        self.alerte = services.declencher_alerte(
            type=Alerte.Type.NIVEAU_CRITIQUE_BAS,
            message="m", capteur=self.capteur,
        )

    def test_observateur_peut_lire(self):
        self.authentifier("observateur@test.com")
        r = self.client.get("/api/alertes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_observateur_ne_peut_pas_acquitter(self):
        self.authentifier("observateur@test.com")
        r = self.client.post(f"/api/alertes/{self.alerte.id}/acquitter/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)

    def test_operateur_peut_acquitter(self):
        self.authentifier("operateur@test.com")
        r = self.client.post(f"/api/alertes/{self.alerte.id}/acquitter/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    def test_anonyme_refuse(self):
        r = self.client.get("/api/alertes/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
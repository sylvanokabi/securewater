from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from utilisateurs.models import Utilisateur
from reservoirs.models import Reservoir


MDP = "MotDePasseTest123!"


class SimulationAPITests(APITestCase):

    def setUp(self):
        # Réservoir de test
        Reservoir.objects.create(
            nom="R1", code="r1",
            capacite_max_litres=1000, hauteur_max_cm=200,
        )

        self.admin = Utilisateur.objects.create_user(
            username="admin", email="admin@test.com",
            password=MDP, role=Utilisateur.Role.ADMINISTRATEUR,
        )
        self.observateur = Utilisateur.objects.create_user(
            username="obs", email="obs@test.com",
            password=MDP, role=Utilisateur.Role.OBSERVATEUR,
        )

    def _token(self, email):
        r = self.client.post(
            "/api/auth/connexion/",
            {"email": email, "password": MDP},
            format="json",
        )
        return r.data["access"]

    def _authentifier(self, email):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._token(email)}")

    @patch("simulation.services.subprocess.Popen")
    def test_admin_peut_demarrer(self, mock_popen):
        mock_proc = mock_popen.return_value
        mock_proc.pid = 12345
        mock_proc.poll.return_value = None

        self._authentifier("admin@test.com")
        r = self.client.post("/api/simulation/demarrer/", {
            "reservoir": "r1",
            "scenario": "normal",
            "capteurs": 1,
            "avec_debit": False,
            "intervalle": 3.0,
        }, format="json")

        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertTrue(r.data["en_cours"])
        self.assertEqual(r.data["pid"], 12345)

    def test_observateur_ne_peut_pas_demarrer(self):
        self._authentifier("obs@test.com")
        r = self.client.post("/api/simulation/demarrer/", {
            "reservoir": "r1",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_observateur_peut_voir_etat(self):
        self._authentifier("obs@test.com")
        r = self.client.get("/api/simulation/etat/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_anonyme_refuse(self):
        r = self.client.get("/api/simulation/etat/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reservoir_inexistant_refuse(self):
        self._authentifier("admin@test.com")
        r = self.client.post("/api/simulation/demarrer/", {
            "reservoir": "nope",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
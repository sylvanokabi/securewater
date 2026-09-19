from rest_framework import status
from rest_framework.test import APITestCase

from utilisateurs.models import Utilisateur


MDP = "MotDePasseTest123!"


class DemonstrationTests(APITestCase):

    def setUp(self):
        self.user = Utilisateur.objects.create_user(
            username="test", email="test@test.com",
            password=MDP, role=Utilisateur.Role.OBSERVATEUR,
        )

    def _authentifier(self):
        r = self.client.post(
            "/api/auth/connexion/",
            {"email": "test@test.com", "password": MDP},
            format="json",
        )
        token = r.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_anonyme_refuse(self):
        r = self.client.get("/api/demonstration/mqtt/stats/")
        self.assertEqual(r.status_code, 401)

    def test_stats_accessibles(self):
        self._authentifier()
        r = self.client.get("/api/demonstration/mqtt/stats/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("messages_recus", r.data)

    def test_scenarios_listes(self):
        self._authentifier()
        r = self.client.get("/api/demonstration/scenarios/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 5)

    def test_certificats_lisibles(self):
        self._authentifier()
        r = self.client.get("/api/demonstration/certificats/")
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.data, list)

    def test_journal_vide_au_depart(self):
        self._authentifier()
        r = self.client.get("/api/demonstration/journal/")
        self.assertEqual(r.status_code, 200)
        #self.assertEqual(len(r.data), 0)
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Utilisateur


MDP = "MotDePasseTest123!"


class InscriptionTests(APITestCase):

    def test_inscription_utilisateur(self):
        response = self.client.post(
            "/api/auth/inscription/",
            {
                "username": "jeremie",
                "email": "jeremie@example.com",
                "password": MDP,
                "password_confirm": MDP,
                "first_name": "Jeremie",
                "last_name": "Test",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(Utilisateur.objects.filter(username="jeremie").exists())


class AuthentificationJWTTests(APITestCase):

    def setUp(self):
        self.utilisateur = Utilisateur.objects.create_user(
            username="jeremie",
            email="jeremie@example.com",
            password=MDP,
            role=Utilisateur.Role.OBSERVATEUR,
        )
        # Garde-fou : le mot de passe doit être correctement haché
        assert self.utilisateur.check_password(MDP)

    def _login(self):
        """USERNAME_FIELD = 'email' → on envoie email + password."""
        return self.client.post(
            "/api/auth/connexion/",
            {"email": "jeremie@example.com", "password": MDP},
            format="json",
        )

    def obtenir_access_token(self):
        response = self._login()
        self.assertEqual(response.status_code, 200, response.data)  # ← affiche l'erreur si échec
        return response.data["access"]

    def test_connexion_retourne_tokens(self):
        response = self._login()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("utilisateur", response.data)
        self.assertEqual(response.data["utilisateur"]["email"], "jeremie@example.com")

    def test_mauvais_mot_de_passe(self):
        response = self.client.post(
            "/api/auth/connexion/",
            {"email": "jeremie@example.com", "password": "MauvaisMotDePasse"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, response.data)

    def test_acces_profil_sans_token(self):
        response = self.client.get("/api/auth/profil/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_acces_profil_avec_token(self):
        access = self.obtenir_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/auth/profil/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["username"], "jeremie")

    def test_rafraichissement_token(self):
        refresh = self._login().data["refresh"]
        response = self.client.post(
            "/api/auth/rafraichir/",
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)


class PermissionsJWTTests(APITestCase):

    def setUp(self):
        Utilisateur.objects.create_user(
            username="observateur",
            email="observateur@example.com",
            password=MDP,
            role=Utilisateur.Role.OBSERVATEUR,
        )
        Utilisateur.objects.create_user(
            username="admin",
            email="admin@example.com",
            password=MDP,
            role=Utilisateur.Role.ADMINISTRATEUR,
        )

    def obtenir_access_token(self, email, password):
        response = self.client.post(
            "/api/auth/connexion/",
            {"email": email, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["access"]

    def test_observateur_ne_peut_pas_lister_utilisateurs(self):
        token = self.obtenir_access_token("observateur@example.com", MDP)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/utilisateurs/")          # ← corrigé
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)

    def test_admin_peut_lister_utilisateurs(self):
        token = self.obtenir_access_token("admin@example.com", MDP)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/utilisateurs/")   # ← URL corrigée
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)


class GestionUtilisateurTests(APITestCase):

    def setUp(self):
        Utilisateur.objects.create_user(
            username="admin",
            email="admin@example.com",
            password=MDP,
            role=Utilisateur.Role.ADMINISTRATEUR,
        )
        self.utilisateur = Utilisateur.objects.create_user(
            username="user",
            email="user@example.com",
            password=MDP,
            role=Utilisateur.Role.OBSERVATEUR,
        )

    def obtenir_token_admin(self):
        response = self.client.post(
            "/api/auth/connexion/",
            {"email": "admin@example.com", "password": MDP},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["access"]

    def test_desactivation_utilisateur(self):
        token = self.obtenir_token_admin()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.patch(
            f"/api/utilisateurs/{self.utilisateur.id}/desactiver/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.utilisateur.refresh_from_db()
        self.assertFalse(self.utilisateur.actif)
        self.assertFalse(self.utilisateur.is_active)

    def test_activation_utilisateur(self):
        self.utilisateur.actif = False
        self.utilisateur.is_active = False
        self.utilisateur.save()

        token = self.obtenir_token_admin()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.patch(
            f"/api/utilisateurs/{self.utilisateur.id}/activer/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.utilisateur.refresh_from_db()
        self.assertTrue(self.utilisateur.actif)
        self.assertTrue(self.utilisateur.is_active)
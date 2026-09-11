from rest_framework import status
from rest_framework.test import APITestCase

from utilisateurs.models import Utilisateur
from .models import Reservoir


MDP = "MotDePasseTest123!"


def creer_reservoir(nom="R1", code="r1", **extra):
    defaults = {
        "capacite_max_litres": 1000.0,
        "hauteur_max_cm": 200.0,
    }
    defaults.update(extra)
    return Reservoir.objects.create(nom=nom, code=code, **defaults)


class BaseReservoirTests(APITestCase):
    """Helpers pour créer des utilisateurs et récupérer un token."""

    def creer_utilisateur(self, username, role):
        return Utilisateur.objects.create_user(
            username=username,
            email=f"{username}@test.com",
            password=MDP,
            role=role,
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
# CRUD basique (admin)
# ------------------------------------------------------------------
class CRUDReservoirTests(BaseReservoirTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.authentifier("admin@test.com")

    def test_creation_reservoir(self):
        r = self.client.post("/api/reservoirs/", {
            "nom": "Réservoir principal",
            "code": "principal",
            "capacite_max_litres": 5000,
            "hauteur_max_cm": 300,
            "localisation": "Kinshasa",
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data["code"], "principal")
        self.assertEqual(Reservoir.objects.count(), 1)

    def test_liste_reservoirs(self):
        creer_reservoir("R1", "r1")
        creer_reservoir("R2", "r2")
        r = self.client.get("/api/reservoirs/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["count"], 2)

    def test_detail_reservoir(self):
        reservoir = creer_reservoir("R1", "r1")
        r = self.client.get(f"/api/reservoirs/{reservoir.id}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["nom"], "R1")

    def test_modification_reservoir(self):
        reservoir = creer_reservoir("R1", "r1")
        r = self.client.patch(
            f"/api/reservoirs/{reservoir.id}/",
            {"capacite_max_litres": 2500},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        reservoir.refresh_from_db()
        self.assertEqual(reservoir.capacite_max_litres, 2500)

    def test_suppression_reservoir(self):
        reservoir = creer_reservoir("R1", "r1")
        r = self.client.delete(f"/api/reservoirs/{reservoir.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Reservoir.objects.filter(id=reservoir.id).exists())

    def test_code_non_modifiable(self):
        reservoir = creer_reservoir("R1", "r1")
        r = self.client.patch(
            f"/api/reservoirs/{reservoir.id}/",
            {"code": "autre-code"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)


# ------------------------------------------------------------------
# Validations métier
# ------------------------------------------------------------------
class ValidationReservoirTests(BaseReservoirTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.authentifier("admin@test.com")

    def test_seuils_incoherents_refuses(self):
        r = self.client.post("/api/reservoirs/", {
            "nom": "R1", "code": "r1",
            "capacite_max_litres": 1000, "hauteur_max_cm": 100,
            "seuil_critique_bas": 50,   # incohérent
            "seuil_alerte_bas": 20,
            "seuil_alerte_haut": 90,
            "seuil_critique_haut": 95,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

    def test_capacite_negative_refusee(self):
        r = self.client.post("/api/reservoirs/", {
            "nom": "R1", "code": "r1",
            "capacite_max_litres": -100,
            "hauteur_max_cm": 100,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

    def test_code_unique(self):
        creer_reservoir("R1", "r1")
        r = self.client.post("/api/reservoirs/", {
            "nom": "R2", "code": "r1",
            "capacite_max_litres": 1000, "hauteur_max_cm": 100,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

    def test_nom_unique(self):
        creer_reservoir("R1", "r1")
        r = self.client.post("/api/reservoirs/", {
            "nom": "R1", "code": "r2",
            "capacite_max_litres": 1000, "hauteur_max_cm": 100,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)


# ------------------------------------------------------------------
# Permissions
# ------------------------------------------------------------------
class PermissionsReservoirTests(BaseReservoirTests):

    def setUp(self):
        self.creer_utilisateur("admin", Utilisateur.Role.ADMINISTRATEUR)
        self.creer_utilisateur("operateur", Utilisateur.Role.OPERATEUR)
        self.creer_utilisateur("observateur", Utilisateur.Role.OBSERVATEUR)
        self.reservoir = creer_reservoir("R1", "r1")

    def test_observateur_ne_peut_pas_creer(self):
        self.authentifier("observateur@test.com")
        r = self.client.post("/api/reservoirs/", {
            "nom": "R2", "code": "r2",
            "capacite_max_litres": 1000, "hauteur_max_cm": 100,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)

    def test_operateur_peut_creer(self):
        self.authentifier("operateur@test.com")
        r = self.client.post("/api/reservoirs/", {
            "nom": "R2", "code": "r2",
            "capacite_max_litres": 1000, "hauteur_max_cm": 100,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_operateur_ne_peut_pas_supprimer(self):
        self.authentifier("operateur@test.com")
        r = self.client.delete(f"/api/reservoirs/{self.reservoir.id}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)

    def test_observateur_peut_lire(self):
        self.authentifier("observateur@test.com")
        r = self.client.get("/api/reservoirs/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    def test_anonyme_ne_peut_pas_lire(self):
        r = self.client.get("/api/reservoirs/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


# ------------------------------------------------------------------
# Helpers métier
# ------------------------------------------------------------------
class HelpersMetierTests(APITestCase):

    def setUp(self):
        self.reservoir = creer_reservoir(
            "R1", "r1",
            capacite_max_litres=1000,
            hauteur_max_cm=200,
        )

    def test_calcul_volume(self):
        from .services import calculer_volume_litres
        self.assertEqual(calculer_volume_litres(self.reservoir, 100), 500.0)
        self.assertEqual(calculer_volume_litres(self.reservoir, 200), 1000.0)
        self.assertEqual(calculer_volume_litres(self.reservoir, 300), 1000.0)  # plafonné
        self.assertEqual(calculer_volume_litres(self.reservoir, -5), 0.0)

    def test_pourcentage_remplissage(self):
        from .services import calculer_pourcentage_remplissage
        self.assertEqual(calculer_pourcentage_remplissage(self.reservoir, 100), 50.0)
        self.assertEqual(calculer_pourcentage_remplissage(self.reservoir, 250), 100.0)

    def test_etat_niveau(self):
        from .services import determiner_etat_niveau
        self.assertEqual(determiner_etat_niveau(self.reservoir, 5), "critique")
        self.assertEqual(determiner_etat_niveau(self.reservoir, 20), "bas")
        self.assertEqual(determiner_etat_niveau(self.reservoir, 50), "normal")
        self.assertEqual(determiner_etat_niveau(self.reservoir, 92), "haut")
        self.assertEqual(determiner_etat_niveau(self.reservoir, 98), "debordement")
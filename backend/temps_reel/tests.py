"""
Tests du module temps_reel.

Utilise WebsocketCommunicator de Channels pour simuler des clients WebSocket
sans réseau réel.

⚠️ Important : les communicators passent par le VRAI routage (URLRouter) pour
que scope["url_route"] soit peuplé — sinon le consumer crashe sur
`KeyError: 'url_route'`.
"""
import json

from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken

from capteurs.models import Capteur
from capteurs.services import enregistrer_mesure
from reservoirs.models import Reservoir
from .middleware import JWTAuthMiddlewareStack
from .routing import websocket_urlpatterns

Utilisateur = get_user_model()


# ==================================================================
# Helpers
# ==================================================================
def creer_user(username="testuser", role="observateur"):
    return Utilisateur.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="MotDePasseTest123!",
        role=role,
    )


def creer_reservoir_et_capteur():
    r = Reservoir.objects.create(
        nom="R1", code="r1",
        capacite_max_litres=1000, hauteur_max_cm=200,
    )
    c = Capteur.objects.create(
        nom="N1", code="n1", type="niveau", reservoir=r, unite="cm",
        topic_mqtt="securewater/reservoirs/r1/capteurs/n1",
    )
    return r, c


def build_application():
    """
    Retourne l'application ASGI complète (comme en prod) :
    middleware JWT + URLRouter.

    Le middleware extrait le token depuis `?token=...`, mais on peut aussi
    injecter directement `scope["user"]` dans le test si on veut court-circuiter
    l'auth.
    """
    return JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))


# ==================================================================
# Consumer — auth
# ==================================================================
class ConsumerAuthTests(TransactionTestCase):

    async def test_connexion_refusee_sans_token(self):
        """Sans user authentifié → ferme avec 4401."""
        comm = WebsocketCommunicator(
            build_application(),
            "/ws/reservoirs/r1/",
        )
        # Pas de user dans le scope → le middleware met AnonymousUser
        connected, code = await comm.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)
        await comm.disconnect()

    async def test_connexion_refusee_reservoir_inexistant(self):
        """Réservoir inconnu → ferme avec 4404."""
        user = await database_sync_to_async(creer_user)()
        token = str(AccessToken.for_user(user))

        comm = WebsocketCommunicator(
            build_application(),
            f"/ws/reservoirs/inexistant/?token={token}",
        )
        connected, code = await comm.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4404)
        await comm.disconnect()

    async def test_connexion_reussie_avec_token(self):
        """Token valide + réservoir existant → accepté + bienvenue."""
        user = await database_sync_to_async(creer_user)()
        await database_sync_to_async(creer_reservoir_et_capteur)()
        token = str(AccessToken.for_user(user))

        comm = WebsocketCommunicator(
            build_application(),
            f"/ws/reservoirs/r1/?token={token}",
        )

        connected, _ = await comm.connect()
        self.assertTrue(connected)

        welcome = await comm.receive_json_from()
        self.assertEqual(welcome["type"], "bienvenue")
        self.assertEqual(welcome["reservoir"], "r1")
        await comm.disconnect()


# ==================================================================
# Consumer — actions client
# ==================================================================
class ConsumerActionsTests(TransactionTestCase):

    async def _connect(self):
        user = await database_sync_to_async(creer_user)()
        await database_sync_to_async(creer_reservoir_et_capteur)()
        token = str(AccessToken.for_user(user))

        comm = WebsocketCommunicator(
            build_application(),
            f"/ws/reservoirs/r1/?token={token}",
        )
        await comm.connect()
        await comm.receive_json_from()   # bienvenue
        return comm

    async def test_ping_pong(self):
        comm = await self._connect()
        await comm.send_json_to({"action": "ping"})
        reponse = await comm.receive_json_from()
        self.assertEqual(reponse["type"], "pong")
        await comm.disconnect()

    async def test_action_inconnue(self):
        comm = await self._connect()
        await comm.send_json_to({"action": "bidule"})
        reponse = await comm.receive_json_from()
        self.assertEqual(reponse["type"], "erreur")
        await comm.disconnect()

    async def test_derniere_mesure(self):
        # 1. Crée la mesure AVANT de connecter le client
        #    → évite que le signal post_save ne diffuse un message "mesure"
        def _creer_avant():
            user = creer_user()
            creer_reservoir_et_capteur()
            c = Capteur.objects.get(code="n1")
            enregistrer_mesure(capteur=c, valeur=142.5)
        await database_sync_to_async(_creer_avant)()

        # 2. Récupère un token pour ce user
        user = await database_sync_to_async(Utilisateur.objects.first)()
        token = str(AccessToken.for_user(user))

        # 3. Connecte le client
        comm = WebsocketCommunicator(
            build_application(),
            f"/ws/reservoirs/r1/?token={token}",
        )
        connected, _ = await comm.connect()
        self.assertTrue(connected)
        await comm.receive_json_from()   # bienvenue

        # 4. Demande la dernière mesure → doit recevoir la réponse attendue
        await comm.send_json_to({
            "action": "derniere_mesure",
            "capteur_code": "n1",
        })
        reponse = await comm.receive_json_from()
        self.assertEqual(reponse["type"], "derniere_mesure")
        self.assertEqual(reponse["mesure"]["valeur"], 142.5)
        await comm.disconnect()

# ==================================================================
# Signal → diffusion
# ==================================================================
class SignalDiffusionTests(TransactionTestCase):

    async def _connect(self):
        user = await database_sync_to_async(creer_user)()
        await database_sync_to_async(creer_reservoir_et_capteur)()
        token = str(AccessToken.for_user(user))

        comm = WebsocketCommunicator(
            build_application(),
            f"/ws/reservoirs/r1/?token={token}",
        )
        await comm.connect()
        await comm.receive_json_from()   # bienvenue
        return comm

    async def test_mesure_diffusee_au_client(self):
        """Une mesure créée en base arrive au client WebSocket."""
        comm = await self._connect()

        def _creer():
            c = Capteur.objects.get(code="n1")
            enregistrer_mesure(capteur=c, valeur=100.0)
        await database_sync_to_async(_creer)()

        event = await comm.receive_json_from()
        self.assertEqual(event["type"], "mesure")
        self.assertEqual(event["capteur"], "n1")
        self.assertEqual(event["valeur"], 100.0)
        self.assertEqual(event["unite"], "cm")
        await comm.disconnect()

    async def test_alerte_diffusee_au_client(self):
        """Une alerte créée arrive au client WebSocket."""
        comm = await self._connect()

        def _creer():
            c = Capteur.objects.get(code="n1")
            enregistrer_mesure(capteur=c, valeur=15.0)   # 7.5% → critique
        await database_sync_to_async(_creer)()

        # On reçoit mesure PUIS alerte
        event1 = await comm.receive_json_from()
        event2 = await comm.receive_json_from()

        types = {event1["type"], event2["type"]}
        self.assertIn("mesure", types)
        self.assertIn("alerte", types)

        alerte = event1 if event1["type"] == "alerte" else event2
        self.assertEqual(alerte["gravite"], "critique")
        self.assertEqual(alerte["type_alerte"], "niveau_critique_bas")
        await comm.disconnect()
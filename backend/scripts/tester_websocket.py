"""
Script de test WebSocket autonome.

Usage :
    # Avec email + password (récupère un JWT via l'API)
    python scripts/tester_websocket.py --reservoir test \
        --email admin@example.com --password MotDePasseTest123!

    # Avec token direct
    python scripts/tester_websocket.py --reservoir test --token eyJ...

Ce script :
  1. Récupère un token JWT (via l'API ou en argument).
  2. Se connecte au WebSocket du réservoir.
  3. Affiche en direct les messages reçus (mesures, alertes, états).
  4. Envoie un ping toutes les 20 s pour garder la connexion.

Ctrl+C pour arrêter.
"""
import argparse
import asyncio
import json
import sys
from datetime import datetime

try:
    import websockets
except ImportError:
    print("❌ Module 'websockets' manquant. Installer avec : pip install websockets")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌ Module 'requests' manquant. Installer avec : pip install requests")
    sys.exit(1)


# ==================================================================
# Récupération du token
# ==================================================================
def recuperer_token_via_api(base_url: str, email: str, password: str) -> str:
    """POST /api/auth/connexion/ → retourne l'access token."""
    url = f"{base_url}/api/auth/connexion/"
    r = requests.post(
        url,
        json={"email": email, "password": password},
        timeout=5,
    )
    if r.status_code != 200:
        print(f"❌ Échec de connexion ({r.status_code}) : {r.text}")
        sys.exit(2)
    return r.json()["access"]


# ==================================================================
# Affichage coloré
# ==================================================================
COULEURS = {
    "mesure": "\033[92m",         # vert
    "alerte": "\033[91m",         # rouge
    "capteur_etat": "\033[93m",   # jaune
    "bienvenue": "\033[96m",      # cyan
    "pong": "\033[90m",           # gris
    "erreur": "\033[91m",         # rouge
}
RESET = "\033[0m"


def afficher_message(msg: dict):
    type_msg = msg.get("type", "?")
    couleur = COULEURS.get(type_msg, "\033[97m")
    heure = datetime.now().strftime("%H:%M:%S")

    if type_msg == "mesure":
        print(
            f"{couleur}[{heure}] 📊 MESURE{RESET} "
            f"{msg['capteur']:15s} = "
            f"{msg['valeur']:>8.2f} {msg['unite']:<6s} "
            f"({msg.get('pourcentage_remplissage', 0):.1f}% · "
            f"{msg.get('etat_niveau', '?')})"
        )
    elif type_msg == "alerte":
        print(
            f"{couleur}[{heure}] 🚨 ALERTE [{msg['gravite'].upper()}]{RESET} "
            f"{msg['type_alerte']} · {msg['message'][:80]}"
        )
    elif type_msg == "capteur_etat":
        etat = "🟢" if msg["en_ligne"] else "🔴"
        print(
            f"{couleur}[{heure}] {etat} ÉTAT{RESET} "
            f"{msg['capteur']:15s} → {msg['etat_connexion']}"
        )
    elif type_msg == "bienvenue":
        print(
            f"{couleur}[{heure}] 👋 {msg['message']} "
            f"(réservoir : {msg['reservoir']}){RESET}"
        )
    elif type_msg == "pong":
        pass  # silencieux
    else:
        print(
            f"{couleur}[{heure}] {type_msg} : "
            f"{json.dumps(msg, ensure_ascii=False)}{RESET}"
        )


# ==================================================================
# Boucle WebSocket
# ==================================================================
async def boucle_websocket(uri: str, envoyer_ping: bool, origin: str = "http://localhost:8000"):
    print(f"→ Connexion à {uri.split('token=')[0]}token=...")
    try:
        # Compatible websockets >=12 (extra_headers) et >=14 (additional_headers)
        import inspect
        sig = inspect.signature(websockets.connect)
        if "additional_headers" in sig.parameters:
            headers_kwarg = {"additional_headers": {"Origin": origin}}
        else:
            headers_kwarg = {"extra_headers": {"Origin": origin}}

        async with websockets.connect(uri, **headers_kwarg) as ws:
            print("✅ Connecté. En attente de messages... (Ctrl+C pour arrêter)\n")

            async def ping_periodique():
                while True:
                    await asyncio.sleep(20)
                    try:
                        await ws.send(json.dumps({"action": "ping"}))
                    except Exception:
                        return

            ping_task = None
            if envoyer_ping:
                ping_task = asyncio.create_task(ping_periodique())

            try:
                async for raw in ws:
                    try:
                        afficher_message(json.loads(raw))
                    except json.JSONDecodeError:
                        print(f"⚠️  Message non-JSON : {raw[:200]}")
            finally:
                if ping_task:
                    ping_task.cancel()

    except websockets.exceptions.InvalidStatus as e:
        print(f"\n❌ Connexion refusée par le serveur : HTTP {e.response.status_code}")
        if e.response.status_code == 403:
            print("   → Vérifier ALLOWED_HOSTS et l'Origin envoyé")
        elif e.response.status_code == 401:
            print("   → Token JWT invalide ou expiré")
        sys.exit(3)
    except websockets.exceptions.ConnectionClosed as e:
        if e.code == 4401:
            print("\n❌ Connexion fermée : token invalide ou expiré (4401)")
        elif e.code == 4404:
            print("\n❌ Connexion fermée : réservoir introuvable (4404)")
        else:
            print(f"\n⚠️  Connexion fermée (code={e.code})")
        sys.exit(3)
    except ConnectionRefusedError:
        print("\n❌ Serveur Django ASGI non démarré ? Lance `python manage.py runserver`")
        sys.exit(4)
    except Exception as e:
        print(f"\n❌ Erreur : {type(e).__name__} - {e}")
        sys.exit(5)


# ==================================================================
# CLI
# ==================================================================
def parse_args():
    parser = argparse.ArgumentParser(
        description="Test WebSocket temps réel SecureWater",
    )
    parser.add_argument("--url", default="http://localhost:8000",
                        help="URL HTTP du backend (défaut: http://localhost:8000)")
    parser.add_argument("--ws-url", default=None,
                        help="URL WebSocket complète (sinon dérivée de --url)")
    parser.add_argument("--reservoir", "-r", default="test",
                        help="Code du réservoir à écouter (défaut: test)")
    parser.add_argument("--email", "-e", default=None,
                        help="Email pour récupérer un token JWT")
    parser.add_argument("--password", "-p", default=None,
                        help="Mot de passe")
    parser.add_argument("--token", "-t", default=None,
                        help="Token JWT direct")
    parser.add_argument("--no-ping", action="store_true",
                        help="Ne pas envoyer de ping périodique")
    return parser.parse_args()


def main():
    args = parse_args()

    if args.token:
        token = args.token
        print("🔑 Token fourni en argument")
    elif args.email and args.password:
        print(f"🔑 Récupération du token pour {args.email}...")
        token = recuperer_token_via_api(args.url, args.email, args.password)
        print(f"✅ Token obtenu ({token[:30]}...)")
    else:
        print("❌ Il faut fournir --token OU (--email + --password)")
        sys.exit(1)

    if args.ws_url:
        uri = f"{args.ws_url}?token={token}"
    else:
        ws_base = args.url.replace("http://", "ws://").replace("https://", "wss://")
        uri = f"{ws_base}/ws/reservoirs/{args.reservoir}/?token={token}"

    try:
        asyncio.run(boucle_websocket(uri, envoyer_ping=not args.no_ping))
    except KeyboardInterrupt:
        print("\n👋 Arrêt demandé.")


if __name__ == "__main__":
    main()
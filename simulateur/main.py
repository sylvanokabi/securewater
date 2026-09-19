"""
Point d'entrée CLI du simulateur.

Exemples :
    python -m simulateur.main --reservoir test
    python -m simulateur.main --reservoir test --codes-niveau n1,n2 --codes-debit d1
    python -m simulateur.main --reservoir test --scenario fuite --duree 60
    python -m simulateur.main --reservoir test --dry-run
"""
import argparse
import logging
import signal
import sys
import time

from . import scenarios
from .capteur_debit import CapteurDebit
from .capteur_niveau import CapteurNiveau
from .client_mqtt import ClientSimulateurMQTT
from .configuration import charger_configuration


logger = logging.getLogger(__name__)


# ==================================================================
# CLI
# ==================================================================
def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        prog="simulateur",
        description="Simulateur de capteurs IoT pour SecureWater",
    )
    parser.add_argument(
        "--reservoir", "-r", required=True,
        help="Code du réservoir cible (ex: test)",
    )
    parser.add_argument(
        "--codes-niveau",
        default="",
        help="Codes des capteurs de niveau, séparés par des virgules (ex: n1,n2)",
    )
    parser.add_argument(
        "--codes-debit",
        default="",
        help="Codes des capteurs de débit, séparés par des virgules (ex: d1)",
    )
    parser.add_argument(
        "--scenario", "-s", choices=list(scenarios.SCENARIOS_DISPONIBLES.keys()),
        default="normal",
        help="Scénario d'évolution du niveau (défaut: normal)",
    )
    parser.add_argument(
        "--intervalle", "-i", type=float, default=3.0,
        help="Intervalle entre mesures en secondes (défaut: 3.0)",
    )
    parser.add_argument(
        "--duree", "-d", type=float, default=None,
        help="Durée max en secondes (défaut: infinie)",
    )
    parser.add_argument(
        "--hauteur-max", type=float, default=200.0,
        help="Hauteur max du réservoir en cm (défaut: 200)",
    )
    parser.add_argument(
        "--niveau-initial", type=float, default=50.0,
        help="Niveau initial en %% (défaut: 50)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Vérifie la config sans se connecter",
    )
    parser.add_argument(
        "--verbose", "-v", action="count", default=0,
        help="Verbosité (-v info, -vv debug)",
    )
    return parser.parse_args(argv)


def configurer_logs(verbose: int):
    niveaux = [logging.WARNING, logging.INFO, logging.DEBUG]
    niveau = niveaux[min(verbose, len(niveaux) - 1)]
    logging.basicConfig(
        level=niveau,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


# ==================================================================
# Boucle principale
# ==================================================================
class GestionnaireArret:
    """Capture Ctrl+C et SIGTERM pour arrêter proprement."""

    def __init__(self):
        self.arrete = False
        signal.signal(signal.SIGINT, self._handler)
        signal.signal(signal.SIGTERM, self._handler)

    def _handler(self, signum, frame):
        logger.warning("\n⚠️  Signal d'arrêt reçu (%s)", signum)
        self.arrete = True


def _split_codes(valeur: str) -> list[str]:
    """Découpe une chaîne 'a,b,c' en liste ['a', 'b', 'c'] (vide si vide)."""
    if not valeur:
        return []
    return [c.strip() for c in valeur.split(",") if c.strip()]


def creer_capteurs(args, config, client):
    """Instancie les capteurs selon les codes fournis."""
    capteurs = []

    # --- Capteurs de NIVEAU ---
    for code in _split_codes(args.codes_niveau):
        c = CapteurNiveau(
            code=code,
            code_reservoir=args.reservoir,
            config=config,
            client=client,
            hauteur_max_cm=args.hauteur_max,
            niveau_initial_pct=args.niveau_initial,
        )
        capteurs.append(c)

    # --- Capteurs de DÉBIT ---
    for code in _split_codes(args.codes_debit):
        c = CapteurDebit(
            code=code,
            code_reservoir=args.reservoir,
            config=config,
            client=client,
        )
        capteurs.append(c)

    return capteurs


def boucle_principale(capteurs, config, args, arret: GestionnaireArret):
    """Boucle de publication jusqu'à arrêt ou fin de durée."""
    if not capteurs:
        logger.error("❌ Aucun capteur à simuler.")
        return

    debut = time.time()
    dernier_heartbeat = 0.0

    # Annonce initiale "en ligne"
    for c in capteurs:
        c.initialiser()
        c.annoncer_online()

    logger.info(
        "🚀 Simulateur démarré (%d capteurs, intervalle %.1fs)",
        len(capteurs), args.intervalle,
    )

    while not arret.arrete:
        now = time.time()

        if args.duree is not None and (now - debut) >= args.duree:
            logger.info("⏱️  Durée maximale atteinte (%.0fs)", args.duree)
            break

        for c in capteurs:
            try:
                c.publier_mesure()
            except Exception as e:
                logger.exception("Erreur publication mesure %s : %s", c.code, e)

        if now - dernier_heartbeat >= config.intervalle_heartbeat:
            for c in capteurs:
                try:
                    c.publier_heartbeat()
                except Exception as e:
                    logger.exception("Erreur heartbeat %s : %s", c.code, e)
            dernier_heartbeat = now

        time.sleep(args.intervalle)


# ==================================================================
# Point d'entrée
# ==================================================================
def main(argv=None):
    args = parse_args(argv)
    configurer_logs(args.verbose)

    config = charger_configuration()
    config.scenario = args.scenario
    config.intervalle_mesure = args.intervalle

    logger.info(
        "Configuration : broker %s:%s | réservoir=%s | scénario=%s",
        config.host, config.port, args.reservoir, args.scenario,
    )

    erreurs = config.verifier_certificats()
    if erreurs:
        logger.error("❌ Certificats manquants :")
        for e in erreurs:
            logger.error("  - %s", e)
        return 2

    if args.dry_run:
        logger.info("✅ Configuration valide (dry-run, aucune connexion)")
        return 0

    client = ClientSimulateurMQTT(config, client_id_suffix=args.reservoir)
    try:
        client.connecter()
    except Exception as e:
        logger.exception("❌ Impossible de se connecter au broker : %s", e)
        return 3

    capteurs = creer_capteurs(args, config, client)

    arret = GestionnaireArret()

    try:
        boucle_principale(capteurs, config, args, arret)
    except Exception as e:
        logger.exception("💥 Erreur dans la boucle principale : %s", e)
        return 4
    finally:
        for c in capteurs:
            try:
                c.annoncer_offline("arrêt simulateur")
            except Exception:
                pass
        client.deconnecter()

    logger.info("👋 Simulateur arrêté proprement.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
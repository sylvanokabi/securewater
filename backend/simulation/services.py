"""
Gestion du processus simulateur.

Lance et arrête un sous-processus Python qui exécute `python -m simulateur.main`
avec les paramètres demandés.

Les codes des capteurs sont lus depuis la base de données — l'utilisateur n'a
jamais à les connaître.
"""
import logging
import os
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


# ================================================================
# État global (protégé par un verrou)
# ================================================================
_lock = threading.Lock()
_processus: subprocess.Popen | None = None
_log_file = None
_etat = {
    "en_cours": False,
    "pid": None,
    "reservoir": None,
    "scenario": None,
    "capteurs_niveau": [],
    "capteurs_debit": [],
    "intervalle": 0.0,
    "date_debut": None,
}


# ================================================================
# Helpers
# ================================================================
def _racine_projet() -> Path:
    return Path(settings.BASE_DIR).parent


def _nettoyer_logs(limite_lignes: int = 30) -> list[str]:
    if _log_file is None:
        return []
    try:
        _log_file.flush()
        _log_file.seek(0)
        lignes = _log_file.read().splitlines()
        return lignes[-limite_lignes:]
    except Exception:
        return []


def _est_encore_vivant() -> bool:
    global _processus, _etat
    if _processus is None:
        return False
    if _processus.poll() is None:
        return True
    _etat["en_cours"] = False
    _etat["pid"] = None
    return False


def _recuperer_codes_capteurs(code_reservoir: str) -> tuple[list[str], list[str]]:
    """
    Lit en base les capteurs ACTIFS rattachés au réservoir donné.

    Retourne (codes_niveau, codes_debit).
    """
    from capteurs.models import Capteur
    from reservoirs.models import Reservoir

    try:
        reservoir = Reservoir.objects.get(code=code_reservoir)
    except Reservoir.DoesNotExist:
        raise ValueError(f"Réservoir '{code_reservoir}' introuvable.")

    capteurs = Capteur.objects.filter(reservoir=reservoir, statut="actif")

    codes_niveau = list(
        capteurs.filter(type="niveau").values_list("code", flat=True)
    )
    codes_debit = list(
        capteurs.filter(type="debit").values_list("code", flat=True)
    )

    return codes_niveau, codes_debit


# ================================================================
# API publique
# ================================================================
def demarrer_simulation(
    *,
    reservoir: str,
    scenario: str = "normal",
    intervalle: float = 3.0,
    hauteur_max_cm: float = 200.0,
    duree_max: float | None = None,
) -> dict:
    """Lance un nouveau simulateur. Lève ValueError si erreur."""
    global _processus, _log_file, _etat

    with _lock:
        if _est_encore_vivant():
            raise ValueError("Une simulation est déjà en cours.")

        # Lecture des capteurs en base
        codes_niveau, codes_debit = _recuperer_codes_capteurs(reservoir)

        if not codes_niveau and not codes_debit:
            raise ValueError(
                f"Aucun capteur actif pour le réservoir '{reservoir}'. "
                "Créez-en au moins un avant de lancer la simulation."
            )

        racine = _racine_projet()
        simulateur_path = racine / "simulateur"
        if not simulateur_path.exists():
            raise ValueError(
                f"Dossier 'simulateur' introuvable à {simulateur_path}."
            )

        # Commande
        cmd = [
            sys.executable, "-u", "-m", "simulateur.main",
            "--reservoir", str(reservoir),
            "--scenario", str(scenario),
            "--intervalle", str(intervalle),
            "--hauteur-max", str(hauteur_max_cm),
        ]
        if codes_niveau:
            cmd.extend(["--codes-niveau", ",".join(codes_niveau)])
        if codes_debit:
            cmd.extend(["--codes-debit", ",".join(codes_debit)])
        if duree_max is not None:
            cmd.extend(["--duree", str(duree_max)])

        _log_file = tempfile.NamedTemporaryFile(
            mode="w+", suffix=".log", prefix="securewater_sim_", delete=False,
        )

        logger.info("Démarrage du simulateur : %s", " ".join(cmd))

        try:
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            _processus = subprocess.Popen(
                cmd, cwd=str(racine),
                stdout=_log_file, stderr=subprocess.STDOUT, env=env,
            )
        except Exception as e:
            _log_file.close()
            _log_file = None
            raise ValueError(f"Impossible de démarrer le simulateur : {e}")

        _etat.update({
            "en_cours": True,
            "pid": _processus.pid,
            "reservoir": reservoir,
            "scenario": scenario,
            "capteurs_niveau": codes_niveau,
            "capteurs_debit": codes_debit,
            "intervalle": intervalle,
            "date_debut": datetime.now(timezone.utc),
        })

        return {
            **_etat,
            "duree_ecoulee": 0.0,
            "derniers_logs": _nettoyer_logs(30),
        }


def arreter_simulation() -> dict:
    global _processus, _etat

    with _lock:
        if not _est_encore_vivant():
            raise ValueError("Aucune simulation n'est en cours.")

        logger.info("Arrêt du simulateur (pid=%s)", _processus.pid)

        try:
            _processus.terminate()
            try:
                _processus.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning("SIGTERM ignoré, envoi de SIGKILL")
                _processus.kill()
                _processus.wait(timeout=2)
        except Exception as e:
            logger.exception("Erreur lors de l'arrêt : %s", e)

        _etat["en_cours"] = False
        _etat["pid"] = None
        _processus = None

        return {
            **_etat,
            "duree_ecoulee": 0.0,
            "derniers_logs": _nettoyer_logs(30),
        }


def etat_simulation() -> dict:
    _est_encore_vivant()

    duree = 0.0
    if _etat["date_debut"]:
        duree = (datetime.now(timezone.utc) - _etat["date_debut"]).total_seconds()

    return {
        **_etat,
        "duree_ecoulee": round(duree, 1),
        "derniers_logs": _nettoyer_logs(30),
    }
import atexit
import os
import subprocess
import sys
import time
import threading
from django.apps import AppConfig
from django.db.models.signals import post_migrate

_sim_process = None

def _arreter_simulateur():
    global _sim_process
    if _sim_process and _sim_process.poll() is None:
        print("\n⏹ Arrêt du simulateur...")
        _sim_process.terminate()

def _tuer_anciens_simulateurs():
    """Tue les simulateurs zombies qui tournent encore."""
    try:
        subprocess.run(["pkill", "-f", "simulateur.main"], capture_output=True, timeout=5)
    except Exception:
        pass

def _creer_demo_si_besoin(sender, **kwargs):
    try:
        from reservoirs.models import Reservoir
        from capteurs.models import Capteur
        
        if not Reservoir.objects.filter(code="demo").exists():
            print("✨ Création du réservoir 'Démo' et de ses capteurs par défaut...")
            r = Reservoir.objects.create(
                nom="Réservoir Démo", code="demo", 
                capacite_max_litres=1000, hauteur_max_cm=200
            )
            Capteur.objects.create(
                nom="Niveau 01", code="niveau-01", type="niveau", 
                reservoir=r, unite="cm", topic_mqtt="securewater/reservoirs/demo/capteurs/niveau-01"
            )
            Capteur.objects.create(
                nom="Débit 01", code="debit-01", type="debit", 
                reservoir=r, unite="L/min", topic_mqtt="securewater/reservoirs/demo/capteurs/debit-01"
            )
            print("✅ Réservoir 'Démo' prêt !")
    except Exception:
        pass

def _lancer_simulateur():
    global _sim_process
    if "runserver" not in sys.argv:
        return
    if os.environ.get("RUN_MAIN") != "true":
        return

    from django.conf import settings
    root_dir = str(settings.BASE_DIR.parent)
    
    if not _sim_process:
        print("\n🌊 [Django] Lancement du simulateur en arrière-plan...")
        _tuer_anciens_simulateurs() # 👈 Tue les anciens
        time.sleep(0.5)
        _sim_process = subprocess.Popen(
            [sys.executable, "-u", "-m", "simulateur.main"],
            cwd=root_dir,
        )
        atexit.register(_arreter_simulateur)

class SimulationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "simulation"

    def ready(self):
        post_migrate.connect(_creer_demo_si_besoin, sender=self)
        _lancer_simulateur()
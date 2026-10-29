import logging
import sys
import time
import requests
from .capteur_debit import CapteurDebit
from .capteur_niveau import CapteurNiveau
from .client_mqtt import ClientSimulateurMQTT
from .configuration import charger_configuration

logger = logging.getLogger(__name__)

def main():
    config = charger_configuration()
    client = ClientSimulateurMQTT(config, client_id_suffix="global")
    
    try:
        client.connecter()
    except Exception as e:
        logger.error(f"Impossible de se connecter au broker MQTT : {e}")
        time.sleep(5)
        sys.exit(1)

    logger.info("🌊 Simulateur global prêt. En attente des réservoirs...")

    capteurs_cache = {}

    while True:
        try:
            try:
                r = requests.get("http://127.0.0.1:8000/api/reservoirs/etat-global/", timeout=3)
            except requests.exceptions.RequestException:
                time.sleep(2)
                continue

            if r.status_code == 200:
                reservoirs = r.json()
                
                # On nettoie le cache des capteurs qui n'existent plus
                codes_actifs = set()
                for res in reservoirs:
                    for c in res["capteurs_niveau"] + res["capteurs_debit"]:
                        codes_actifs.add(f"{res['code']}_{c}")
                
                # Supprime les vieux capteurs du cache
                for key in list(capteurs_cache.keys()):
                    if key not in codes_actifs:
                        del capteurs_cache[key]

                for res in reservoirs:
                    code_res = res["code"]
                    
                    for code_cap in res["capteurs_niveau"]:
                        cache_key = f"{code_res}_{code_cap}"
                        if cache_key not in capteurs_cache:
                            capteurs_cache[cache_key] = CapteurNiveau(code_cap, code_res, config, client, hauteur_max_cm=res["hauteur_max_cm"])
                            capteurs_cache[cache_key].annoncer_online()
                        
                        capteur = capteurs_cache[cache_key]
                        val_cm = capteur.generer_valeur_forcee(
                            scenario=res["scenario"], 
                            niveau_actuel_pct=res["niveau_pct"], 
                            hauteur_max=res["hauteur_max_cm"], 
                            intervalle=1.5 # 👈 Intervalle de 1.5s pour éviter la surcharge
                        )
                        capteur.publier_mesure_forcee(val_cm)
                        
                    for code_cap in res["capteurs_debit"]:
                        cache_key = f"{code_res}_{code_cap}"
                        if cache_key not in capteurs_cache:
                            capteurs_cache[cache_key] = CapteurDebit(code_cap, code_res, config, client)
                            capteurs_cache[cache_key].annoncer_online()
                        
                        capteurs_cache[cache_key].publier_mesure()

            time.sleep(1.5) # 👈 Le simulateur tourne à 1.5s
            
        except Exception as e:
            logger.error(f"Erreur simulateur : {e}")
            time.sleep(3)

if __name__ == "__main__":
    main()
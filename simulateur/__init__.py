"""
Simulateur de capteurs IoT pour SecureWater.

Ce package génère des mesures réalistes et les publie sur le broker MQTT
en TLS mutuel. Il remplace du matériel physique pour le développement.

Lancement :
    python -m simulateur.main --reservoir test --capteurs 2

Modules :
    configuration.py   → chargement de la config depuis .env
    client_mqtt.py     → wrapper paho-mqtt TLS
    capteur.py         → classe de base abstraite
    capteur_niveau.py  → simulateur de niveau
    capteur_debit.py   → simulateur de débit
    scenarios.py       → scénarios d'évolution temporelle
    main.py            → CLI
"""

__version__ = "0.1.0"
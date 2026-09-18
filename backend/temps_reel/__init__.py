"""
Module temps_reel — WebSocket temps réel pour SecureWater.

Expose :
  - JWTAuthMiddleware : authentifie les connexions WebSocket via JWT
  - ReservoirConsumer : gère l'abonnement aux événements d'un réservoir
  - routing : point de montage ASGI
  - signals : diffuse les mesures/alertes aux clients connectés
  - views : endpoint fictif pour documenter le WebSocket dans Swagger

default_app_config : force Django à charger la classe AppConfig
(personnalisée) qui branche les signaux au démarrage.
"""

default_app_config = "temps_reel.apps.TempsReelConfig"
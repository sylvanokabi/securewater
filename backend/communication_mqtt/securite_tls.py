"""
Construction du contexte TLS pour la connexion au broker MQTT.

Politique de sécurité appliquée :
  - TLS 1.2 minimum (rejette TLS 1.0 / 1.1 / SSLv3)
  - Vérification stricte du certificat serveur (CERT_REQUIRED)
  - Vérification du hostname (donc pas de `tls_insecure_set(True)`)
  - Authentification mutuelle (le client présente son propre certificat)
  - Désactivation des cipher suites faibles
"""
import ssl

from django.core.exceptions import ImproperlyConfigured

from .config import ConfigurationMQTT, verifier_fichiers_tls


def construire_contexte_tls(config: ConfigurationMQTT) -> ssl.SSLContext | None:
    """
    Retourne un `ssl.SSLContext` configuré pour paho-mqtt, ou None si TLS est
    désactivé dans la config (utile pour développement local sans broker TLS).
    """
    # Pas de certificats fournis → TLS désactivé (dev seulement)
    if not config.tls_active:
        return None

    # Vérifier que les fichiers existent vraiment
    erreurs = verifier_fichiers_tls(config)
    if erreurs:
        raise ImproperlyConfigured("TLS MQTT mal configuré : " + " | ".join(erreurs))

    # Contexte TLS par défaut
    contexte = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)

    # 1. CA : le client accepte uniquement les certs signés par cette autorité
    contexte.load_verify_locations(cafile=str(config.ca_cert))

    # 2. Certificat client + clé privée (authentification mutuelle)
    contexte.load_cert_chain(
        certfile=str(config.client_cert),
        keyfile=str(config.client_key),
    )

    # 3. Vérification stricte du serveur
    contexte.verify_mode = ssl.CERT_REQUIRED
    contexte.check_hostname = True

    # 4. Interdire les protocoles obsolètes
    contexte.minimum_version = ssl.TLSVersion.TLSv1_2

    # 5. Chiffrements modernes uniquement
    contexte.set_ciphers(
        "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS"
    )

    return contexte
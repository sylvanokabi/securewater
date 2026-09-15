---

## 6. Cycle de vie IoT

Le cycle de vie d'un capteur est composé de 4 événements, tous tracés
indépendamment pour permettre la détection d'anomalies :

| Événement | Signification |
|---|---|
| **Authentification** | Certificat TLS validé par le broker |
| **Connexion** | Session MQTT établie (CONNACK) |
| **Heartbeat** | Signe de vie périodique sans mesure |
| **Mesure** | Donnée envoyée |

États de connexion possibles (`etat_connexion`) :
- `jamais_connecte` : aucune connexion enregistrée
- `en_ligne` : mesure/heartbeat récent (< 2 min)
- `hors_ligne` : silence > 2 min OU déconnexion explicite
- `en_erreur` : erreur remontée par le client

### 6.1 Authentification

| Champ | Valeur |
|---|---|
| **Endpoint** | `/api/capteurs/<id>/authentifier/` |
| **Méthode** | `POST` |
| **Auth** | ✅ Admin/Opérateur (appelé par le broker) |

**Request JSON**
```json
{
  "adresse_ip": "10.0.0.5",
  "certificat_fingerprint": "sha256:abc123..."
}
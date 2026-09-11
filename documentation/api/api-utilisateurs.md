# API Utilisateurs

## Présentation

Le module `utilisateurs` gère l'identité et l'authentification
des utilisateurs humains de SECUREWATER IoT.

L'authentification de l'utilisateur repose sur JWT.

Les capteurs IoT utilisent un mécanisme d'authentification
distinct basé sur MQTT et TLS/mTLS.

---

## Rôles

Trois rôles sont définis :

- ADMINISTRATEUR
- OPERATEUR
- OBSERVATEUR

---

# Authentification

## Inscription

### Endpoint

POST `/api/auth/inscription/`

### Exemple

```json
{
    "username": "jeremie",
    "email": "jeremie@example.com",
    "password": "MotDePasseTest123!",
    "password_confirm": "MotDePasse123!"
    "first_name": "Jeremie",
    "last_name": "Test"
}
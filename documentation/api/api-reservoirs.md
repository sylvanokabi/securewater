# API — Réservoirs

Base URL : `http://localhost:8000/api/reservoirs/`

Toutes les requêtes/réponses sont en **JSON UTF-8**.
Sauf mention contraire, l'en-tête `Authorization: Bearer <access>` est requis.

## 🎭 Règles d'accès

| Opération | Rôle minimum |
|---|---|
| Lire (GET) | tout utilisateur authentifié |
| Créer / Modifier (POST/PATCH) | **Administrateur** ou **Opérateur** |
| Supprimer (DELETE) | **Administrateur** |

---

## 1. Lister les réservoirs

| Champ | Valeur |
|---|---|
| **Endpoint** | `/api/reservoirs/` |
| **Méthode** | `GET` |
| **Auth** | ✅ Oui |

### Query params
| Param | Type | Description |
|---|---|---|
| `statut` | string | `actif` \| `inactif` \| `maintenance` |
| `search` | string | Recherche sur `nom`, `code`, `localisation` |
| `ordering` | string | `nom`, `date_creation`, `date_modification` (préfixe `-` pour desc) |
| `page` | int | Numéro de page |
| `page_size` | int | Taille de page (défaut 20) |

### Response JSON — `200 OK`
```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "nom": "Réservoir principal",
      "code": "principal",
      "localisation": "Kinshasa",
      "capacite_max_litres": 5000.0,
      "statut": "actif",
      "date_modification": "2025-01-15T10:00:00Z"
    },
    {
      "id": 2,
      "nom": "Réservoir secondaire",
      "code": "secondaire",
      "localisation": "Lubumbashi",
      "capacite_max_litres": 2000.0,
      "statut": "maintenance",
      "date_modification": "2025-01-14T08:30:00Z"
    }
  ]
}
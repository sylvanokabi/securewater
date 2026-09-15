# API — Alertes

Base URL : `http://localhost:8000/api/alertes/`

## 🎭 Règles d'accès

| Opération | Rôle minimum |
|---|---|
| Lire (GET) | tout utilisateur authentifié |
| Acquitter / Résoudre / Créer manuelle (POST) | **Administrateur** ou **Opérateur** |

## 🧱 Concepts

Une **alerte** est générée :

1. **Automatiquement** par un signal `post_save` sur `Mesure` :
   - pour un capteur de **niveau**, selon `etat_niveau` calculé :
     - `critique` → `niveau_critique_bas` (gravité : critique)
     - `bas` → `niveau_bas` (avertissement)
     - `haut` → `niveau_haut` (avertissement)
     - `debordement` → `debordement` (critique)
     - `normal` → résout toutes les alertes de niveau actives
   - une nouvelle mesure **résout** toute alerte `capteur_hors_ligne` ou
     `capteur_silencieux` active (le capteur vient de parler).

2. **Par un scan périodique** (`detecter_anomalies_capteurs()`) :
   - capteur inactif depuis > `DELAI_HORS_LIGNE_SECONDES` → `capteur_hors_ligne`
   - capteur en `EN_ERREUR` → `erreur_capteur`

3. **Manuellement** via `POST /api/alertes/manuel/`.

### Unicité

Pour un couple `(capteur, type)`, une seule alerte **active** peut exister
à un instant donné. Les nouvelles détections **mettent à jour** l'alerte
existante (message, valeur) sans la dupliquer.

### Statuts

| Statut | Signification |
|---|---|
| `active` | L'alerte est en cours, action requise |
| `acquittee` | Un opérateur a pris connaissance |
| `resolue` | Le problème est terminé (auto ou manuel) |

---

## 1. Lister les alertes

| Champ | Valeur |
|---|---|
| **Endpoint** | `/api/alertes/` |
| **Méthode** | `GET` |
| **Auth** | ✅ Oui |

### Query params
| Param | Type | Description |
|---|---|---|
| `statut` | string | `active` \| `acquittee` \| `resolue` |
| `gravite` | string | `info` \| `avertissement` \| `critique` |
| `type` | string | voir énumération |
| `capteur` | int | Filtrer par capteur |
| `reservoir` | int | Filtrer par réservoir |
| `search` | string | Recherche dans `message` |
| `ordering` | string | `date_declenchement`, `gravite`, `statut` |
| `page`, `page_size` | int | Pagination |

### Response JSON — `200 OK`
```json
{
  "count": 3,
  "results": [
    {
      "id": 42,
      "type": "niveau_critique_bas",
      "type_display": "Niveau critique bas",
      "gravite": "critique",
      "gravite_display": "Critique",
      "statut": "active",
      "message": "Niveau critique bas sur le capteur 'Niveau amont' (niveau-amont) : 7.5% (seuil 10.0%).",
      "capteur": 1,
      "capteur_code": "niveau-amont",
      "reservoir": 1,
      "reservoir_nom": "Réservoir principal",
      "valeur_mesure": 7.5,
      "seuil_franchi": 10.0,
      "date_declenchement": "2025-01-15T10:15:00Z",
      "date_resolution": null,
      "resolution_auto": false
    }
  ]
}
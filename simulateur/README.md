# Simulateur de capteurs IoT

Programme Python qui **remplace les vrais capteurs** en publiant de fausses mesures sur le broker MQTT. Alimente Django pour que le frontend ait des données réalistes à afficher.

## Architecture

```
┌──────────────────┐     MQTT TLS      ┌──────────────────┐
│   Simulateur     │ ────────────────▶ │  Broker          │
│   (ce dossier)   │                   │  Mosquitto       │
└──────────────────┘                   └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │  Backend Django  │
                                       │  (reçoit, stocke,│
                                       │   détecte alertes)│
                                       └────────┬─────────┘
                                                │ REST + WS
                                                ▼
                                       ┌──────────────────┐
                                       │  Frontend React  │
                                       └──────────────────┘
```

- Le simulateur ne parle **jamais** directement au frontend.
- Il alimente **Django**, qui alimente **React** via l'API REST.
- **Ne jamais consommer MQTT depuis React** — c'est Django qui fait ça.

---

## ⚡ Lancement rapide (3 terminaux)

### Terminal 1 — Backend Django (écoute MQTT)

```bash
cd backend
source venv/bin/activate
python manage.py demarrer_mqtt
```
Lance le client Django qui reçoit les messages du simulateur. **Laisser ouvert.**

### Terminal 2 — Simulateur

```bash
cd ~/ProjetMaster01/Collab/securewater
source backend/venv/bin/activate
python -m simulateur.main --reservoir test --capteurs 1 --avec-debit
```
Publie des mesures toutes les 3 s. **Laisser ouvert.** `Ctrl+C` pour arrêter.

### Terminal 3 — React

```bash
cd frontend
npm run dev
```
Le dashboard affiche les valeurs en direct.

---

## 📋 Prérequis (une seule fois)

Créer le réservoir et les capteurs en base pour que Django accepte les messages :

```bash
cd backend
source venv/bin/activate
python manage.py shell -c "
from reservoirs.models import Reservoir
from capteurs.models import Capteur

r, _ = Reservoir.objects.get_or_create(
    code='test',
    defaults={'nom':'Réservoir Test','capacite_max_litres':1000,'hauteur_max_cm':200},
)
for code, type_, unite in [('niveau-01','niveau','cm'), ('debit-01','debit','L/min')]:
    Capteur.objects.get_or_create(
        code=code,
        defaults={
            'nom': code, 'type': type_, 'reservoir': r, 'unite': unite,
            'topic_mqtt': f'securewater/reservoirs/test/capteurs/{code}',
        },
    )
print('OK')
"
```

---

## 🎬 Toutes les commandes du simulateur

> Toutes ces commandes se lancent depuis `~/ProjetMaster01/Collab/securewater` avec le venv backend activé.

### Lancer un scénario

```bash
# Scénario par défaut : oscillation douce autour de 50 %
python -m simulateur.main
```
Dashboard stable, badge vert, jauge au milieu.

```bash
# Niveau qui descend progressivement → franchit le seuil critique
python -m simulateur.main --scenario vidange
```
Après ~1 minute : badge passe vert → orange → **rouge**, alerte créée automatiquement.

```bash
# Niveau qui monte rapidement → franchit le seuil haut
python -m simulateur.main --scenario debordement
```
Alerte **débordement** rapidement.

```bash
# Remplissage progressif
python -m simulateur.main --scenario remplissage
```
Vert → orange → rouge sur plusieurs minutes.

```bash
# Fuite : comportement normal puis chute brutale après 10 mesures
python -m simulateur.main --scenario fuite
```
Simule une fuite soudaine.

```bash
# Oscillation sur toute la plage (test graphique)
python -m simulateur.main --scenario oscillation
```
Courbe sinusoïdale — parfait pour tester le rendu d'un graphique.

### Nombre de capteurs

```bash
# 1 capteur de niveau (défaut)
python -m simulateur.main
```

```bash
# 1 niveau + 1 débit
python -m simulateur.main --avec-debit
```

```bash
# 3 niveaux + 1 débit
python -m simulateur.main --capteurs 3 --avec-debit
```
Crée `niveau-01`, `niveau-02`, `niveau-03`, `debit-01`. **Prérequis** : ces capteurs doivent exister en base.

### Durée et rythme

```bash
# S'arrête automatiquement après 60 secondes
python -m simulateur.main --duree 60
```
Utile pour une démo scriptée.

```bash
# Mesure toutes les secondes au lieu de 3
python -m simulateur.main --intervalle 1
```

### Cibler un autre réservoir

```bash
# Réservoir différent de "test"
python -m simulateur.main --reservoir mon-reservoir
```
Le réservoir doit exister en base. Adapte aussi `--hauteur-max` si la géométrie diffère.

### Diagnostic

```bash
# Vérifier la configuration sans se connecter
python -m simulateur.main --dry-run
```
Teste les certificats et la config MQTT, puis s'arrête.

```bash
# Mode verbeux
python -m simulateur.main -v
python -m simulateur.main -vv
```
`-v` : niveau INFO · `-vv` : niveau DEBUG (affiche chaque payload MQTT publié).

```bash
# Voir toutes les options
python -m simulateur.main --help
```

### Arrêt et nettoyage

```bash
# Arrêt propre (envoie un statut "hors ligne")
Ctrl+C
```

```bash
# Tuer tous les simulateurs résiduels
pkill -f "python -m simulateur.main"
```
Utile quand tu vois `Client non connecté` (deux process avec le même client_id).

```bash
# Vider les mesures et alertes de test
cd backend
python manage.py shell -c "
from capteurs.models import Mesure
from alertes.models import Alerte
Alerte.objects.all().delete()
Mesure.objects.all().delete()
print('OK')
"
```
Ne touche pas aux réservoirs/capteurs — seulement aux données accumulées.

---

## ⚙️ Référence des options

| Option | Valeurs possibles | Défaut | Description |
|---|---|---|---|
| `--reservoir`, `-r` | code réservoir | `test` | Réservoir cible |
| `--capteurs`, `-c` | entier ≥ 1 | `1` | Nombre de capteurs de niveau |
| `--avec-debit` | flag | off | Ajoute un capteur de débit |
| `--scenario`, `-s` | `normal`, `remplissage`, `vidange`, `oscillation`, `fuite`, `debordement` | `normal` | Comportement du niveau |
| `--intervalle`, `-i` | secondes (float) | `3.0` | Temps entre deux mesures |
| `--duree`, `-d` | secondes (float) | ∞ | Arrêt automatique |
| `--hauteur-max` | cm (float) | `200` | Hauteur max du réservoir |
| `--niveau-initial` | % (float) | `50` | Niveau de départ |
| `--dry-run` | flag | off | Vérifie la config sans publier |
| `--verbose`, `-v` | `-v` ou `-vv` | `0` | Verbosité des logs |

---

## 🎯 Scénarios → états UI à tester

| Scénario | Ce que tu observes | Composant à vérifier |
|---|---|---|
| `normal` | Oscillation ~50 %, badge vert | Carte de niveau, jauge |
| `vidange` | Badge vert → orange → rouge + alerte | Carte alerte, notification |
| `debordement` | Badge vert → orange → rouge + alerte | Carte alerte |
| `fuite` | Stabilité puis chute brutale | Détection d'anomalie |
| `remplissage` | Progression continue vers le haut | Jauge, animation |
| `oscillation` | Courbe sinusoïdale | Graphique historique |

---

## ⚠️ Règles

1. **Le Terminal 1 (`demarrer_mqtt`) doit tourner** avant de lancer le simulateur, sinon les messages sont perdus.
2. **Ne jamais consommer MQTT depuis React** — passer par l'API REST Django.
3. **Le simulateur ne tourne qu'en dev**, jamais en production.
4. **Ne pas modifier ce dossier** — il est maintenu par l'équipe backend.
5. Les capteurs créés par le simulateur (`niveau-01`, `debit-01`, etc.) doivent exister en base.

---

## 🐛 Dépannage

| Message | Cause | Fix |
|---|---|---|
| `Capteur inconnu` dans les logs Django | Capteur absent en base | Relancer la section **Prérequis** |
| `Connection refused` | Mosquitto arrêté | `sudo systemctl start mosquitto` |
| `Client non connecté` | Deux simulateurs tournent | `pkill -f "python -m simulateur.main"` |
| `Permission denied` sur `simulateur.key` | Certificats mal configurés | Demander au backend : `chmod 640 backend/certificats/simulateur.key` |
| React ne voit rien | Terminal 1 pas lancé | Vérifier que Django MQTT tourne |

---

## 📚 Références

- **API REST** : `documentation/api-*.md`
- **Swagger UI** (test interactif) : http://localhost:8000/api/docs/
- **Architecture MQTT** : `documentation/mqtt.md`
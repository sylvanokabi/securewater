# 🌊 SecureWater 

# — Tableau de Bord d'Analyse et Surveillance IoT pour Réservoirs

**SecureWater** est une solution web et IoT industrielle conçue pour la surveillance, la gestion et l'analyse en temps réel des métriques critiques de réservoirs (niveau de liquide, débit d'écoulement). La plateforme intègre une architecture micro-services/monorepo basée sur une API REST sécurisée et un tableau de bord réactif en temps réel.

---

## 🚀 Fonctionnalités Clés

- **Sécurité & Authentification Renforcée :** Communications sécurisées via tunnel TLS et authentification mutuelle (mTLS) pour la transmission des données IoT.
- **Collecte & Traitement Temps Réel :** Ingestion, validation et stockage persistant de l'historique des données mesurées (niveau/débit).
- **Moteur d'Alertes Dynamiques :** Évaluation continue des seuils critiques et transmission instantanée d'alertes via **WebSockets** à la console d'administration.
- **Tableau de Bord Intuitif :** Visualisation graphique interactive des données, état des objets connectés et jauges en direct.

---

## 🛠️ Stack Technique

- **Backend :** Python, Django, Django REST Framework, WebSockets
- **Frontend :** React.js, Vite
- **Protocole & Sécurité :** TLS, mTLS, WebSockets, REST API
- **Gestion de projet :** Git, GitHub Monorepo

---

## 📁 Structure du Projet

```text
securewater/
├── backend/            # API REST développée avec Django / DRF
├── frontend/           # Interface utilisateur développée avec React.js (Vite)
├── .gitignore          # Configurations d'exclusion Git globales
└── README.md           # Documentation du projet


# 💻 Guide de Démarrage Rapide
1. Cloner le dépôt
Bash
git clone [https://github.com/sylvanokabi/securewater.git](https://github.com/sylvanokabi/securewater.git)
cd securewater

2# . Configurer et Lancer le Backend (Django)
Bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
Le serveur backend sera accessible sur http://127.0.0.1:8000/.

# 3. Configurer et Lancer le Frontend (React)
Dans un nouveau terminal :

Bash
cd frontend
npm install
npm run dev
L'interface web sera accessible sur http://localhost:5173/.

# 👥 Équipe de Développement
Mutombo Kabi Sylvano (@sylvanokabi)

Collaborateurs :

Katolo nshimbi jeremie (@jeremiekatolo)

Mbelu mukengeshayi lydie(lydiambelu2005@gmail.com)

Kalonji mpoyi bienvenu(Kalonjibienvenu00@gmail.com)
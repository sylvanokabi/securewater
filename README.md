# 🌊 SecureWater — Tableau de Bord d'Analyse et Surveillance IoT pour Réservoirs

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
- **Simulateur :** Python, MQTT Client
- **Protocole & Sécurité :** TLS, mTLS, WebSockets, REST API
- **Gestion de projet :** Git, GitHub Monorepo

---

## 📁 Structure du Projet

```text
securewater/
├── backend/                  # API REST & WebSockets (Django / DRF)
│   ├── core/                 # Configuration principale du projet Django
│   ├── utilisateurs/         # Gestion des accès et rôles
│   ├── reservoirs/           # Modèles et API des réservoirs
│   ├── capteurs/             # Métriques et état des équipements IoT
│   ├── alertes/              # Moteur de règles et notification d'alertes
│   ├── communication_mqtt/   # Client d'ingestion des messages MQTT
│   └── temps_reel/           # Channels et WebSockets
├── frontend/                 # Application Web (React.js + Vite)
│   ├── src/
│   │   ├── components/       # Composants réutilisables (Jauges, Cartes, Navbar)
│   │   ├── pages/            # Vues de l'application (Tableau de bord, Alertes...)
│   │   ├── services/         # Appels API HTTP et sockets
│   │   └── contexts/         # Contexte d'authentification
├── simulateur/               # Scripts de simulation de métriques IoT
├── documentation/            # Documentation technique et API
└── README.md


## 💻 Guide de Démarrage Rapide (Spécial Collaborateurs)

Bienvenue dans l'équipe ! Ce guide vous explique pas à pas comment installer et lancer le projet sur votre machine (Windows ou Ubuntu/Linux).

---

### Étape 1 : Cloner le dépôt GitHub

Ouvrez votre terminal (sur **Ubuntu**) ou votre terminal / Git Bash (sur **Windows**) :

```bash
# 1. Naviguez vers le dossier où vous stockez vos projets
cd ~/Documents          # Sur Ubuntu
# cd C:\Projets         # Sur Windows (exemple)

# 2. Cloner le projet sur votre machine
git clone [https://github.com/sylvanokabi/securewater.git](https://github.com/sylvanokabi/securewater.git)

# 3. Entrer dans le dossier du projet
cd securewater


# 1. Entrer dans le dossier backend
cd backend

# 2. Créer l'environnement virtuel Python
python -m venv venv     # Sur Windows
# python3 -m venv venv  # Sur Ubuntu

# 3. Activer l'environnement virtuel
venv\Scripts\activate   # Sur Windows (CMD)
# venv\Scripts\Activate.ps1  # Sur Windows (PowerShell)
# source venv/bin/activate  # Sur Ubuntu / Linux

# 4. Installer les dépendances Python
pip install -r requirements.txt

# 5. Appliquer les migrations de la base de données
python manage.py migrate

# 6. Lancer le serveur de développement
python manage.py runserver

🌐 Le serveur backend sera accessible sur : http://127.0.0.1:8000/


Étape 3 : Configurer et Lancer le Frontend (React)
Ouvrez un deuxième terminal (en gardant le premier ouvert pour le backend) :

🔹 Sur Ubuntu et Windows :


# 1. Naviguez vers le dossier frontend depuis la racine du projet
cd frontend

# 2. Installer les paquets Node.js
npm install

# 3. Lancer l'application React
npm run dev

🌐 L'interface utilisateur sera accessible sur : http://localhost:5173/



🔀 Bonnes Pratiques Git pour l'Équipe
Pour travailler proprement ensemble sans écraser le code des autres :

Ne travaillez JAMAIS directement sur la branche main.

Avant de commencer une nouvelle tâche, créez une branche :

Bash
git checkout main
git pull origin main
git checkout -b feature/nom-de-votre-fonctionnalite
Enregistrez vos modifications régulièrement :

Bash
git add .
git commit -m "feat: description claire de ce que vous avez fait"
git push origin feature/nom-de-votre-fonctionnalite

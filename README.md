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
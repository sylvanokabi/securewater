# Projet Tableau de bord du Réservoir (SecureWater)
Système de surveillance IoT en temps réel pour réservoir.

## Architecture
- `backend/` : API REST avec Django / Django REST Framework
- `frontend/` : Interface Web React.js (Vite)
## Démarrage rapide

### Backend (Django)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

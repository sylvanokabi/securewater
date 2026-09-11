import axios from 'axios';

// Instance Axios centralisée pour le projet SecureWater
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // Annule si pas de réponse après 10s
});

// Intercepteur pour injecter automatiquement le token JWT à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et la déconnexion automatique
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Jeton expiré ou invalide : nettoyage du stockage local
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (window.location.pathname !== '/connexion') {
        window.location.href = '/connexion';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
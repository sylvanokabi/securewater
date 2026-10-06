import axios from 'axios';

// Récupération dynamique de la base de l'API avec fallback local
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
});

// Intercepteur pour inclure automatiquement le token d'accès
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getReservoirsAPI = async () => {
  const response = await api.get('/reservoirs/');
  return response.data;
};

export const creerReservoirAPI = async (data) => {
  const response = await api.post('/reservoirs/', data);
  return response.data;
};

export const supprimerReservoirAPI = async (id) => {
  const response = await api.delete(`/reservoirs/${id}/`);
  return response.data;
};

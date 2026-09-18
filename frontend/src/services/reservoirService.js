import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
});

// Intercepteur pour inclure automatiquement le token d'accès
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token'); // Adapter selon votre stockage (token, access_token, etc.)
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
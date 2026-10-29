// Récupération dynamique de la base de l'API
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_URL = `${BASE_URL}/api/alertes`;

const getHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const handleResponse = async (response) => {
  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/connexion';
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || JSON.stringify(errorData));
  }
  return response;
};

// ✅ AJOUT : accepte désormais des paramètres de filtrage (reservoir, statut, etc.)
export const getAlertesAPI = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `${API_URL}/${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, { headers: getHeaders() });
  await handleResponse(response);
  const data = await response.json();
  return Array.isArray(data) ? data : data.results || [];
};

// ✅ Nom correct attendu par Alertes.jsx et Reservoirs.jsx
export const resoudreAlerteAPI = async (alerteId) => {
  const response = await fetch(`${API_URL}/${alerteId}/acquitter/`, {
    method: 'POST',
    headers: getHeaders(),
  });
  await handleResponse(response);
  return await response.json();
};

// Alias conservé
export const acquitterAlerteAPI = resoudreAlerteAPI;
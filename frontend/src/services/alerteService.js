const API_URL = 'http://127.0.0.1:8000/api/alertes';

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

export const getAlertesAPI = async () => {
  const response = await fetch(`${API_URL}/`, { headers: getHeaders() });
  await handleResponse(response);
  const data = await response.json();
  return Array.isArray(data) ? data : data.results || [];
};

// Exportation sous le nom 'resoudreAlerteAPI' attendu par Alertes.jsx
export const resoudreAlerteAPI = async (alerteId) => {
  const response = await fetch(`${API_URL}/${alerteId}/acquitter/`, {
    method: 'POST',
    headers: getHeaders(),
  });
  await handleResponse(response);
  return await response.json();
};

// Alias conservé si d'autres composants utilisent acquitterAlerteAPI
export const acquitterAlerteAPI = resoudreAlerteAPI;

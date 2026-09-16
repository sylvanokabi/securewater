const API_URL = 'http://127.0.0.1:8000/api/reservoirs';

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
    const errorData = await response.json();
    throw new Error(JSON.stringify(errorData));
  }
  return response;
};

export const getReservoirsAPI = async () => {
  const response = await fetch(`${API_URL}/`, { headers: getHeaders() });
  await handleResponse(response);
  const data = await response.json();
  return Array.isArray(data) ? data : data.results || [];
};

export const creerReservoirAPI = async (payload) => {
  const response = await fetch(`${API_URL}/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  await handleResponse(response);
  return await response.json();
};

export const supprimerReservoirAPI = async (id) => {
  const response = await fetch(`${API_URL}/${id}/`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(response);
  return true;
};
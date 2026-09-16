const API_URL = 'http://127.0.0.1:8000/api/capteurs';

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

export const getCapteursAPI = async () => {
  const response = await fetch(`${API_URL}/`, { headers: getHeaders() });
  await handleResponse(response);
  const data = await response.json();
  return Array.isArray(data) ? data : data.results || [];
};

export const getLecturesCapteurAPI = async (capteurId) => {
  const response = await fetch(`${API_URL}/${capteurId}/lectures/`, { headers: getHeaders() });
  await handleResponse(response);
  return await response.json();
};

export const ajouterCapteurAPI = async (payload) => {
  const response = await fetch(`${API_URL}/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  await handleResponse(response);
  return await response.json();
};

export const changerEtatCapteurAPI = async (capteurId, etat) => {
  const response = await fetch(`${API_URL}/${capteurId}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ statut: etat }),
  });
  await handleResponse(response);
  return await response.json();
};

export const supprimerCapteurAPI = async (id) => {
  const response = await fetch(`${API_URL}/${id}/`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  await handleResponse(response);
  return true;
};
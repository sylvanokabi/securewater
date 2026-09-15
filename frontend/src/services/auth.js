const API_URL = 'http://localhost:8000/api';

export const connexionAPI = async (username, password) => {
  const response = await fetch(`${API_URL}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Identifiants invalides.');
  }

  const data = await response.json();
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  return data;
};

export const inscriptionAPI = async (donneesUtilisateur) => {
  const response = await fetch(`${API_URL}/utilisateurs/inscription/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donneesUtilisateur),
  });

  if (!response.ok) {
    const errorData = await response.json();
    // Formate les erreurs de validation renvoyées par Django REST Framework (ex: username déjà pris)
    const messages = Object.entries(errorData)
      .map(([champ, message]) => `${champ}: ${Array.isArray(message) ? message.join(' ') : message}`)
      .join(' | ');
    throw new Error(messages || 'Échec lors de l\'inscription.');
  }

  return await response.json();
};

export const deconnexion = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/connexion';
};

export const estAuthentifie = () => {
  return !!localStorage.getItem('access_token');
};

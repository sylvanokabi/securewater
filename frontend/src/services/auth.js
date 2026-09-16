const API_URL = 'http://127.0.0.1:8000/api/auth';

/**
 * Service pour l'inscription d'un nouvel utilisateur
 */
export const inscriptionAPI = async (donneesUtilisateur) => {
  const response = await fetch(`${API_URL}/inscription/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(donneesUtilisateur),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const messages = typeof errorData === 'object'
      ? Object.entries(errorData)
          .map(([champ, msg]) => `${champ}: ${Array.isArray(msg) ? msg.join(' ') : msg}`)
          .join(' | ')
      : 'Échec lors de l\'inscription.';
    throw new Error(messages);
  }

  return await response.json();
};

/**
 * Service pour la connexion utilisateur
 */
export const connexionAPI = async (email, password) => {
  const payload = {
    email: email,
    password: password,
  };

  const response = await fetch(`${API_URL}/connexion/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    const messageErreur = typeof errorData === 'object'
      ? Object.entries(errorData)
          .map(([champ, msg]) => `${champ}: ${Array.isArray(msg) ? msg.join(' ') : msg}`)
          .join(' | ')
      : 'Identifiants invalides.';

    throw new Error(messageErreur || 'Identifiants invalides.');
  }

  const data = await response.json();
  
  if (data.access) localStorage.setItem('access_token', data.access);
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

  return data;
};

/**
 * Service de déconnexion
 */
export const deconnexion = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  const accessToken = localStorage.getItem('access_token');

  if (refreshToken && accessToken) {
    try {
      await fetch(`${API_URL}/deconnexion/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch (e) {
      console.error('Erreur lors de la déconnexion côté serveur:', e);
    }
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/connexion';
};

/**
 * Vérifie si un token est présent
 */
export const estAuthentifie = () => {
  return !!localStorage.getItem('access_token');
};

/**
 * Récupère le profil de l'utilisateur actuellement connecté
 */
export const getProfilAPI = async () => {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Aucun token trouvé');

  const response = await fetch(`${API_URL}/profil/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Impossible de récupérer les informations de l\'utilisateur.');
  }

  return await response.json();
};
import api from './api';

const utilisateurService = {
  // Connexion : Récupération des tokens (access & refresh)
  async connexion(credentials) {
    const response = await api.post('token/', credentials);
    if (response.data.access) {
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
    }
    return response.data;
  },

  // Inscription d'un nouvel utilisateur
  async inscription(userData) {
    const response = await api.post('utilisateurs/inscription/', userData);
    return response.data;
  },

  // Obtenir le profil de l'utilisateur connecté
  async getProfil() {
    const response = await api.get('utilisateurs/me/');
    return response.data;
  },

  // Déconnexion propre
  déconnexion() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

export default utilisateurService;
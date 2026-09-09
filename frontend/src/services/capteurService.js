import api from './api';

const capteurService = {
  // Obtenir la liste de tous les capteurs
  async getCapteurs() {
    const response = await api.get('capteurs/');
    return response.data;
  },

  // Obtenir les métriques/lectures d'un capteur spécifique
  async getLecturesCapteur(capteurId) {
    const response = await api.get(`capteurs/${capteurId}/lectures/`);
    return response.data;
  },

  // Enregistrer ou configurer un capteur
  async ajouterCapteur(data) {
    const response = await api.post('capteurs/', data);
    return response.data;
  },

  // Changer l'état d'un capteur (ex: actif / inactif)
  async changerEtatCapteur(capteurId, etat) {
    const response = await api.patch(`capteurs/${capteurId}/`, { statut: etat });
    return response.data;
  },
};

export default capteurService;
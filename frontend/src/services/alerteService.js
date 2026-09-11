import api from './api';

const alerteService = {
  // Récupérer toutes les alertes (avec filtres optionnels : non lues, critiques...)
  async getAlertes(params = {}) {
    const response = await api.get('alertes/', { params });
    return response.data;
  },

  // Marquer une alerte comme lue ou résolue
  async marquerCommeLue(alerteId) {
    const response = await api.patch(`alertes/${alerteId}/`, { lue: true });
    return response.data;
  },

  // Obtenir le résumé des alertes actives pour le Dashboard
  async getAlertesActives() {
    const response = await api.get('alertes/actives/');
    return response.data;
  },
};

export default alerteService;
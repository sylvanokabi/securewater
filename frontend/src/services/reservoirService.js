import api from './api';

const reservoirService = {
  // Lister tous les réservoirs
  async getReservoirs() {
    const response = await api.get('reservoirs/');
    return response.data;
  },

  // Obtenir le détail d'un réservoir par son ID
  async getReservoirById(id) {
    const response = await api.get(`reservoirs/${id}/`);
    return response.data;
  },

  // Ajouter un nouveau réservoir
  async creerReservoir(data) {
    const response = await api.post('reservoirs/', data);
    return response.data;
  },

  // Mettre à jour un réservoir
  async modifierReservoir(id, data) {
    const response = await api.put(`reservoirs/${id}/`, data);
    return response.data;
  },

  // Supprimer un réservoir
  async supprimerReservoir(id) {
    const response = await api.delete(`reservoirs/${id}/`);
    return response.data;
  },
};

export default reservoirService;
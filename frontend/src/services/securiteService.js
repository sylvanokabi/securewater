import api from './api';

export const getStatsMQTTAPI = async () => {
  const r = await api.get('demonstration/mqtt/stats/');
  return r.data;
};

export const getScenariosAPI = async () => {
  const r = await api.get('demonstration/scenarios/');
  return r.data;
};

export const getCertificatsAPI = async () => {
  const r = await api.get('demonstration/certificats/');
  return r.data;
};

export const testerConnexionAPI = async (scenario) => {
  const r = await api.post('demonstration/tester-connexion/', { scenario });
  return r.data;
};

export const getJournalAPI = async (limite = 50) => {
  const r = await api.get(`demonstration/journal/?limite=${limite}`);
  return r.data;
};
import api from './api';

/**
 * Démarre une simulation sur le backend.
 *
 * @param {Object} payload
 * @param {string} payload.reservoir - Code du réservoir
 * @param {string} payload.scenario - normal | remplissage | vidange | oscillation | fuite | debordement
 * @param {number} payload.capteurs - Nombre de capteurs de niveau
 * @param {boolean} payload.avec_debit - Ajoute un capteur de débit
 * @param {number} payload.intervalle - Secondes entre 2 mesures
 */
export const demarrerSimulationAPI = async (payload) => {
  const r = await api.post('simulation/demarrer/', payload);
  return r.data;
};

export const arreterSimulationAPI = async () => {
  const r = await api.post('simulation/arreter/');
  return r.data;
};

export const getEtatSimulationAPI = async () => {
  const r = await api.get('simulation/etat/');
  return r.data;
};

/**
 * Liste des scénarios avec leur description (pour le menu déroulant).
 */
export const SCENARIOS = [
  {
    id: 'normal',
    label: 'Normal (stable)',
    description: 'Le niveau oscille doucement autour de 50%. Aucune alerte.',
  },
  {
    id: 'remplissage',
    label: 'Remplissage',
    description: 'Le niveau monte progressivement. Peut déclencher une alerte haut.',
  },
  {
    id: 'vidange',
    label: 'Vidange',
    description: 'Le niveau descend progressivement. Déclenche alerte bas puis critique.',
  },
  {
    id: 'oscillation',
    label: 'Oscillation',
    description: 'Vague sinusoïdale sur toute la plage. Idéal pour tester les graphiques.',
  },
  {
    id: 'fuite',
    label: 'Fuite',
    description: 'Comportement normal 10 mesures, puis chute brutale. Simule une fuite.',
  },
  {
    id: 'debordement',
    label: 'Débordement',
    description: 'Le niveau monte très vite. Déclenche une alerte critique haut.',
  },
];
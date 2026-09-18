// src/hooks/useReservoir.js
import { useState, useEffect } from 'react';

const MOCK_RESERVOIR = {
  id: 1,
  nom: 'Réservoir Principal (Simulé)',
  code: 'RES-001',
  code_mqtt: 'water/res_001',
  description: 'Cuve de stockage principale - Simulation autonome',
  localisation: 'Kinshasa - Central',
  capacite_max_litres: 10000,
  hauteur_max_cm: 300,
  seuil_critique_bas: 10,
  seuil_alerte_bas: 25,
  seuil_alerte_haut: 90,
  seuil_critique_haut: 95,
  statut: 'actif',
};

export function useReservoir() {
  const [reservoir, setReservoir] = useState({
    ...MOCK_RESERVOIR,
    niveauActuel: 50,
    debitActuel: 120,
  });
  const [loading] = useState(false);
  const [error] = useState(null);

  useEffect(() => {
    let direction = 1; // 1 = remplissage, -1 = vidange

    const interval = setInterval(() => {
      setReservoir((prev) => {
        let nxt = prev.niveauActuel + direction * 1.5;
        let debit = Math.round((120 + Math.sin(Date.now() / 1000) * 20) * 10) / 10;

        if (nxt >= 98) {
          direction = -1;
          nxt = 98;
        } else if (nxt <= 5) {
          direction = 1;
          nxt = 5;
        }

        return {
          ...prev,
          niveauActuel: Math.round(nxt * 10) / 10,
          debitActuel: debit,
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return { reservoir, loading, error };
}
// src/hooks/useReservoir.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export function useReservoir(reservoirIdOuCode) {
  const [reservoir, setReservoir] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reservoirIdOuCode) return;

    const fetchData = async () => {
      try {
        const response = await api.get(`/reservoirs/${reservoirIdOuCode}/`);
        setReservoir(response.data);
        setError(null);
      } catch (err) {
        console.error("Erreur lors de la récupération des télémétries :", err);
        setError(err.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchData(); // Premier appel immédiat

    // Polling toutes les 3 secondes (aligné sur le rythme du simulateur)
    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval); // Nettoyage lors du démontage du composant
  }, [reservoirIdOuCode]);

  return { reservoir, loading, error };
}

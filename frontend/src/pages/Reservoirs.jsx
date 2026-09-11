import React, { useEffect, useState } from 'react';
import reservoirService from '../services/reservoirService';

const Reservoirs = () => {
  const [reservoirs, setReservoirs] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    reservoirService.getReservoirs()
      .then((data) => setReservoirs(data))
      .catch((err) => console.error(err))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div style={{ padding: '2rem' }}>Chargement des réservoirs...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Gestion des Réservoirs</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f6f9', textAlign: 'left' }}>
            <th style={styles.th}>Nom</th>
            <th style={styles.th}>Capacité (L)</th>
            <th style={styles.th}>Niveau Actuel (%)</th>
            <th style={styles.th}>Localisation</th>
          </tr>
        </thead>
        <tbody>
          {reservoirs.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={styles.td}>{r.nom}</td>
              <td style={styles.td}>{r.capacite}</td>
              <td style={styles.td}>{r.niveau_actuel}%</td>
              <td style={styles.td}>{r.localisation || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  th: { padding: '0.75rem', borderBottom: '2px solid #ccc' },
  td: { padding: '0.75rem' },
};

export default Reservoirs;
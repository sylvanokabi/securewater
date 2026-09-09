import React, { useEffect, useState } from 'react';
import capteurService from '../services/capteurService';

const Capteurs = () => {
  const [capteurs, setCapteurs] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    capteurService.getCapteurs()
      .then((data) => setCapteurs(data))
      .catch((err) => console.error(err))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div style={{ padding: '2rem' }}>Chargement des capteurs...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>État des Capteurs IoT</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f6f9', textAlign: 'left' }}>
            <th style={styles.th}>Code Référence</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Statut</th>
            <th style={styles.th}>Réservoir Associé</th>
          </tr>
        </thead>
        <tbody>
          {capteurs.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={styles.td}>{c.reference || c.id}</td>
              <td style={styles.td}>{c.type_capteur}</td>
              <td style={styles.td}>
                <span style={{ color: c.statut === 'ACTIF' ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                  {c.statut}
                </span>
              </td>
              <td style={styles.td}>{c.reservoir_nom || c.reservoir}</td>
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

export default Capteurs;
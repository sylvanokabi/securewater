import React, { useEffect, useState } from 'react';
import alerteService from '../services/alerteService';

const Alertes = () => {
  const [alertes, setAlertes] = useState([]);
  const [chargement, setChargement] = useState(true);

  const chargerAlertes = () => {
    alerteService.getAlertes()
      .then((data) => setAlertes(data))
      .catch((err) => console.error(err))
      .finally(() => setChargement(false));
  };

  useEffect(() => {
    chargerAlertes();
  }, []);

  const marquerLue = async (id) => {
    try {
      await alerteService.marquerCommeLue(id);
      chargerAlertes();
    } catch (err) {
      console.error(err);
    }
  };

  if (chargement) return <div style={{ padding: '2rem' }}>Chargement des alertes...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Historique et Journal des Alertes</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f6f9', textAlign: 'left' }}>
            <th style={styles.th}>Message</th>
            <th style={styles.th}>Niveau de Sévérité</th>
            <th style={styles.th}>Statut</th>
            <th style={styles.th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {alertes.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={styles.td}>{a.message}</td>
              <td style={styles.td}>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: a.severite === 'CRITIQUE' ? '#f8d7da' : '#fff3cd',
                  color: a.severite === 'CRITIQUE' ? '#721c24' : '#856404',
                }}>
                  {a.severite}
                </span>
              </td>
              <td style={styles.td}>{a.lue ? 'Lue' : 'Non lue'}</td>
              <td style={styles.td}>
                {!a.lue && (
                  <button onClick={() => marquerLue(a.id)} style={styles.btn}>
                    Marquer comme lue
                  </button>
                )}
              </td>
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
  btn: { padding: '0.3rem 0.6rem', cursor: 'pointer', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' },
};

export default Alertes;
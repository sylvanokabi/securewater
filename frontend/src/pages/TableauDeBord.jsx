import React, { useEffect, useState } from 'react';
import reservoirService from '../services/reservoirService';
import capteurService from '../services/capteurService';
import alerteService from '../services/alerteService';

const TableauDeBord = () => {
  const [stats, setStats] = useState({ reservoirs: 0, capteurs: 0, alertes: 0 });
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const chargerDonnees = async () => {
      try {
        const [res, cap, alt] = await Promise.all([
          reservoirService.getReservoirs(),
          capteurService.getCapteurs(),
          alerteService.getAlertesActives(),
        ]);
        setStats({
          reservoirs: res.length || 0,
          capteurs: cap.length || 0,
          alertes: alt.length || 0,
        });
      } catch (err) {
        console.error('Erreur lors du chargement du dashboard', err);
      } finally {
        setChargement(false);
      }
    };
    chargerDonnees();
  }, []);

  if (chargement) return <div style={styles.padding}>Chargement du tableau de bord...</div>;

  return (
    <div style={styles.padding}>
      <h2>Tableau de Bord</h2>
      <div style={styles.grid}>
        <div style={styles.card}>
          <h3>Réservoirs</h3>
          <p style={styles.chiffre}>{stats.reservoirs}</p>
        </div>
        <div style={styles.card}>
          <h3>Capteurs Actifs</h3>
          <p style={styles.chiffre}>{stats.capteurs}</p>
        </div>
        <div style={{ ...styles.card, borderColor: stats.alertes > 0 ? '#dc3545' : '#ccc' }}>
          <h3>Alertes Actives</h3>
          <p style={{ ...styles.chiffre, color: stats.alertes > 0 ? '#dc3545' : '#28a745' }}>
            {stats.alertes}
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  padding: { padding: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1rem' },
  card: { padding: '1.5rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: '#fff', textAlign: 'center' },
  chiffre: { fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: '#007bff' },
};

export default TableauDeBord;
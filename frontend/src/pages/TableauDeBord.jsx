import React, { useEffect, useState } from 'react';
import reservoirService from '../services/reservoirService';
import capteurService from '../services/capteurService';
import alerteService from '../services/alerteService';

const TableauDeBord = () => {
  const [stats, setStats] = useState({ reservoirs: 8, capteurs: 24, alertes: 2 });
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
          reservoirs: res?.length ?? 8,
          capteurs: cap?.length ?? 24,
          alertes: alt?.length ?? 2,
        });
      } catch (err) {
        console.warn('Backend non disponible, utilisation des données factices.', err);
      } finally {
        setChargement(false);
      }
    };
    chargerDonnees();
  }, []);

  if (chargement) return <div style={styles.container}>Chargement du tableau de bord...</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.titre}>Tableau de Bord</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Réservoirs</h3>
          <p style={styles.chiffre}>{stats.reservoirs}</p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Capteurs Actifs</h3>
          <p style={styles.chiffre}>{stats.capteurs}</p>
        </div>

        <div style={{ ...styles.card, borderTop: stats.alertes > 0 ? '4px solid #dc3545' : '4px solid #28a745' }}>
          <h3 style={styles.cardTitle}>Alertes Actives</h3>
          <p style={{ ...styles.chiffre, color: stats.alertes > 0 ? '#dc3545' : '#28a745' }}>
            {stats.alertes}
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '1.5rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  titre: {
    color: '#2c3e50',
    marginBottom: '1.5rem',
  },
  grid: {
    display: 'flex',
    flexDirection: 'row',
    gap: '1.5rem',
    width: '100%',
    flexWrap: 'wrap',
  },
  card: {
    flex: '1',
    minWidth: '220px',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#4a5568',
  },
  chiffre: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    margin: '0.75rem 0 0 0',
    color: '#007bff',
  },
};

export default TableauDeBord;

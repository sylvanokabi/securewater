import React from 'react';

const JaugeReservoir = ({ nom, niveau, capacite, localisation }) => {
  const getCouleur = (pct) => {
    if (pct > 50) return '#22c55e'; // Vert
    if (pct >= 20) return '#f97316'; // Orange
    return '#ef4444'; // Rouge
  };

  const couleurActuelle = getCouleur(niveau);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h4 style={styles.nom}>{nom}</h4>
        <span style={styles.localisation}>{localisation}</span>
      </div>

      <div style={styles.jaugeContainer}>
        {/* Correction ici: style au lieu de styles */}
        <div style={styles.jaugeBackground}>
          <div
            style={{
              ...styles.jaugeRemplissage,
              height: `${niveau}%`,
              backgroundColor: couleurActuelle,
            }}
          />
        </div>
        <div style={styles.valeurContainer}>
          <span style={{ ...styles.pourcentage, color: couleurActuelle }}>
            {niveau}%
          </span>
          <span style={styles.capacite}>
            {((capacite * niveau) / 100).toLocaleString()} L / {capacite.toLocaleString()} L
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.25rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nom: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#1e293b',
  },
  localisation: {
    fontSize: '0.8rem',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  jaugeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  jaugeBackground: {
    width: '30px',
    height: '100px',
    backgroundColor: '#e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
  },
  jaugeRemplissage: {
    width: '100%',
    transition: 'height 0.5s ease-in-out, background-color 0.5s ease-in-out',
  },
  valeurContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  pourcentage: {
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  capacite: {
    fontSize: '0.85rem',
    color: '#64748b',
  },
};

export default JaugeReservoir;
import React, { useState, useEffect } from 'react';
import GraphiqueDebit from '../components/GraphiqueDebit';

const Reservoirs = () => {
  // Un seul réservoir principal
  const [reservoir, setReservoir] = useState({
    id: 1,
    nom: 'Réservoir Source Principal',
    niveau: 65, // Pourcentage de remplissage
    capacite: 20000, // Litres
    localisation: 'Station Centrale de Traitement',
    debitActuel: 120, // L/min
  });

  const [donneesDebit, setDonneesDebit] = useState([
    { temps: '10:00', debit: 115 },
    { temps: '10:05', debit: 120 },
    { temps: '10:10', debit: 118 },
    { temps: '10:15', debit: 125 },
    { temps: '10:20', debit: 122 },
  ]);

  // Simulation en temps réel du niveau d'eau et du débit
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // Varier légèrement le niveau d'eau et le débit
      const nouveauDebit = Math.floor(110 + Math.random() * 30);
      const variationNiveau = (Math.random() - 0.48) * 0.5; // Fluctuation minime

      setReservoir((prev) => ({
        ...prev,
        niveau: Math.min(100, Math.max(5, parseFloat((prev.niveau + variationNiveau).toFixed(1)))),
        debitActuel: nouveauDebit,
      }));

      setDonneesDebit((prev) => {
        const updated = [...prev, { temps: timeStr, debit: nouveauDebit }];
        if (updated.length > 10) updated.shift();
        return updated;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#0f172a', marginBottom: '1.5rem' }}>Réservoir Source Principal</h1>

      <div style={styles.container}>
        {/* Visualisation de la cuve d'eau avec animation d'onde */}
        <div style={styles.cardCuve}>
          <h3>Niveau d'Eau en Temps Réel</h3>
          <div style={styles.cuveOuter}>
            <div
              style={{
                ...styles.eauFluid,
                height: `${reservoir.niveau}%`,
              }}
            >
              <div style={styles.vague}></div>
            </div>
            <span style={styles.pourcentageTexte}>{reservoir.niveau}%</span>
          </div>
          <p style={{ marginTop: '1rem', fontWeight: 'bold', color: '#334155' }}>
            {((reservoir.capacite * reservoir.niveau) / 100).toLocaleString()} / {reservoir.capacite.toLocaleString()} Litres
          </p>
        </div>

        {/* Météorologie / Métriques rapides */}
        <div style={styles.cardInfos}>
          <h3>Spécifications & État</h3>
          <ul style={styles.listeSpec}>
            <li><strong>Nom :</strong> {reservoir.nom}</li>
            <li><strong>Emplacement :</strong> {reservoir.localisation}</li>
            <li><strong>Débit instantané :</strong> {reservoir.debitActuel} L/min</li>
            <li><strong>Capacité maximale :</strong> {reservoir.capacite.toLocaleString()} L</li>
            <li><strong>Statut :</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Opérationnel</span></li>
          </ul>
        </div>
      </div>

      {/* Graphique de débit pour le seul réservoir */}
      <div style={{ marginTop: '2rem' }}>
        <GraphiqueDebit donnees={donneesDebit} />
      </div>

      {/* Style CSS-in-JS pour l'effet de vague/flottement */}
      <style>{`
        @keyframes onduler {
          0% { transform: translateX(0) scaleY(1); }
          50% { transform: translateX(-25%) scaleY(1.1); }
          100% { transform: translateX(-50%) scaleY(1); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '2rem',
  },
  cardCuve: {
    background: '#ffffff',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    textAlign: 'center',
  },
  cardInfos: {
    background: '#ffffff',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  cuveOuter: {
    position: 'relative',
    width: '160px',
    height: '240px',
    border: '4px solid #334155',
    borderRadius: '0 0 16px 16px',
    margin: '1.5rem auto 0 auto',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  eauFluid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0284c7',
    transition: 'height 0.8s ease-in-out',
  },
  vague: {
    position: 'absolute',
    top: '-10px',
    left: 0,
    width: '200%',
    height: '20px',
    background: '#38bdf8',
    borderRadius: '40%',
    animation: 'onduler 4s infinite linear',
  },
  pourcentageTexte: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontWeight: 'bold',
    fontSize: '1.5rem',
    color: '#0f172a',
    zIndex: 2,
    textShadow: '0px 0px 4px rgba(255,255,255,0.8)',
  },
  listeSpec: {
    listStyle: 'none',
    padding: 0,
    lineHeight: '2.2rem',
    color: '#475569',
  },
};

export default Reservoirs;
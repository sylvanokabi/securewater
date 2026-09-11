import React, { useState, useEffect } from 'react';
import JaugeReservoir from '../components/JaugeReservoir';
import GraphiqueDebit from '../components/GraphiqueDebit';
import CarteReservoirs from '../components/CarteReservoirs';

const Reservoirs = () => {
  const [listeReservoirs] = useState([
    {
      id: 1,
      nom: 'Réservoir Principal - Nord',
      niveau: 75,
      capacite: 10000,
      localisation: 'Zone Industrielle',
      coords: [-4.300, 15.310],
    },
    {
      id: 2,
      nom: 'Réservoir Est',
      niveau: 35,
      capacite: 5000,
      localisation: 'Quartier Résidentiel',
      coords: [-4.330, 15.350],
    },
    {
      id: 3,
      nom: 'Réservoir Sud - Urgence',
      niveau: 12,
      capacite: 8000,
      localisation: 'Centre d\'Eau',
      coords: [-4.360, 15.290],
    },
  ]);

  const [donneesDebit, setDonneesDebit] = useState([
    { temps: '10:00', debitPrincipal: 120, debitEst: 85, debitSud: 40 },
    { temps: '10:05', debitPrincipal: 125, debitEst: 80, debitSud: 42 },
    { temps: '10:10', debitPrincipal: 118, debitEst: 90, debitSud: 38 },
    { temps: '10:15', debitPrincipal: 130, debitEst: 88, debitSud: 45 },
    { temps: '10:20', debitPrincipal: 140, debitEst: 92, debitSud: 50 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      setDonneesDebit((prev) => {
        const newEntry = {
          temps: timeStr,
          debitPrincipal: Math.floor(110 + Math.random() * 40),
          debitEst: Math.floor(75 + Math.random() * 25),
          debitSud: Math.floor(30 + Math.random() * 25),
        };
        const updated = [...prev, newEntry];
        if (updated.length > 10) updated.shift();
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '0.5rem' }}>
      <h1 style={{ color: '#1e293b', marginBottom: '1.5rem' }}>Gestion des Réservoirs</h1>
      
      {/* 1. Jauges dynamiques */}
      <div style={styles.grid}>
        {listeReservoirs.map((res) => (
          <JaugeReservoir
            key={res.id}
            nom={res.nom}
            niveau={res.niveau}
            capacite={res.capacite}
            localisation={res.localisation}
          />
        ))}
      </div>

      {/* 2. Graphique en direct */}
      <GraphiqueDebit donnees={donneesDebit} />

      {/* 3. Carte interactive */}
      <CarteReservoirs reservoirs={listeReservoirs} />
    </div>
  );
};

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
};

export default Reservoirs;
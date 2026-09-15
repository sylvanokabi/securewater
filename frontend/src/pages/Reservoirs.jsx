import React, { useState, useEffect } from 'react';
import GraphiqueDebit from '../components/GraphiqueDebit';
import { useWebSocket } from '../hooks/useWebSocket';

const Reservoirs = () => {
  const [reservoir, setReservoir] = useState({
    id: 1,
    nom: 'Réservoir Source Principal',
    niveau: 65,
    capacite: 20000,
    localisation: 'Station Centrale de Traitement',
    debitActuel: 120,
    statut: 'Opérationnel',
  });

  const [donneesDebit, setDonneesDebit] = useState([
    { temps: '10:00', debit: 115 },
    { temps: '10:05', debit: 120 },
    { temps: '10:10', debit: 118 },
    { temps: '10:15', debit: 125 },
    { temps: '10:20', debit: 122 },
  ]);

  // Connexion au serveur WebSocket Django Channels
  const WS_URL = 'ws://localhost:8000/ws/telemetrie/';
  const { data: websocketData, estConnecte } = useWebSocket(WS_URL);

  // Mise à jour de l'état lors de la réception des trames WebSocket
  useEffect(() => {
    if (websocketData) {
      const { niveau, debitActuel, temps, statut, nom, localisation, capacite } = websocketData;

      // 1. Mise à jour des informations du réservoir principal
      setReservoir((prev) => ({
        ...prev,
        nom: nom || prev.nom,
        localisation: localisation || prev.localisation,
        capacite: capacite || prev.capacite,
        statut: statut || prev.statut,
        niveau: niveau !== undefined ? niveau : prev.niveau,
        debitActuel: debitActuel !== undefined ? debitActuel : prev.debitActuel,
      }));

      // 2. Mise à jour de l'historique du graphique de débit
      if (debitActuel !== undefined) {
        const timestamp = temps || new Date().toLocaleTimeString();
        setDonneesDebit((prev) => {
          const updated = [...prev, { temps: timestamp, debit: debitActuel }];
          if (updated.length > 10) updated.shift();
          return updated;
        });
      }
    }
  }, [websocketData]);

  return (
    <div style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#0f172a', margin: 0 }}>{reservoir.nom}</h1>
        
        {/* Indicateur de statut WebSocket */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: estConnecte ? '#16a34a' : '#dc2626',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: '500' }}>
            {estConnecte ? 'Temps réel (WebSocket actif)' : 'Mode simulation / Hors ligne'}
          </span>
        </div>
      </div>

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

        {/* Métriques rapides */}
        <div style={styles.cardInfos}>
          <h3>Spécifications & État</h3>
          <ul style={styles.listeSpec}>
            <li><strong>Nom :</strong> {reservoir.nom}</li>
            <li><strong>Emplacement :</strong> {reservoir.localisation}</li>
            <li><strong>Débit instantané :</strong> {reservoir.debitActuel} L/min</li>
            <li><strong>Capacité maximale :</strong> {reservoir.capacite.toLocaleString()} L</li>
            <li>
              <strong>Statut :</strong>{' '}
              <span style={{ color: reservoir.statut === 'Opérationnel' ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                {reservoir.statut}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Graphique de débit */}
      <div style={{ marginTop: '2rem' }}>
        <GraphiqueDebit donnees={donneesDebit} />
      </div>

      {/* Animation CSS-in-JS pour la vague */}
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

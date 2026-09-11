import React from 'react';

const CarteNiveauEau = ({ nomReservoir, niveauPourcentage, capaciteLitres }) => {
  // Détermination de la couleur selon le niveau d'eau
  const getCouleur = (niveau) => {
    if (niveau < 20) return '#e74c3c'; // Danger : Rouge
    if (niveau < 40) return '#f39c12'; // Avertissement : Orange
    return '#2ecc71'; // Correct : Vert
  };

  const couleur = getCouleur(niveauPourcentage);

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{nomReservoir}</h3>
      <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#7f8c8d' }}>
        Capacité : {capaciteLitres.toLocaleString()} L
      </p>
      
      <div style={{ marginTop: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontWeight: 'bold' }}>
          <span>Niveau d'eau</span>
          <span style={{ color }}>{niveauPourcentage}%</span>
        </div>
        <div style={{ width: '100%', backgroundColor: '#ecf0f1', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${niveauPourcentage}%`,
              backgroundColor: couleur,
              height: '100%',
              transition: 'width 0.5s ease-in-out',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CarteNiveauEau;

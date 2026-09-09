import React from 'react';

const CarteDebit = ({ nomCapteur, debitActuel, debitMax }) => {
  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{nomCapteur}</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '10px' }}>
        <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
          {debitActuel}
        </span>
        <span style={{ color: '#7f8c8d' }}>L/s</span>
      </div>
      <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: '#95a5a6' }}>
        Débit maximal supporté : {debitMax} L/s
      </p>
    </div>
  );
};

export default CarteDebit;
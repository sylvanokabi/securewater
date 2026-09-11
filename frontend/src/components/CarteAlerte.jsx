import React from 'react';

const CarteAlerte = ({ titre, message, niveauUrgence, horodatage, acquittee, onAcquitter }) => {
  const getBorderColor = (niveau) => {
    if (niveau === 'CRITIQUE') return '#e74c3c';
    if (niveau === 'AVERTISSEMENT') return '#f39c12';
    return '#3498db';
  };

  return (
    <div
      style={{
        background: '#fff',
        padding: '15px',
        borderRadius: '6px',
        borderLeft: `6px solid ${getBorderColor(niveauUrgence)}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        marginBottom: '10px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong style={{ color: '#2c3e50' }}>{titre}</strong>
          <span style={{ fontSize: '0.75rem', color: '#95a5a6' }}>{horodatage}</span>
        </div>
        <p style={{ margin: '5px 0 0 0', color: '#555', fontSize: '0.9rem' }}>{message}</p>
      </div>

      {!acquittee && onAcquitter && (
        <button
          onClick={onAcquitter}
          style={{
            backgroundColor: '#ecf0f1',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: '#2c3e50',
          }}
        >
          Acquitter
        </button>
      )}
    </div>
  );
};

export default CarteAlerte;
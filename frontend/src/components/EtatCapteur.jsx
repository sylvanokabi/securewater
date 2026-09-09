import React from 'react';

const EtatCapteur = ({ nomCapteur, typeCapteur, statut, derniereMiseAJour }) => {
  const getBadgeStyle = (statut) => {
    switch (statut?.toLowerCase()) {
      case 'actif':
        return { bg: '#e8f8f5', text: '#27ae60' };
      case 'maintenance':
        return { bg: '#fef9e7', text: '#f39c12' };
      case 'inactif':
      case 'en_panne':
        return { bg: '#fadbd8', text: '#e74c3c' };
      default:
        return { bg: '#ebedef', text: '#7f8c8d' };
    }
  };

  const styleBadge = getBadgeStyle(statut);

  return (
    <div style={{ background: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h4 style={{ margin: '0 0 4px 0', color: '#2c3e50' }}>{nomCapteur}</h4>
        <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>Type : {typeCapteur}</span>
        {derniereMiseAJour && (
          <div style={{ fontSize: '0.75rem', color: '#bdc3c7', marginTop: '4px' }}>
            Maj : {derniereMiseAJour}
          </div>
        )}
      </div>

      <span
        style={{
          backgroundColor: styleBadge.bg,
          color: styleBadge.text,
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          textTransform: 'capitalize',
        }}
      >
        {statut}
      </span>
    </div>
  );
};

export default EtatCapteur;
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleDeconnexion = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/connexion');
  };

  return (
    <header
      style={{
        height: '60px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        padding: '0 25px',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#2c3e50' }}>
        Supervision du Réseau
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button
          onClick={handleDeconnexion}
          style={{
            backgroundColor: '#e74c3c',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
};

export default Navbar;

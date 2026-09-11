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
    <header style={styles.navbar}>
      <h3 style={styles.titre}>Supervision du Réseau SecureWater</h3>
      <button onClick={handleDeconnexion} style={styles.boutonDeconnexion}>
        Déconnexion
      </button>
    </header>
  );
};

const styles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between', // Pousse le titre à gauche et le bouton à l'extrême droite
    alignItems: 'center',
    width: '100%',
    padding: '1rem 2rem',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    boxSizing: 'border-box',
  },
  titre: {
    margin: 0,
    color: '#1a202c',
    fontSize: '1.1rem',
    fontWeight: '600',
  },
  boutonDeconnexion: {
    backgroundColor: '#dc3545',
    color: '#ffffff',
    border: 'none',
    padding: '0.5rem 1.25rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.875rem',
  },
};

export default Navbar;
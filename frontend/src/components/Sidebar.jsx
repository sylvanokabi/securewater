import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const linkStyle = ({ isActive }) => ({
    display: 'block',
    padding: '12px 20px',
    color: isActive ? '#3498db' : '#ecf0f1',
    backgroundColor: isActive ? '#2c3e50' : 'transparent',
    textDecoration: 'none',
    fontWeight: isActive ? 'bold' : 'normal',
    borderRadius: '4px',
    margin: '4px 0',
  });

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: '#34495e',
        color: '#fff',
        padding: '20px 10px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#3498db', fontSize: '1.5rem' }}>SecureWater</h2>
        <span style={{ fontSize: '0.75rem', color: '#bdc3c7' }}>IoT Monitoring Platform</span>
      </div>

      <nav style={{ flex: 1 }}>
        <NavLink to="/" style={linkStyle}>
          Tableau de bord
        </NavLink>
        <NavLink to="/reservoirs" style={linkStyle}>
          Réservoirs
        </NavLink>
        <NavLink to="/capteurs" style={linkStyle}>
          Capteurs
        </NavLink>
        <NavLink to="/alertes" style={linkStyle}>
          Alertes
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;

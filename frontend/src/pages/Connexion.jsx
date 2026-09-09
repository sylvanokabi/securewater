import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import utilisateurService from '../services/utilisateurService';

const Connexion = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);

    try {
      await utilisateurService.connexion(formData);
      // Redirection vers le tableau de bord après connexion réussie
      navigate('/');
    } catch (err) {
      setErreur(
        err.response?.data?.detail || 
        'Identifiants incorrects ou serveur inaccessible.'
      );
    } finally {
      setChargement(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.titre}>SecureWater</h2>
        <p style={styles.sousTitre}>Connexion à la plateforme IoT</p>

        {erreur && <div style={styles.erreur}>{erreur}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.group}>
            <label style={styles.label}>Nom d'utilisateur</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Ex: admin"
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={chargement} 
            style={styles.button}
          >
            {chargement ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <p style={styles.footerText}>
          Pas encore de compte ?{' '}
          <Link to="/inscription" style={styles.link}>
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

// Styles inline temporaires (remplaçables par Tailwind ou CSS propre)
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f4f6f9',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '2rem',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  titre: {
    textAlign: 'center',
    color: '#007bff',
    marginBottom: '0.5rem',
  },
  sousTitre: {
    textAlign: 'center',
    color: '#6c757d',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '1rem',
  },
  button: {
    padding: '0.75rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  erreur: {
    padding: '0.6rem',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  footerText: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.85rem',
    color: '#6c757d',
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
};

export default Connexion;
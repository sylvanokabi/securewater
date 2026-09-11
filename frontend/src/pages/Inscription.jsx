import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import utilisateurService from '../services/utilisateurService';

const Inscription = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
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
    setSucces('');

    // Vérification de la correspondance des mots de passe
    if (formData.password !== formData.confirmPassword) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }

    setChargement(true);

    try {
      // Extraction des champs nécessaires pour l'API
      const { confirmPassword, ...dataAEnvoyer } = formData;
      await utilisateurService.inscription(dataAEnvoyer);
      
      setSucces('Compte créé avec succès ! Redirection vers la page de connexion...');
      
      // Redirection après 2 secondes
      setTimeout(() => {
        navigate('/connexion');
      }, 2000);
    } catch (err) {
      if (err.response?.data) {
        // Formate les erreurs envoyées par Django REST Framework (ex: nom d'utilisateur déjà pris)
        const messages = Object.entries(err.response.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
          .join(' | ');
        setErreur(messages);
      } else {
        setErreur('Une erreur est survenue lors de l\'inscription.');
      }
    } finally {
      setChargement(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.titre}>SecureWater</h2>
        <p style={styles.sousTitre}>Créer un nouveau compte utilisateur</p>

        {erreur && <div style={styles.erreur}>{erreur}</div>}
        {succes && <div style={styles.succes}>{succes}</div>}

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
              placeholder="Ex: joel_doe"
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Adresse Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Ex: utilisateur@domain.com"
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

          <div style={styles.group}>
            <label style={styles.label}>Confirmer le mot de passe</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
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
            {chargement ? 'Création du compte...' : 'S\'inscrire'}
          </button>
        </form>

        <p style={styles.footerText}>
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" style={styles.link}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

// Styles inline
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f4f6f9',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
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
  succes: {
    padding: '0.6rem',
    backgroundColor: '#d4edda',
    color: '#155724',
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

export default Inscription;
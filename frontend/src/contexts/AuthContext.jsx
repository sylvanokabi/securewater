import React, { createContext, useState, useEffect, useContext } from 'react';
import utilisateurService from '../services/utilisateurService';

// 1. Création du contexte
const AuthContext = createContext(null);

// 2. Provider
export const AuthProvider = ({ children }) => {
  const [utilisateur, setUtilisateur] = useState(null);
  const [estConnecte, setEstConnecte] = useState(false);
  const [chargement, setChargement] = useState(true);

  // Vérification de la session au chargement de l'application
  useEffect(() => {
    const verifierSession = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const me = await utilisateurService.getProfil();
          setUtilisateur(me);
          setEstConnecte(true);
        } catch (error) {
          console.error('Session expirée ou invalide :', error);
          utilisateurService.déconnexion();
          setUtilisateur(null);
          setEstConnecte(false);
        }
      }
      setChargement(false);
    };

    verifierSession();
  }, []);

  // Action de connexion
  const connexion = async (credentials) => {
    const data = await utilisateurService.connexion(credentials);
    const profil = await utilisateurService.getProfil();
    setUtilisateur(profil);
    setEstConnecte(true);
    return data;
  };

  // Action de déconnexion
  const deconnexion = () => {
    utilisateurService.déconnexion();
    setUtilisateur(null);
    setEstConnecte(false);
  };

  const value = {
    utilisateur,
    estConnecte,
    chargement,
    connexion,
    deconnexion,
  };

  return (
    <AuthContext.Provider value={value}>
      {!chargement && children}
    </AuthContext.Provider>
  );
};

// 3. Hook personnalisé pour consommer le contexte facilement
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};

export default AuthContext;
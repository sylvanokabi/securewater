import React, { useEffect, useState } from 'react';
import { getProfilAPI, deconnexion } from '../services/auth';

const Navbar = () => {
  const [utilisateur, setUtilisateur] = useState(null);

  useEffect(() => {
    const chargerProfil = async () => {
      try {
        const data = await getProfilAPI();
        setUtilisateur(data);
      } catch (err) {
        console.error('Erreur chargement profil Navbar:', err);
      }
    };

    chargerProfil();
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">
        Supervision du Réseau SecureWater
      </h2>

      <div className="flex items-center gap-4">
        {utilisateur && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-slate-700">
              {utilisateur.username || utilisateur.email}
            </span>
          </div>
        )}

        <button 
          onClick={deconnexion} 
          className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
};

export default Navbar;

import React from 'react';

const Navbar = () => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">
        Supervision du Réseau SecureWater
      </h2>
      <button 
        onClick={() => console.log('Déconnexion')} 
        className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
      >
        Déconnexion
      </button>
    </header>
  );
};

export default Navbar;

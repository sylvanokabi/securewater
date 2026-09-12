import React from 'react';

const TableauDeBord = () => {
  return (
    <div className="p-2 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Tableau de Bord Global</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-500">Réservoirs Actifs</span>
          <p className="text-3xl font-bold text-slate-800 mt-1">3</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-500">Capteurs Déployés</span>
          <p className="text-3xl font-bold text-sky-600 mt-1">4</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-500">Volume Total Disponible</span>
          <p className="text-3xl font-bold text-emerald-600 mt-1">10,210 L</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-500">Alertes Actives</span>
          <p className="text-3xl font-bold text-rose-600 mt-1">1</p>
        </div>
      </div>
    </div>
  );
};

export default TableauDeBord;
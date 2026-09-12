import React, { useState } from 'react';

const Capteurs = () => {
  const [capteurs] = useState([
    { id: 'CAP-001', type: 'Débitmètre', reservoir: 'Réservoir Principal - Nord', statut: 'En ligne', batterie: 92, derniereMesure: '124 L/min' },
    { id: 'CAP-002', type: 'Niveau Ultra-sons', reservoir: 'Réservoir Principal - Nord', statut: 'En ligne', batterie: 88, derniereMesure: '75%' },
    { id: 'CAP-003', type: 'Débitmètre', reservoir: 'Réservoir Est', statut: 'Maintenance', batterie: 15, derniereMesure: '0 L/min' },
    { id: 'CAP-004', type: 'Niveau Ultra-sons', reservoir: 'Réservoir Sud - Urgence', statut: 'Hors ligne', batterie: 0, derniereMesure: '12%' },
  ]);

  return (
    <div className="p-2">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Gestion des Capteurs IoT</h1>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4">ID Capteur</th>
              <th className="p-4">Type</th>
              <th className="p-4">Réservoir Associé</th>
              <th className="p-4">Statut</th>
              <th className="p-4">Batterie</th>
              <th className="p-4">Dernière Valeur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {capteurs.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-semibold text-slate-800">{c.id}</td>
                <td className="p-4 text-slate-600">{c.type}</td>
                <td className="p-4 text-slate-600">{c.reservoir}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    c.statut === 'En ligne' ? 'bg-emerald-100 text-emerald-700' :
                    c.statut === 'Maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {c.statut}
                  </span>
                </td>
                <td className="p-4 text-slate-600">{c.batterie}%</td>
                <td className="p-4 font-mono font-medium text-slate-700">{c.derniereMesure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Capteurs;
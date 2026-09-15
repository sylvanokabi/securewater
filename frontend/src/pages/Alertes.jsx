import React, { useState } from 'react';

const Alertes = () => {
  const [alertes] = useState([
    { id: 1, titre: 'Niveau Critique Atteint', description: 'Le niveau du Réservoir Sud est tombé sous le seuil critique (12%).', gravite: 'Critique', horodatage: 'Aujourd\'hui, 10:14' },
    { id: 2, titre: 'Anomalie de Débit (Pression)', description: 'Baisse inhabituelle détectée sur le Réservoir Est (Suspection de fuite).', gravite: 'Avertissement', horodatage: 'Aujourd\'hui, 08:30' },
    { id: 3, titre: 'Capteur Hors Ligne', description: 'Le capteur CAP-004 ne répond plus depuis 2 heures.', gravite: 'Info', horodatage: 'Hier, 22:45' },
  ]);

  return (
    <div className="p-2">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Journal des Alertes</h1>

      <div className="flex flex-col gap-4">
        {alertes.map((a) => (
          <div key={a.id} className={`p-4 rounded-xl border flex items-start justify-between bg-white shadow-sm ${
            a.gravite === 'Critique' ? 'border-l-4 border-l-rose-500 border-slate-200' :
            a.gravite === 'Avertissement' ? 'border-l-4 border-l-amber-500 border-slate-200' : 'border-l-4 border-l-sky-500 border-slate-200'
          }`}>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-800">{a.titre}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  a.gravite === 'Critique' ? 'bg-rose-100 text-rose-700' :
                  a.gravite === 'Avertissement' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                }`}>
                  {a.gravite}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{a.description}</p>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">{a.horodatage}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alertes;
import React, { useEffect, useState } from 'react';

const Alertes = () => {
  const [alertes, setAlertes] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreGravite, setFiltreGravite] = useState('tous');

  const chargerAlertes = () => {
    const stock = JSON.parse(localStorage.getItem('securewater_alertes') || '[]');
    setAlertes(stock);
  };

  useEffect(() => {
    chargerAlertes();

    const handleNouvelleAlerte = (e) => {
      setAlertes((prev) => [e.detail, ...prev]);
    };

    window.addEventListener('securewater_nouvelle_alerte', handleNouvelleAlerte);
    return () => window.removeEventListener('securewater_nouvelle_alerte', handleNouvelleAlerte);
  }, []);

  const handleResoudre = (id) => {
    const maj = alertes.map((a) => (a.id === id ? { ...a, resolu: true } : a));
    setAlertes(maj);
    localStorage.setItem('securewater_alertes', JSON.stringify(maj));
  };

  const handleEffacerTout = () => {
    setAlertes([]);
    localStorage.removeItem('securewater_alertes');
  };

  const alertesFiltrees = alertes.filter((a) => {
    const matchStatut =
      filtreStatut === 'tous' ? true : filtreStatut === 'non_resolu' ? !a.resolu : a.resolu;
    const matchGravite =
      filtreGravite === 'tous' ? true : a.gravite?.toLowerCase() === filtreGravite.toLowerCase();
    return matchStatut && matchGravite;
  });

  const getStyleGravite = (gravite) => {
    switch (gravite?.toLowerCase()) {
      case 'critique':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'avertissement':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-sky-100 text-sky-700 border-sky-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Journal des Alertes (Simulation)</h1>
          <p className="text-sm text-slate-500">Notifications automatiques lors des franchissements de seuils</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200 text-xs text-emerald-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Surveillance temps réel active (0.5s)
          </div>

          <button
            onClick={handleEffacerTout}
            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg hover:bg-rose-100"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">STATUT</label>
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
            className="border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="tous">Toutes les alertes</option>
            <option value="non_resolu">Actives (Non résolues)</option>
            <option value="resolu">Archivées (Résolues)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">GRAVITÉ</label>
          <select
            value={filtreGravite}
            onChange={(e) => setFiltreGravite(e.target.value)}
            className="border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="tous">Toutes les gravités</option>
            <option value="critique">Critique</option>
            <option value="avertissement">Avertissement</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="p-4">Gravité</th>
              <th className="p-4">Type</th>
              <th className="p-4">Réservoir</th>
              <th className="p-4">Message</th>
              <th className="p-4">Horodatage</th>
              <th className="p-4">Statut</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {alertesFiltrees.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400">
                  Aucune alerte générée pour le moment.
                </td>
              </tr>
            ) : (
              alertesFiltrees.map((alerte) => (
                <tr key={alerte.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStyleGravite(alerte.gravite)}`}>
                      {alerte.gravite}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-800">{alerte.type_alerte}</td>
                  <td className="p-4">{alerte.reservoir_nom}</td>
                  <td className="p-4 text-slate-600 max-w-xs">{alerte.message}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">
                    {new Date(alerte.date_creation).toLocaleTimeString()}
                  </td>
                  <td className="p-4">
                    {alerte.resolu ? (
                      <span className="text-xs text-emerald-600 font-medium">✓ Résolu</span>
                    ) : (
                      <span className="text-xs text-rose-600 font-semibold animate-pulse">● En cours</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {!alerte.resolu && (
                      <button
                        onClick={() => handleResoudre(alerte.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg"
                      >
                        Marquer résolu
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Alertes;

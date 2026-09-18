import React, { useState, useEffect } from 'react';

const TableauDeBord = () => {
  const [stats, setStats] = useState({
    reservoirsActifs: 2,
    capteursDeployes: 6,
    volumeTotal: '15 000 L',
    alertesActives: 0,
    debitMoyen: '128.5 L/min',
    qualiteEau: 'Bonne (pH 7.2)',
  });

  const [alertesRecentes, setAlertesRecentes] = useState([]);

  useEffect(() => {
    const synchroniserDashboard = () => {
      const alertes = JSON.parse(localStorage.getItem('securewater_alertes') || '[]');
      const nonResolues = alertes.filter((a) => !a.resolu);

      setStats((prev) => ({
        ...prev,
        alertesActives: nonResolues.length,
      }));

      setAlertesRecentes(alertes.slice(0, 5));
    };

    synchroniserDashboard();
    const interval = setInterval(synchroniserDashboard, 1000);
    window.addEventListener('securewater_nouvelle_alerte', synchroniserDashboard);

    return () => {
      clearInterval(interval);
      window.removeEventListener('securewater_nouvelle_alerte', synchroniserDashboard);
    };
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tableau de Bord</h1>
          <p className="text-sm text-slate-500 mt-1">Supervision du réseau en mode simulation temps réel (0.5s)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Simulation Frontend Autonome
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">Réservoirs Actifs</span>
          <p className="text-3xl font-extrabold text-slate-900 mt-4">{stats.reservoirsActifs}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">Capteurs Déployés</span>
          <p className="text-3xl font-extrabold text-sky-600 mt-4">{stats.capteursDeployes}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">Capacité Totale Cumulée</span>
          <p className="text-3xl font-extrabold text-emerald-600 mt-4">{stats.volumeTotal}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">Alertes Actives</span>
          <p className="text-3xl font-extrabold text-rose-600 mt-4">{stats.alertesActives}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Dernières Alertes Générées</h2>
        <div className="space-y-3">
          {alertesRecentes.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune alerte enregistrée.</p>
          ) : (
            alertesRecentes.map((item) => (
              <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{item.type_alerte || 'Alerte'}</h3>
                  <p className="text-xs text-slate-500">{item.message}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${item.gravite === 'critique' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.gravite}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TableauDeBord;
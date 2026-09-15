import React, { useState } from 'react';

const TableauDeBord = () => {
  // État local pré-configuré pour la connexion future au backend Django/MQTT
  const [stats] = useState({
    reservoirsActifs: 3,
    capteursDeployes: 4,
    volumeTotal: '10,210 L',
    alertesActives: 1,
    debitMoyen: '124 L/min',
    qualiteEau: 'Bonne (pH 7.2)',
  });

  const [alertesRecentes] = useState([
    {
      id: 1,
      titre: 'Niveau d\'eau bas',
      source: 'Réservoir Sud - Urgence',
      heure: 'Il y a 10 min',
      severite: 'haute',
    },
    {
      id: 2,
      titre: 'Débit anormalement élevé',
      source: 'Capteur F-02 (Nord)',
      heure: 'Il y a 45 min',
      severite: 'moyenne',
    },
  ]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-8">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aperçu global du réseau de distribution d'eau en temps réel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Système connecté (IoT Active)
          </span>
        </div>
      </div>

      {/* Cartes KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Réservoirs Actifs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Réservoirs Actifs</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-4">{stats.reservoirsActifs}</p>
          <span className="text-xs text-emerald-600 font-medium mt-2 inline-block">100% opérationnels</span>
        </div>

        {/* Capteurs Déployés */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Capteurs Déployés</span>
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-sky-600 mt-4">{stats.capteursDeployes}</p>
          <span className="text-xs text-slate-400 mt-2 inline-block">Transmission OK</span>
        </div>

        {/* Volume Total Disponible */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Volume Total Disponible</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 mt-4">{stats.volumeTotal}</p>
          <span className="text-xs text-emerald-600 font-medium mt-2 inline-block">+2.4% vs hier</span>
        </div>

        {/* Alertes Actives */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Alertes Actives</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 mt-4">{stats.alertesActives}</p>
          <span className="text-xs text-rose-500 font-medium mt-2 inline-block">Action requise</span>
        </div>
      </div>

      {/* Section métriques secondaires & évènements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Résumé de l'état réseau */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Météorologie du Réseau</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Débit Moyen Réseau</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{stats.debitMoyen}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Qualité Globale de l'Eau</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{stats.qualiteEau}</p>
            </div>
          </div>
        </div>

        {/* Fil des dernières alertes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Dernières Notifications</h2>
          <div className="space-y-3">
            {alertesRecentes.map((item) => (
              <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{item.titre}</h3>
                  <p className="text-xs text-slate-500">{item.source}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">{item.heure}</span>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                  item.severite === 'haute' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {item.severite}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableauDeBord;
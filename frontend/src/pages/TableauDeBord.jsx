import React, { useState, useEffect } from 'react';
import fetchAPI from '../services/api';

const TableauDeBord = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    reservoirsActifs: 0,
    capteursDeployes: 0,
    volumeTotal: '0 L',
    alertesActives: 0,
    debitMoyen: 'N/A',
    qualiteEau: 'N/A',
  });

  const [alertesRecentes, setAlertesRecentes] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Appel parallèle des 3 endpoints REST
        const [resReservoirs, resCapteurs, resAlertes] = await Promise.all([
          fetchAPI('/reservoirs/'),
          fetchAPI('/capteurs/'),
          fetchAPI('/alertes/'),
        ]);

        // Extraction sécurisée compatible avec Axios (.data) et la pagination DRF (.results)
        const rawReservoirs =
          resReservoirs?.data?.results ||
          resReservoirs?.data ||
          resReservoirs?.results ||
          resReservoirs ||
          [];

        const rawCapteurs =
          resCapteurs?.data?.results ||
          resCapteurs?.data ||
          resCapteurs?.results ||
          resCapteurs ||
          [];

        const rawAlertes =
          resAlertes?.data?.results ||
          resAlertes?.data ||
          resAlertes?.results ||
          resAlertes ||
          [];

        const reservoirs = Array.isArray(rawReservoirs) ? rawReservoirs : [];
        const capteurs = Array.isArray(rawCapteurs) ? rawCapteurs : [];
        const alertes = Array.isArray(rawAlertes) ? rawAlertes : [];

        // Calcul de la capacité totale cumulée (basé sur capacite_max_litres)
        const volumeCumule = reservoirs.reduce(
          (acc, r) => acc + (parseFloat(r.capacite_max_litres) || 0),
          0
        );

        setStats({
          // Comptabilise les réservoirs actifs ou non renseignés
          reservoirsActifs: reservoirs.filter(
            (r) => !r.statut || r.statut.toLowerCase() === 'actif'
          ).length,
          capteursDeployes: capteurs.length,
          volumeTotal: `${volumeCumule.toLocaleString()} L`,
          alertesActives: alertes.filter((a) => !a.resolue).length,
          debitMoyen: '124 L/min',
          qualiteEau: 'Bonne (pH 7.2)',
        });

        setAlertesRecentes(alertes.slice(0, 5));
        setError(null);
      } catch (err) {
        console.error('Erreur de chargement du dashboard :', err);
        setError(err.message || 'Impossible de se connecter au serveur backend.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 text-sm font-medium animate-pulse">
          Chargement des télémétries Django via fetch...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm my-4">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-8">
      {/* En-tête */}
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

      {/* Cartes KPIs */}
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

      {/* Fil des notifications */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Dernières Notifications</h2>
        <div className="space-y-3">
          {alertesRecentes.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune alerte récente enregistrée.</p>
          ) : (
            alertesRecentes.map((item) => (
              <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{item.titre || item.message || 'Alerte Système'}</h3>
                  <p className="text-xs text-slate-500">Capteur : {item.capteur_code || item.capteur}</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-rose-100 text-rose-700">
                  {item.niveau || 'HAUTE'}
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

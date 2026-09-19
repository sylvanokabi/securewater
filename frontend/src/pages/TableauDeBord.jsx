import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getReservoirsAPI } from '../services/reservoirService';
import { getCapteursAPI } from '../services/capteurService';
import { getAlertesAPI } from '../services/alerteService';

const TableauDeBord = () => {
  // ================================================================
  // États
  // ================================================================
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [stats, setStats] = useState({
    reservoirsActifs: 0,
    capteursDeployes: 0,
    capteursEnLigne: 0,
    volumeTotalLitres: 0,
    alertesActives: 0,
    alertesCritiques: 0,
  });

  const [alertesRecentes, setAlertesRecentes] = useState([]);
  const [dernieresMesures, setDernieresMesures] = useState({}); // { capteurCode: { valeur, unite, ... } }

  // ================================================================
  // Refs pour éviter les boucles infinies
  // ================================================================
  const capteursRef = useRef([]);

  useEffect(() => {
    capteursRef.current = Object.keys(dernieresMesures).length > 0
      ? Object.keys(dernieresMesures)
      : [];
  }, [dernieresMesures]);

  // ================================================================
  // WebSocket global — toutes les alertes + mesures
  // ================================================================
  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
  const { data: messageWS, estConnecte } = useWebSocket(`${WS_BASE}/ws/telemetrie/`);

  // ================================================================
  // Chargement initial via REST
  // ================================================================
  const chargerDonnees = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);

      const [reservoirsData, capteursData, alertesData] = await Promise.all([
        getReservoirsAPI(),
        getCapteursAPI(),
        getAlertesAPI(),
      ]);

      const reservoirs = Array.isArray(reservoirsData?.results)
        ? reservoirsData.results
        : Array.isArray(reservoirsData)
        ? reservoirsData
        : [];
      const capteurs = Array.isArray(capteursData?.results)
        ? capteursData.results
        : Array.isArray(capteursData)
        ? capteursData
        : [];
      const alertes = Array.isArray(alertesData?.results)
        ? alertesData.results
        : Array.isArray(alertesData)
        ? alertesData
        : [];

      const volumeCumule = reservoirs.reduce(
        (acc, r) => acc + (parseFloat(r.capacite_max_litres) || 0),
        0
      );

      const alertesActives = alertes.filter(
        (a) => (a.statut || 'active') === 'active'
      );

      setStats({
        reservoirsActifs: reservoirs.filter(
          (r) => !r.statut || r.statut.toLowerCase() === 'actif'
        ).length,
        capteursDeployes: capteurs.length,
        capteursEnLigne: capteurs.filter((c) => c.en_ligne).length,
        volumeTotalLitres: volumeCumule,
        alertesActives: alertesActives.length,
        alertesCritiques: alertesActives.filter(
          (a) => a.gravite === 'critique'
        ).length,
      });

      setAlertesRecentes(
        alertes
          .slice()
          .sort(
            (a, b) =>
              new Date(b.date_declenchement || 0) -
              new Date(a.date_declenchement || 0)
          )
          .slice(0, 5)
      );
    } catch (err) {
      console.error('Erreur chargement dashboard :', err);
      setErreur(
        err?.response?.data?.detail ||
          err.message ||
          'Impossible de charger les données.'
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // ================================================================
  // Traitement des messages WebSocket
  // ================================================================
  useEffect(() => {
    if (!messageWS) return;
    const { type } = messageWS;

    // ---- Nouvelle mesure ----
    if (type === 'mesure') {
      setDernieresMesures((prev) => ({
        ...prev,
        [messageWS.capteur]: {
          valeur: messageWS.valeur,
          unite: messageWS.unite,
          pourcentage_remplissage: messageWS.pourcentage_remplissage,
          etat_niveau: messageWS.etat_niveau,
          horodatage: messageWS.horodatage,
        },
      }));
      return;
    }

    // ---- Nouvelle alerte ----
    if (type === 'alerte') {
      const nouvelle = {
        id: messageWS.alerte_id,
        type_alerte: messageWS.type_alerte,
        message: messageWS.message,
        gravite: messageWS.gravite,
        capteur_code: messageWS.capteur,
        statut: 'active',
        date_declenchement: messageWS.date_declenchement,
      };

      setAlertesRecentes((prev) => [nouvelle, ...prev].slice(0, 5));
      setStats((prev) => ({
        ...prev,
        alertesActives: prev.alertesActives + 1,
        alertesCritiques:
          messageWS.gravite === 'critique'
            ? prev.alertesCritiques + 1
            : prev.alertesCritiques,
      }));
      return;
    }

    // ---- Changement d'état d'un capteur ----
    if (type === 'capteur_etat') {
      setStats((prev) => {
        const delta = messageWS.en_ligne ? 1 : -1;
        return {
          ...prev,
          capteursEnLigne: Math.max(0, prev.capteursEnLigne + delta),
        };
      });
      return;
    }
  }, [messageWS]);

  // ================================================================
  // Rendu
  // ================================================================
  if (chargement) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 text-sm font-medium animate-pulse">
          Chargement des télémétries...
        </div>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm my-4">
        {erreur}
      </div>
    );
  }

  const formatVolume = (litres) => {
    if (litres >= 1000) {
      return `${(litres / 1000).toFixed(1)} m³`;
    }
    return `${litres.toFixed(0)} L`;
  };

  const styleGravite = (gravite) => {
    switch (gravite?.toLowerCase()) {
      case 'critique':
        return 'bg-rose-100 text-rose-700';
      case 'avertissement':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-sky-100 text-sky-700';
    }
  };

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
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              estConnecte
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            <span
              className={`w-2 h-2 mr-1.5 rounded-full ${
                estConnecte ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            {estConnecte ? 'Système connecté (IoT Actif)' : 'Hors ligne'}
          </span>
        </div>
      </div>

      {/* Cartes KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">
            Réservoirs actifs
          </span>
          <p className="text-3xl font-extrabold text-slate-900 mt-4">
            {stats.reservoirsActifs}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">
            Capteurs déployés
          </span>
          <p className="text-3xl font-extrabold text-sky-600 mt-4">
            {stats.capteursDeployes}
          </p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            {stats.capteursEnLigne} en ligne
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">
            Capacité totale
          </span>
          <p className="text-3xl font-extrabold text-emerald-600 mt-4">
            {formatVolume(stats.volumeTotalLitres)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-sm font-medium text-slate-500">
            Alertes actives
          </span>
          <p className="text-3xl font-extrabold text-rose-600 mt-4">
            {stats.alertesActives}
          </p>
          {stats.alertesCritiques > 0 && (
            <span className="text-xs text-rose-500 font-semibold mt-1 inline-block">
              ⚠ {stats.alertesCritiques} critique
              {stats.alertesCritiques > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Dernières mesures en direct */}
      {Object.keys(dernieresMesures).length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              Dernières mesures en direct
            </h2>
            <span className="text-xs text-slate-400">
              Mise à jour automatique
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(dernieresMesures)
              .slice(0, 8)
              .map(([code, m]) => (
                <div
                  key={code}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100"
                >
                  <div className="text-xs font-mono text-slate-500">{code}</div>
                  <div className="text-xl font-bold text-sky-700 mt-1">
                    {typeof m.valeur === 'number'
                      ? m.valeur.toFixed(2)
                      : m.valeur}{' '}
                    <span className="text-xs text-slate-400">{m.unite}</span>
                  </div>
                  {m.etat_niveau && (
                    <div className="text-[10px] uppercase font-semibold text-slate-500 mt-1">
                      {m.etat_niveau}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Dernières alertes */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          Dernières notifications
        </h2>

        <div className="space-y-3">
          {alertesRecentes.length === 0 ? (
            <p className="text-xs text-slate-400">
              Aucune alerte récente enregistrée.
            </p>
          ) : (
            alertesRecentes.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">
                    {item.message || 'Alerte système'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Capteur :{' '}
                    <span className="font-mono">
                      {item.capteur_code || item.capteur || '—'}
                    </span>
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase whitespace-nowrap ${styleGravite(
                    item.gravite
                  )}`}
                >
                  {item.gravite || 'info'}
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
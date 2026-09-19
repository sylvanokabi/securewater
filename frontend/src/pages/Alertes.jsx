import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getAlertesAPI, resoudreAlerteAPI } from '../services/alerteService';

const Alertes = () => {
  const [alertes, setAlertes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreGravite, setFiltreGravite] = useState('tous');

  // ================================================================
  // URL WebSocket — via variable d'env, SANS token (hook l'ajoute)
  // ================================================================
  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
  const { data: messageWS, estConnecte } = useWebSocket(
    `${WS_BASE}/ws/telemetrie/`
  );

  // ================================================================
  // Refs pour éviter les doublons (même alerte_id déjà reçue)
  // ================================================================
  const alertesIdsRef = useRef(new Set());

  // ================================================================
  // Charger les alertes depuis REST
  // ================================================================
  const chargerAlertes = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const data = await getAlertesAPI();
      const liste = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setAlertes(liste);
      alertesIdsRef.current = new Set(liste.map((a) => a.id));
    } catch (err) {
      setErreur(err.message || 'Erreur lors de la récupération des alertes.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerAlertes();
  }, [chargerAlertes]);

  // ================================================================
  // Traitement des messages WebSocket
  // ================================================================
  useEffect(() => {
    if (!messageWS) return;
    const { type } = messageWS;

    if (type === 'alerte') {
      const alerteId = messageWS.alerte_id;
      if (alertesIdsRef.current.has(alerteId)) return;
      alertesIdsRef.current.add(alerteId);

      const nouvelleAlerte = {
        id: alerteId,
        type: messageWS.type_alerte,
        type_alerte: messageWS.type_alerte,
        message: messageWS.message,
        gravite: messageWS.gravite,
        statut: 'active',
        capteur: messageWS.capteur,
        capteur_code: messageWS.capteur,
        valeur_mesure: messageWS.valeur_mesure,
        date_declenchement: messageWS.date_declenchement,
        date_creation: messageWS.date_declenchement,
      };

      setAlertes((prev) => [nouvelleAlerte, ...prev]);
    }
  }, [messageWS]);

  // ================================================================
  // Résolution manuelle
  // ================================================================
  const handleResoudre = async (id) => {
    try {
      await resoudreAlerteAPI(id);
      setAlertes((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                statut: 'resolue',
                resolu: true,
                date_resolution: new Date().toISOString(),
              }
            : a
        )
      );
    } catch (err) {
      alert(`Erreur lors de la résolution de l'alerte : ${err.message}`);
    }
  };

  // ================================================================
  // Filtrage
  // ================================================================
  const alertesFiltrees = alertes.filter((a) => {
    const statutAlerte = a.statut || (a.resolu ? 'resolue' : 'active');

    const matchStatut =
      filtreStatut === 'tous'
        ? true
        : filtreStatut === 'non_resolu'
        ? statutAlerte !== 'resolue'
        : statutAlerte === 'resolue';

    const matchGravite =
      filtreGravite === 'tous'
        ? true
        : a.gravite?.toLowerCase() === filtreGravite.toLowerCase();

    return matchStatut && matchGravite;
  });

  const getStyleGravite = (gravite) => {
    switch (gravite?.toLowerCase()) {
      case 'critique':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'avertissement':
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-sky-100 text-sky-700 border-sky-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Gestion des Alertes
          </h1>
          <p className="text-sm text-slate-500">
            Journal des anomalies et notifications système
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                estConnecte ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-slate-600">
              {estConnecte ? 'Surveillance Active' : 'Hors ligne'}
            </span>
          </div>

          <button
            onClick={chargerAlertes}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            STATUT
          </label>
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
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            GRAVITÉ
          </label>
          <select
            value={filtreGravite}
            onChange={(e) => setFiltreGravite(e.target.value)}
            className="border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="tous">Toutes les gravités</option>
            <option value="critique">Critique</option>
            <option value="avertissement">Avertissement</option>
            <option value="info">Information</option>
          </select>
        </div>
      </div>

      {erreur && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {erreur}
        </div>
      )}

      {/* Tableau */}
      {chargement ? (
        <div className="text-center py-12 text-slate-500">
          Chargement des alertes...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Gravité</th>
                <th className="p-4">Type</th>
                <th className="p-4">Capteur</th>
                <th className="p-4">Message</th>
                <th className="p-4">Date & Heure</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {alertesFiltrees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    Aucune alerte trouvée.
                  </td>
                </tr>
              ) : (
                alertesFiltrees.map((alerte) => {
                  const statutAlerte =
                    alerte.statut || (alerte.resolu ? 'resolue' : 'active');
                  const estResolue = statutAlerte === 'resolue';

                  return (
                    <tr
                      key={alerte.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStyleGravite(
                            alerte.gravite
                          )}`}
                        >
                          {alerte.gravite || 'info'}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-800">
                        {alerte.type_alerte || alerte.type || 'N/A'}
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500">
                        {alerte.capteur_code || alerte.capteur || '—'}
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate">
                        {alerte.message}
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500">
                        {alerte.date_declenchement || alerte.date_creation
                          ? new Date(
                              alerte.date_declenchement || alerte.date_creation
                            ).toLocaleString('fr-FR')
                          : 'N/A'}
                      </td>
                      <td className="p-4">
                        {estResolue ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            ✓ Résolu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-semibold">
                            ● En cours
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!estResolue && (
                          <button
                            onClick={() => handleResoudre(alerte.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors"
                          >
                            Marquer résolu
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Alertes;
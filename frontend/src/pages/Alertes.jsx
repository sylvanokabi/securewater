import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getAlertesAPI, resoudreAlerteAPI } from '../services/alerteService';

const Alertes = () => {
  const [alertes, setAlertes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous'); // 'tous', 'non_resolu', 'resolu'
  const [filtreGravite, setFiltreGravite] = useState('tous');

  // WebSocket pour recevoir les alertes générées en temps réel
  const WS_URL = 'ws://127.0.0.1:8000/ws/telemetrie/';
  const { data: websocketData, estConnecte } = useWebSocket(WS_URL);

  const chargerAlertes = async () => {
    setChargement(true);
    setErreur('');
    try {
      const data = await getAlertesAPI();
      const liste = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setAlertes(liste);
    } catch (err) {
      setErreur(err.message || 'Erreur lors de la récupération des alertes.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerAlertes();
  }, []);

  // Intercepter les trames WebSocket contenant une alerte
  useEffect(() => {
    if (!websocketData) return;

    if (websocketData.type_evenement === 'alerte' || websocketData.alerte) {
      const nouvelleAlerte = websocketData.alerte || {
        id: Date.now(),
        type_alerte: websocketData.type_alerte || 'Seuil Dépassé',
        message: websocketData.message || 'Anomalie détectée sur le réseau.',
        gravite: websocketData.gravite || 'avertissement',
        resolu: false,
        date_creation: new Date().toISOString(),
        reservoir_nom: websocketData.reservoir_nom || `Réservoir #${websocketData.reservoir_id || ''}`,
      };

      setAlertes((prev) => [nouvelleAlerte, ...prev]);
    }
  }, [websocketData]);

  const handleResoudre = async (id) => {
    try {
      await resoudreAlerteAPI(id);
      setAlertes((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolu: true, date_resolution: new Date().toISOString() } : a))
      );
    } catch (err) {
      alert(`Erreur lors de la résolution de l'alerte : ${err.message}`);
    }
  };

  // Filtrage des alertes
  const alertesFiltrees = alertes.filter((a) => {
    const matchStatut =
      filtreStatut === 'tous'
        ? true
        : filtreStatut === 'non_resolu'
        ? !a.resolu
        : a.resolu;

    const matchGravite =
      filtreGravite === 'tous' ? true : a.gravite?.toLowerCase() === filtreGravite.toLowerCase();

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
      {/* En-tête & Statut du Direct */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Alertes</h1>
          <p className="text-sm text-slate-500">Journal des anomalies et notifications système</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${estConnecte ? 'bg-emerald-500' : 'bg-rose-500'}`} />
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

      {/* Barre de filtres */}
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
            <option value="info">Information</option>
          </select>
        </div>
      </div>

      {erreur && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{erreur}</div>
      )}

      {/* Tableau des alertes */}
      {chargement ? (
        <div className="text-center py-12 text-slate-500">Chargement des alertes...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Gravité</th>
                <th className="p-4">Type</th>
                <th className="p-4">Réservoir</th>
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
                alertesFiltrees.map((alerte) => (
                  <tr key={alerte.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStyleGravite(
                          alerte.gravite
                        )}`}
                      >
                        {alerte.gravite || 'info'}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-800">{alerte.type_alerte || 'Déversement / Seuil'}</td>
                    <td className="p-4">{alerte.reservoir_nom || `Réservoir #${alerte.reservoir}`}</td>
                    <td className="p-4 text-slate-600 max-w-xs truncate">{alerte.message}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">
                      {alerte.date_creation
                        ? new Date(alerte.date_creation).toLocaleString('fr-FR')
                        : 'N/A'}
                    </td>
                    <td className="p-4">
                      {alerte.resolu ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          ✓ Résolu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-semibold animate-pulse">
                          ● En cours
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {!alerte.resolu && (
                        <button
                          onClick={() => handleResoudre(alerte.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors"
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
      )}
    </div>
  );
};

export default Alertes;
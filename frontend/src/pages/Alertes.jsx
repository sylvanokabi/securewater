import React, { useEffect, useState } from 'react';
import { getAlertesAPI, acquitterAlerteAPI } from '../services/alerteService';

const Alertes = () => {
  const [alertes, setAlertes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const chargerAlertes = async () => {
    setChargement(true);
    setErreur('');
    try {
      const data = await getAlertesAPI();
      setAlertes(data);
    } catch (err) {
      setErreur(err.message || 'Erreur lors du chargement des alertes.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerAlertes();
  }, []);

  const handleAcquitter = async (id) => {
    try {
      await acquitterAlerteAPI(id);
      chargerAlertes();
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const getSeveriteBadge = (niveau) => {
    switch (niveau) {
      case 'CRITIQUE':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'AVERTISSEMENT':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alertes & Notifications</h1>
          <p className="text-sm text-slate-500">Journal des dépassements de seuils de niveau et d'anomalies</p>
        </div>
        <button
          onClick={chargerAlertes}
          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-colors"
        >
          Rafraîchir
        </button>
      </div>

      {erreur && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">{erreur}</div>
      )}

      {chargement ? (
        <div className="text-center py-12 text-slate-500">Chargement des alertes...</div>
      ) : alertes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          Aucune alerte enregistrée pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {alertes.map((alerte) => (
            <div
              key={alerte.id}
              className={`p-4 rounded-xl border bg-white flex items-start justify-between shadow-sm ${
                alerte.acquitte ? 'opacity-60 border-slate-200' : 'border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSeveriteBadge(alerte.niveau)}`}>
                    {alerte.niveau}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{alerte.titre || 'Alerte Système'}</span>
                  <span className="text-xs text-slate-400">
                    — {new Date(alerte.date_creation || alerte.timestamp).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{alerte.message}</p>
                <div className="text-xs text-slate-400">
                  Réservoir: <span className="font-medium text-slate-600">{alerte.reservoir_nom || alerte.reservoir}</span>
                </div>
              </div>

              <div>
                {alerte.acquitte ? (
                  <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg font-medium">
                    Acquittée
                  </span>
                ) : (
                  <button
                    onClick={() => handleAcquitter(alerte.id)}
                    className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Acquitter
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alertes;
import React, { useEffect, useState, useCallback } from 'react';
import { getJournalAPI } from '../services/securiteService';

const POLL_MS = 3000;

const SecuriteJournal = () => {
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    try {
      const data = await getJournalAPI(100);
      setEvenements(data);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, POLL_MS);
    return () => clearInterval(id);
  }, [charger]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Journal des événements de sécurité
        </h1>
        <p className="text-sm text-slate-500">
          Historique de toutes les tentatives de connexion au broker MQTT
        </p>
      </div>

      {chargement ? (
        <div className="text-center py-12 text-slate-500">Chargement...</div>
      ) : evenements.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-500">
          Aucun événement. Allez sur la page{' '}
          <span className="font-semibold text-sky-700">Certificats</span> pour lancer
          un test.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Scénario</th>
                <th className="p-4">Résultat</th>
                <th className="p-4">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {evenements.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono text-xs text-slate-500">
                    {new Date(e.timestamp).toLocaleString('fr-FR')}
                  </td>
                  <td className="p-4 font-medium text-slate-800">
                    {e.type_libelle}
                  </td>
                  <td className="p-4">
                    {e.resultat === 'accepte' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        ✅ Accepté
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                        ❌ Refusé
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-slate-600 truncate max-w-md">
                    {e.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SecuriteJournal;
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  demarrerSimulationAPI,
  arreterSimulationAPI,
  getEtatSimulationAPI,
  SCENARIOS,
} from '../services/simulationService';
import { getReservoirsAPI } from '../services/reservoirService';
import { getCapteursAPI } from '../services/capteurService';

const POLL_INTERVAL_MS = 2000;

const Simulation = () => {
  // Formulaire
  const [reservoirs, setReservoirs] = useState([]);
  const [capteursReservoir, setCapteursReservoir] = useState([]);
  const [form, setForm] = useState({
    reservoir: '',
    scenario: 'normal',
    intervalle: 3.0,
  });

  // État simulation
  const [etat, setEtat] = useState({
    en_cours: false,
    pid: null,
    reservoir: null,
    scenario: null,
    capteurs_niveau: [],
    capteurs_debit: [],
    intervalle: 0,
    date_debut: null,
    duree_ecoulee: 0,
    derniers_logs: [],
  });

  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  const logsRef = useRef(null);
  const pollRef = useRef(null);

  // ----------------------------------------------------------------
  // Init : réservoirs + état
  // ----------------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      try {
        const [resData, etatData] = await Promise.all([
          getReservoirsAPI(),
          getEtatSimulationAPI(),
        ]);
        const liste = Array.isArray(resData?.results)
          ? resData.results
          : Array.isArray(resData)
          ? resData
          : [];
        setReservoirs(liste);
        setEtat(etatData);

        if (etatData.en_cours && etatData.reservoir) {
          setForm((prev) => ({ ...prev, reservoir: etatData.reservoir }));
        } else if (liste.length > 0) {
          setForm((prev) => ({ ...prev, reservoir: liste[0].code }));
        }
      } catch (err) {
        setErreur(err.message || 'Erreur de chargement.');
      } finally {
        setChargement(false);
      }
    };
    init();
  }, []);

  // ----------------------------------------------------------------
  // Charge les capteurs du réservoir sélectionné
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!form.reservoir) {
      setCapteursReservoir([]);
      return;
    }

    const trouverReservoir = reservoirs.find((r) => r.code === form.reservoir);
    if (!trouverReservoir) return;

    let annule = false;
    getCapteursAPI({ reservoir: trouverReservoir.id })
      .then((data) => {
        if (annule) return;
        const liste = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        // Filtre les capteurs actifs
        setCapteursReservoir(liste.filter((c) => c.statut === 'actif'));
      })
      .catch(() => {
        if (!annule) setCapteursReservoir([]);
      });

    return () => {
      annule = true;
    };
  }, [form.reservoir, reservoirs]);

  // ----------------------------------------------------------------
  // Polling de l'état
  // ----------------------------------------------------------------
  const rafraichirEtat = useCallback(async () => {
    try {
      const data = await getEtatSimulationAPI();
      setEtat(data);
    } catch (err) {
      // silencieux
    }
  }, []);

  useEffect(() => {
    if (etat.en_cours) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(rafraichirEtat, POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [etat.en_cours, rafraichirEtat]);

  // Auto-scroll journal
  useEffect(() => {
    if (logsRef.current && etat.derniers_logs) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [etat.derniers_logs]);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDemarrer = async () => {
    setErreur('');
    setSucces('');
    setActionEnCours(true);
    try {
      const payload = {
        reservoir: form.reservoir,
        scenario: form.scenario,
        intervalle: parseFloat(form.intervalle),
      };
      const data = await demarrerSimulationAPI(payload);
      setEtat((prev) => ({
        ...prev,
        ...data,
        derniers_logs: data.derniers_logs || prev.derniers_logs || [],
      }));
      setSucces(`Simulation démarrée (PID ${data.pid}).`);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setErreur(msg || 'Erreur lors du démarrage.');
    } finally {
      setActionEnCours(false);
    }
  };

  const handleArreter = async () => {
    setErreur('');
    setSucces('');
    setActionEnCours(true);
    try {
      const data = await arreterSimulationAPI();
      setEtat((prev) => ({
        ...prev,
        ...data,
        derniers_logs: data.derniers_logs || prev.derniers_logs || [],
      }));
      setSucces('Simulation arrêtée.');
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setErreur(msg || "Erreur lors de l'arrêt.");
    } finally {
      setActionEnCours(false);
    }
  };

  const formatDuree = (sec) => {
    if (!sec) return '0s';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const scenarioCourant = SCENARIOS.find((s) => s.id === form.scenario);

  const nbNiveaux = capteursReservoir.filter((c) => c.type === 'niveau').length;
  const nbDebits = capteursReservoir.filter((c) => c.type === 'debit').length;

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------
  if (chargement) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center text-slate-500">
        Chargement...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Contrôle du Simulateur
          </h1>
          <p className="text-sm text-slate-500">
            Génère des mesures IoT réalistes sans avoir besoin de capteurs physiques.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
            etat.en_cours
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              etat.en_cours ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          {etat.en_cours ? 'Simulation en cours' : 'Arrêtée'}
        </div>
      </div>

      {/* Bandeau d'aide */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-900">
        <strong>📋 Comment lancer une simulation :</strong>
        <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
          <li>
            Choisissez d'abord un <Link to="/reservoirs" className="underline font-semibold">réservoir</Link>.
          </li>
          <li>
            Assurez-vous qu'il a des <Link to="/capteurs" className="underline font-semibold">capteurs actifs</Link>.
          </li>
          <li>
            Puis lancez la simulation ci-dessous. Le simulateur utilisera automatiquement
            les capteurs existants.
          </li>
        </ol>
      </div>

      {/* Messages */}
      {erreur && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {erreur}
        </div>
      )}
      {succes && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
          {succes}
        </div>
      )}

      {/* Grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Paramètres de la simulation
          </h2>

          {/* Réservoir */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              RÉSERVOIR CIBLE
            </label>
            <select
              name="reservoir"
              value={form.reservoir}
              onChange={handleChange}
              disabled={etat.en_cours}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-50"
            >
              <option value="">Sélectionner un réservoir</option>
              {reservoirs.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.nom} ({r.code})
                </option>
              ))}
            </select>
          </div>

          {/* Capteurs détectés */}
          {form.reservoir && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                CAPTEURS DÉTECTÉS POUR CE RÉSERVOIR
              </div>
              {capteursReservoir.length === 0 ? (
                <div className="text-xs text-red-600">
                  ⚠ Aucun capteur actif.{' '}
                  <Link to="/capteurs" className="underline font-semibold">
                    En créer un →
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-slate-700 space-y-1">
                  {nbNiveaux > 0 && (
                    <div>
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border">
                        {nbNiveaux} capteur{nbNiveaux > 1 ? 's' : ''} de niveau
                      </span>
                    </div>
                  )}
                  {nbDebits > 0 && (
                    <div>
                      <span className="font-mono bg-white px-1.5 py-0.5 rounded border">
                        {nbDebits} capteur{nbDebits > 1 ? 's' : ''} de débit
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scénario */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              SCÉNARIO
            </label>
            <select
              name="scenario"
              value={form.scenario}
              onChange={handleChange}
              disabled={etat.en_cours}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-50"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {scenarioCourant && (
              <p className="text-xs text-slate-500 mt-1 italic">
                {scenarioCourant.description}
              </p>
            )}
          </div>

          {/* Intervalle */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              INTERVALLE (s)
            </label>
            <input
              type="number"
              name="intervalle"
              min="0.5"
              max="60"
              step="0.5"
              value={form.intervalle}
              onChange={handleChange}
              disabled={etat.en_cours}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-50"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleDemarrer}
              disabled={
                etat.en_cours ||
                actionEnCours ||
                !form.reservoir ||
                capteursReservoir.length === 0
              }
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {actionEnCours && !etat.en_cours ? 'Démarrage...' : '▶ Démarrer'}
            </button>
            <button
              onClick={handleArreter}
              disabled={!etat.en_cours || actionEnCours}
              className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {actionEnCours && etat.en_cours ? 'Arrêt...' : '■ Arrêter'}
            </button>
          </div>
        </div>

        {/* État */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            État actuel
          </h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                RÉSERVOIR
              </div>
              <div className="font-mono text-slate-800">
                {etat.reservoir || '—'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">
                SCÉNARIO
              </div>
              <div className="font-mono text-slate-800">
                {etat.scenario || '—'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">
                CAPTEURS NIVEAU
              </div>
              <div className="font-mono text-slate-800">
                {etat.capteurs_niveau?.length || 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">
                CAPTEURS DÉBIT
              </div>
              <div className="font-mono text-slate-800">
                {etat.capteurs_debit?.length || 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">DURÉE</div>
              <div className="font-mono text-slate-800">
                {etat.en_cours ? formatDuree(etat.duree_ecoulee) : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">PID</div>
              <div className="font-mono text-slate-800">{etat.pid || '—'}</div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              JOURNAL
            </div>
            <div
              ref={logsRef}
              className="bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg h-64 overflow-y-auto whitespace-pre-wrap"
            >
              {!etat.derniers_logs || etat.derniers_logs.length === 0 ? (
                <span className="text-slate-500">
                  Aucun log pour le moment...
                </span>
              ) : (
                etat.derniers_logs.join('\n')
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulation;
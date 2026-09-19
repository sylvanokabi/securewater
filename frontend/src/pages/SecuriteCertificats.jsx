import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  getCertificatsAPI,
  getScenariosAPI,
  testerConnexionAPI,
} from '../services/securiteService';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  demarrerSimulationAPI,
  arreterSimulationAPI,
  getEtatSimulationAPI,
} from '../services/simulationService';
import { getReservoirsAPI } from '../services/reservoirService';

const POLL_MS = 2000;

// ================================================================
// Error Boundary — capture les crashes et affiche un message
// ================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, erreur: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, erreur: error };
  }

  componentDidCatch(error, info) {
    console.error('[SecuriteCertificats] Crash React :', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-3xl mx-auto">
          <div className="p-6 bg-rose-50 border border-rose-300 rounded-xl">
            <h2 className="text-lg font-bold text-rose-800">
              ⚠ Une erreur est survenue sur cette page
            </h2>
            <p className="text-sm text-rose-700 mt-2 font-mono">
              {this.state.erreur?.message || 'Erreur inconnue'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, erreur: null })}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ================================================================
// Utilitaires
// ================================================================
const toNum = (v, def = 0) => {
  const n = Number(v);
  return isFinite(n) ? n : def;
};

// ================================================================
// Page
// ================================================================
const SecuriteCertificatsInner = () => {
  // ---- Certificats + tests ----
  const [certificats, setCertificats] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [resultats, setResultats] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enTest, setEnTest] = useState(null);
  const [testEnSerie, setTestEnSerie] = useState(false);

  // ---- Simulation ----
  const [reservoirs, setReservoirs] = useState([]);
  const [reservoirDemo, setReservoirDemo] = useState(null);
  const [etatReservoir, setEtatReservoir] = useState({
    niveau: 0,
    debit: 0,
    alertesActives: 0,
  });
  const [etatSimulation, setEtatSimulation] = useState(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [messageInfo, setMessageInfo] = useState('');

  // ---- WebSocket ----
  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
  const { data: messageWS, estConnecte } = useWebSocket(
    `${WS_BASE}/ws/telemetrie/`
  );

  const reservoirRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    reservoirRef.current = reservoirDemo;
  }, [reservoirDemo]);

  // ================================================================
  // Chargement initial
  // ================================================================
  useEffect(() => {
    const charger = async () => {
      try {
        const [certs, sc, res] = await Promise.all([
          getCertificatsAPI(),
          getScenariosAPI(),
          getReservoirsAPI(),
        ]);
        setCertificats(Array.isArray(certs) ? certs : []);
        setScenarios(Array.isArray(sc) ? sc : []);
        const listeRes = Array.isArray(res?.results)
          ? res.results
          : Array.isArray(res)
          ? res
          : [];
        setReservoirs(listeRes);
        if (listeRes.length > 0) setReservoirDemo(listeRes[0]);
      } catch (err) {
        setMessageInfo(`Erreur de chargement : ${err.message}`);
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, []);

  // ================================================================
  // Traitement WebSocket — ULTRA DÉFENSIF
  // ================================================================
  useEffect(() => {
    if (!messageWS || typeof messageWS !== 'object') return;
    const { type } = messageWS;

    // ---- Nouvelle mesure ----
    if (type === 'mesure') {
      const r = reservoirRef.current;
      if (!r) return;
      if (messageWS.reservoir !== r.code) return;

      const pct = messageWS.pourcentage_remplissage;
      // ⚠️ Test crucial : typeof number (rejette null ET undefined ET string)
      if (typeof pct === 'number' && isFinite(pct)) {
        setEtatReservoir((prev) => ({ ...prev, niveau: pct }));
      }

      const val = messageWS.valeur;
      if (
        messageWS.unite === 'L/min' &&
        typeof val === 'number' &&
        isFinite(val)
      ) {
        setEtatReservoir((prev) => ({ ...prev, debit: val }));
      }
      return;
    }

    // ---- Nouvelle alerte ----
    if (type === 'alerte') {
      setEtatReservoir((prev) => ({
        ...prev,
        alertesActives: toNum(prev.alertesActives) + 1,
      }));
      return;
    }
  }, [messageWS]);

  // ================================================================
  // Polling état simulation
  // ================================================================
  const rafraichirEtatSim = useCallback(async () => {
    try {
      const data = await getEtatSimulationAPI();
      setEtatSimulation(data);
    } catch (e) {
      // silencieux
    }
  }, []);

  useEffect(() => {
    if (etatSimulation?.en_cours) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(rafraichirEtatSim, POLL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [etatSimulation?.en_cours, rafraichirEtatSim]);

  // ================================================================
  // Actions — tests
  // ================================================================
  const lancerTest = async (scenarioId) => {
    setEnTest(scenarioId);
    try {
      const resultat = await testerConnexionAPI(scenarioId);
      setResultats((prev) => ({ ...prev, [scenarioId]: resultat }));
    } catch (err) {
      setResultats((prev) => ({
        ...prev,
        [scenarioId]: {
          erreur: true,
          message: err?.response?.data?.detail || err.message,
          conforme: false,
          resultat: 'erreur',
          scenario: scenarioId,
        },
      }));
    } finally {
      setEnTest(null);
    }
  };

  const lancerTousLesTests = async () => {
    setTestEnSerie(true);
    setResultats({});
    try {
      for (const sc of scenarios) {
        await lancerTest(sc.id);
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setTestEnSerie(false);
    }
  };

  // ================================================================
  // Actions — simulation
  // ================================================================
  const demarrerSimulation = async () => {
    if (!reservoirDemo) {
      setMessageInfo('❌ Aucun réservoir disponible.');
      return;
    }
    setActionEnCours(true);
    setMessageInfo('🚀 Démarrage de la simulation...');
    try {
      const data = await demarrerSimulationAPI({
        reservoir: reservoirDemo.code,
        scenario: 'vidange',
        intervalle: 2,
      });
      setEtatSimulation(data);
      setMessageInfo('✅ Simulation démarrée.');
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      setMessageInfo(`⚠️ ${msg}`);
    } finally {
      setActionEnCours(false);
    }
  };

    const arreterSimulation = async () => {
    setActionEnCours(true);
    try {
      // ⚠️ On appelle TOUJOURS l'API — même si on pense qu'il n'y a rien
      //    Le backend répondra 400 si aucune simulation n'est en cours.
      await arreterSimulationAPI();
      setEtatSimulation(null);
      setEtatReservoir({ niveau: 0, debit: 0, alertesActives: 0 });
      setMessageInfo('⏹ Simulation arrêtée.');
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      // Cas : "Aucune simulation en cours" → on nettoie quand même l'état local
      setEtatSimulation(null);
      setEtatReservoir({ niveau: 0, debit: 0, alertesActives: 0 });
      setMessageInfo(`⏹ ${msg}`);
    } finally {
      setActionEnCours(false);
    }
  };

  // ================================================================
  // Démo complète = simulation + tous les tests
  // ================================================================
  const lancerDemoComplete = async () => {
    if (!reservoirDemo) {
      setMessageInfo('❌ Aucun réservoir disponible.');
      return;
    }
    setResultats({});
    setEtatReservoir({ niveau: 0, debit: 0, alertesActives: 0 });

    await demarrerSimulation();
    await new Promise((r) => setTimeout(r, 2500));
    await lancerTousLesTests();

    setMessageInfo('🎉 Démonstration complète terminée !');
  };

  // ================================================================
  // Couleur de la jauge
  // ================================================================
  const niveau = toNum(etatReservoir.niveau);
  const debit = toNum(etatReservoir.debit);
  const alertes = toNum(etatReservoir.alertesActives);

  const couleurJauge =
    niveau <= 10 || niveau >= 95
      ? '#ef4444'
      : niveau <= 25 || niveau >= 90
      ? '#f97316'
      : '#0284c7';

  // ================================================================
  // Composants internes
  // ================================================================
  const CarteCertificat = ({ cert }) => {
    const icone = cert.fichier?.includes('ca')
      ? '🏛️'
      : cert.fichier?.includes('server')
      ? '📡'
      : cert.fichier?.includes('client')
      ? '💻'
      : '🤖';

    const couleur = cert.fichier?.includes('ca')
      ? 'border-violet-300 bg-violet-50'
      : cert.fichier?.includes('server')
      ? 'border-amber-300 bg-amber-50'
      : cert.fichier?.includes('client')
      ? 'border-sky-300 bg-sky-50'
      : 'border-emerald-300 bg-emerald-50';

    return (
      <div
        className={`p-4 border rounded-xl ${couleur} flex flex-col gap-2 min-w-0`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{icone}</span>
            <div className="min-w-0">
              <div className="font-mono font-semibold text-slate-800 text-sm truncate">
                {cert.fichier}
              </div>
              <div className="text-xs text-slate-600 truncate">
                {cert.role}
              </div>
            </div>
          </div>
          {cert.a_cle_privee && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white whitespace-nowrap">
              🔐 CLÉ
            </span>
          )}
        </div>
        <div className="text-xs text-slate-700 space-y-1 mt-1">
          <div className="min-w-0">
            <span className="font-semibold text-slate-500">Sujet : </span>
            <span className="break-all">{cert.sujet || '—'}</span>
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-500">Émetteur : </span>
            <span className="break-all">{cert.emetteur || '—'}</span>
          </div>
        </div>
      </div>
    );
  };

  const CarteTest = ({ sc }) => {
    const r = resultats[sc.id];
    const conforme = r?.conforme;
    const enCours = enTest === sc.id;
    const aEteTeste = !!r;
    const desactive = enCours || enTest !== null || testEnSerie;

    return (
      <div
        className={`p-4 border-2 rounded-xl transition-all ${
          aEteTeste
            ? conforme
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-rose-400 bg-rose-50'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800 text-sm">
              {sc.libelle}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {sc.description}
            </div>
          </div>
          {aEteTeste && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                conforme
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {r.resultat === 'accepte' ? '✅ OK' : '❌ REJETÉ'}
            </span>
          )}
        </div>

        {aEteTeste && (
          <div
            className={`p-2 rounded text-[10px] font-mono break-all mb-2 ${
              conforme
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {r.message}
          </div>
        )}

        <button
          onClick={() => lancerTest(sc.id)}
          disabled={desactive}
          className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            aEteTeste
              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              : 'bg-sky-600 text-white hover:bg-sky-700'
          } disabled:bg-slate-300 disabled:cursor-not-allowed`}
        >
          {enCours
            ? '⏳ Test en cours...'
            : aEteTeste
            ? '🔄 Relancer ce test'
            : '▶ Tester ce scénario'}
        </button>
      </div>
    );
  };

  // ================================================================
  // Rendu
  // ================================================================
  if (chargement) {
    return (
      <div className="p-6 text-center text-slate-500">Chargement...</div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            🔐 Démonstration Sécurité + Simulation
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Simulation IoT en direct + tests de sécurité TLS mutuel
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
            estConnecte
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              estConnecte ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          {estConnecte ? 'WebSocket connecté' : 'Déconnecté'}
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-6 rounded-2xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-white">
            <div className="text-lg font-bold">
              🎬 Actions de démonstration
            </div>
            {reservoirDemo && (
              <div className="text-xs opacity-90 mt-1">
                Réservoir cible :{' '}
                <span className="font-mono font-bold">
                  {reservoirDemo.nom} ({reservoirDemo.code})
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={lancerDemoComplete}
              disabled={actionEnCours || testEnSerie || !reservoirDemo}
              className="px-5 py-2.5 bg-white text-sky-700 hover:bg-sky-50 disabled:bg-slate-300 disabled:text-slate-500 font-bold rounded-lg shadow-md transition-colors text-sm"
            >
              🎬 Démo complète
            </button>
            <button
              onClick={demarrerSimulation}
              disabled={
                actionEnCours ||
                etatSimulation?.en_cours ||
                !reservoirDemo
              }
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md transition-colors text-sm"
            >
              ▶ Simulation
            </button>
                        <button
              onClick={arreterSimulation}
              disabled={actionEnCours}
              className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md transition-colors text-sm"
            >
              ⏹ Arrêter sim.
            </button>
            <button
              onClick={lancerTousLesTests}
              disabled={testEnSerie || enTest !== null}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md transition-colors text-sm"
            >
              {testEnSerie ? '⏳ Tests...' : '🧪 Tous les tests'}
            </button>
          </div>
        </div>

        {messageInfo && (
          <div className="mt-4 p-3 bg-white/20 backdrop-blur rounded-lg text-white text-sm">
            {messageInfo}
          </div>
        )}
      </div>

      {/* Double panneau */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- SIMULATION LIVE --- */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              📊 Réservoir en direct
            </h2>
            <span
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                etatSimulation?.en_cours
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {etatSimulation?.en_cours ? '● EN COURS' : '○ Arrêté'}
            </span>
          </div>

          {reservoirDemo ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-500">
                  {reservoirDemo.nom}
                </div>
                <div className="font-mono text-xs text-slate-400">
                  {reservoirDemo.code}
                </div>
              </div>

              {/* Jauge */}
              <div className="h-10 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                <div
                  className="h-full transition-all duration-700 flex items-center justify-end pr-3 text-sm font-bold text-white"
                  style={{
                    width: `${Math.max(niveau, 8)}%`,
                    backgroundColor: couleurJauge,
                  }}
                >
                  {niveau.toFixed(1)}%
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">
                    Niveau
                  </div>
                  <div className="text-xl font-bold text-slate-800 mt-1">
                    {niveau.toFixed(1)}
                    <span className="text-xs text-slate-400 ml-1">%</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">
                    Débit
                  </div>
                  <div className="text-xl font-bold text-sky-700 mt-1">
                    {debit.toFixed(1)}
                    <span className="text-xs text-slate-400 ml-1">
                      L/min
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">
                    Alertes actives
                  </div>
                  <div
                    className={`text-xl font-bold mt-1 ${
                      alertes > 0 ? 'text-rose-600' : 'text-slate-800'
                    }`}
                  >
                    {alertes}
                  </div>
                </div>
              </div>

              {etatSimulation?.en_cours && (
                <div className="text-xs text-slate-500 text-center font-mono">
                  Scénario : {etatSimulation.scenario} · PID :{' '}
                  {etatSimulation.pid}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Aucun réservoir disponible
            </div>
          )}
        </div>

        {/* --- TESTS SÉCURITÉ --- */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              🧪 Tests de sécurité MQTT/TLS
            </h2>
            <span className="text-xs text-slate-500">
              {Object.keys(resultats).length} / {scenarios.length} testés
            </span>
          </div>

          <div className="space-y-3">
            {scenarios.map((sc) => (
              <CarteTest key={sc.id} sc={sc} />
            ))}
          </div>
        </div>
      </div>

      {/* Certificats */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          📂 Certificats utilisés
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {certificats.map((c) => (
            <CarteCertificat key={c.fichier} cert={c} />
          ))}
        </div>
      </div>

      {/* Explication */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          🛡️ Défense en profondeur — 3 niveaux de sécurité
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
            <div className="text-2xl mb-2">🔒</div>
            <div className="font-bold text-violet-900 text-sm">
              Chiffrement
            </div>
            <div className="text-xs text-violet-700 mt-1">
              TLS 1.2+ avec cipher suites modernes (AES-GCM, ChaCha20)
            </div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="text-2xl mb-2">🪪</div>
            <div className="font-bold text-amber-900 text-sm">
              Authentification mutuelle
            </div>
            <div className="text-xs text-amber-700 mt-1">
              Client et serveur vérifient leurs certificats respectifs
            </div>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="text-2xl mb-2">🔑</div>
            <div className="font-bold text-emerald-900 text-sm">
              Mot de passe
            </div>
            <div className="text-xs text-emerald-700 mt-1">
              Une 3ᵉ couche qui protège même si un certificat est volé
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================================================================
// Export avec Error Boundary
// ================================================================
const SecuriteCertificats = () => (
  <ErrorBoundary>
    <SecuriteCertificatsInner />
  </ErrorBoundary>
);

export default SecuriteCertificats;
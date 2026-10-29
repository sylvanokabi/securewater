import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getCertificatsAPI, getScenariosAPI, testerConnexionAPI } from '../services/securiteService';
import { useWebSocket } from '../hooks/useWebSocket';
import { demarrerSimulationAPI, arreterSimulationAPI, getEtatSimulationAPI } from '../services/simulationService';
import { getReservoirsAPI } from '../services/reservoirService';

const POLL_MS = 2000;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, erreur: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, erreur: error }; }
  componentDidCatch(error, info) { console.error('[SecuriteCertificats] Crash :', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-3xl mx-auto">
          <div className="p-6 bg-rose-50 border border-rose-300 rounded-xl">
            <h2 className="text-lg font-bold text-rose-800">⚠ Une erreur est survenue</h2>
            <p className="text-sm text-rose-700 mt-2 font-mono">{this.state.erreur?.message}</p>
            <button onClick={() => this.setState({ hasError: false, erreur: null })} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg">Réessayer</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const toNum = (v, def = 0) => { const n = Number(v); return isFinite(n) ? n : def; };

const SecuriteCertificatsInner = () => {
  const [certificats, setCertificats] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [resultats, setResultats] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enTest, setEnTest] = useState(null);
  const [testEnSerie, setTestEnSerie] = useState(false);
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);
  const [demoScenario, setDemoScenario] = useState(null);
  const [demoMode, setDemoMode] = useState('vulgarise');
  const [apiResult, setApiResult] = useState(null);
  const [reservoirs, setReservoirs] = useState([]);
  const [reservoirDemo, setReservoirDemo] = useState(null);
  const [etatReservoir, setEtatReservoir] = useState({ niveau: 0, debit: 0, alertesActives: 0 });
  const [etatSimulation, setEtatSimulation] = useState(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [messageInfo, setMessageInfo] = useState('');

  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
  const { data: messageWS, estConnecte } = useWebSocket(`${WS_BASE}/ws/telemetrie/`);
  const reservoirRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => { reservoirRef.current = reservoirDemo; }, [reservoirDemo]);

  useEffect(() => {
    const charger = async () => {
      try {
        const [certs, sc, res] = await Promise.all([getCertificatsAPI(), getScenariosAPI(), getReservoirsAPI()]);
        setCertificats(Array.isArray(certs) ? certs : []);
        setScenarios(Array.isArray(sc) ? sc : []);
        const listeRes = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setReservoirs(listeRes);
        if (listeRes.length > 0) setReservoirDemo(listeRes[0]);
      } catch (err) { setMessageInfo(`Erreur de chargement : ${err.message}`); }
      finally { setChargement(false); }
    };
    charger();
  }, []);

  useEffect(() => {
    if (!messageWS || typeof messageWS !== 'object') return;
    const { type } = messageWS;
    if (type === 'mesure') {
      const r = reservoirRef.current;
      if (!r || messageWS.reservoir !== r.code) return;
      const pct = messageWS.pourcentage_remplissage;
      if (typeof pct === 'number' && isFinite(pct)) setEtatReservoir((prev) => ({ ...prev, niveau: pct }));
      const val = messageWS.valeur;
      if (messageWS.unite === 'L/min' && typeof val === 'number' && isFinite(val)) setEtatReservoir((prev) => ({ ...prev, debit: val }));
      return;
    }
    if (type === 'alerte') { setEtatReservoir((prev) => ({ ...prev, alertesActives: toNum(prev.alertesActives) + 1 })); }
  }, [messageWS]);

  const rafraichirEtatSim = useCallback(async () => {
    try { const data = await getEtatSimulationAPI(); setEtatSimulation(data); } catch (e) {}
  }, []);

  useEffect(() => {
    if (etatSimulation?.en_cours) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(rafraichirEtatSim, POLL_MS);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [etatSimulation?.en_cours, rafraichirEtatSim]);

  const lancerTest = async (scenario) => {
    if (!scenario) return;
    setEnTest(scenario.id);
    setDemoScenario(scenario);
    setDemoPanelOpen(true);
    setApiResult(null);
    setDemoMode('vulgarise');
    try {
      const resultat = await testerConnexionAPI(scenario.id);
      setResultats((prev) => ({ ...prev, [scenario.id]: resultat }));
      setApiResult(resultat);
    } catch (err) {
      const errData = { erreur: true, message: err.message, conforme: false, resultat: 'erreur', logs_reels: [`[ERREUR] ${err.message}`], logs_vulgarises: ["🔴 Erreur réseau."] };
      setResultats((prev) => ({ ...prev, [scenario.id]: errData }));
      setApiResult(errData);
    } finally { setEnTest(null); }
  };

  const lancerTousLesTests = async () => {
    setTestEnSerie(true); setResultats({});
    try {
      for (const sc of scenarios) { await lancerTest(sc); await new Promise((r) => setTimeout(r, 3000)); }
    } finally { setTestEnSerie(false); }
  };

  const demarrerSimulation = async () => {
    if (!reservoirDemo) return setMessageInfo('❌ Aucun réservoir disponible.');
    setActionEnCours(true); setMessageInfo('🚀 Démarrage de la simulation...');
    try {
      const data = await demarrerSimulationAPI({ reservoir: reservoirDemo.code, scenario: 'vidange', intervalle: 2 });
      setEtatSimulation(data); setMessageInfo('✅ Simulation démarrée.');
    } catch (err) { setMessageInfo(`⚠️ ${err?.response?.data?.detail || err.message}`); }
    finally { setActionEnCours(false); }
  };

  const arreterSimulation = async () => {
    setActionEnCours(true);
    try {
      await arreterSimulationAPI();
      setEtatSimulation(null); setEtatReservoir({ niveau: 0, debit: 0, alertesActives: 0 });
      setMessageInfo('⏹ Simulation arrêtée.');
    } catch (err) {
      setEtatSimulation(null); setEtatReservoir({ niveau: 0, debit: 0, alertesActives: 0 });
      setMessageInfo(`⏹ ${err?.response?.data?.detail || err.message}`);
    } finally { setActionEnCours(false); }
  };

  const lancerDemoComplete = async () => {
    if (!reservoirDemo) return setMessageInfo('❌ Aucun réservoir disponible.');
    setResultats({}); setEtatReservoir({ niveau: 0, debit: 0, alertesActives: 0 });
    await demarrerSimulation(); await new Promise((r) => setTimeout(r, 2500));
    await lancerTousLesTests();
    setMessageInfo('🎉 Démonstration complète terminée !');
  };

  const niveau = toNum(etatReservoir.niveau);
  const debit = toNum(etatReservoir.debit);
  const alertes = toNum(etatReservoir.alertesActives);
  const couleurJauge = niveau <= 10 || niveau >= 95 ? '#ef4444' : niveau <= 25 || niveau >= 90 ? '#f97316' : '#0284c7';

  if (chargement) return <div className="p-6 text-center text-slate-500">Chargement...</div>;

  const logsAAfficher = apiResult ? (demoMode === 'vulgarise' ? apiResult.logs_vulgarises : apiResult.logs_reels) || [] : ["[INFO] Connexion..."];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">🔐 Démonstration Sécurité + Simulation</h1>
          <p className="text-sm text-slate-500 mt-2">Simulation IoT en direct + tests de sécurité TLS mutuel</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${estConnecte ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${estConnecte ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {estConnecte ? 'WebSocket connecté' : 'Déconnecté'}
        </div>
      </div>

      <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-6 rounded-2xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-white">
            <div className="text-lg font-bold">🎬 Actions de démonstration</div>
            {reservoirDemo && <div className="text-xs opacity-90 mt-1">Réservoir cible : <span className="font-mono font-bold">{reservoirDemo.nom} ({reservoirDemo.code})</span></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={lancerDemoComplete} disabled={actionEnCours || testEnSerie || !reservoirDemo} className="px-5 py-2.5 bg-white text-sky-700 hover:bg-sky-50 disabled:bg-slate-300 font-bold rounded-lg shadow-md text-sm">🎬 Démo complète</button>
            <button onClick={demarrerSimulation} disabled={actionEnCours || etatSimulation?.en_cours || !reservoirDemo} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md text-sm">▶ Simulation</button>
            <button onClick={arreterSimulation} disabled={actionEnCours} className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md text-sm">⏹ Arrêter sim.</button>
            <button onClick={lancerTousLesTests} disabled={testEnSerie || enTest !== null} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md text-sm">{testEnSerie ? '⏳ Tests...' : '🧪 Tous les tests'}</button>
          </div>
        </div>
        {messageInfo && <div className="mt-4 p-3 bg-white/20 backdrop-blur rounded-lg text-white text-sm">{messageInfo}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">📊 Réservoir en direct</h2>
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${etatSimulation?.en_cours ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{etatSimulation?.en_cours ? '● EN COURS' : '○ Arrêté'}</span>
          </div>
          {reservoirDemo ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-500">{reservoirDemo.nom}</div>
                <div className="font-mono text-xs text-slate-400">{reservoirDemo.code}</div>
              </div>
              <div className="h-10 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                <div className="h-full transition-all duration-700 flex items-center justify-end pr-3 text-sm font-bold text-white" style={{ width: `${Math.max(niveau, 8)}%`, backgroundColor: couleurJauge }}>{niveau.toFixed(1)}%</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-[10px] font-semibold text-slate-500 uppercase">Niveau</div><div className="text-xl font-bold text-slate-800 mt-1">{niveau.toFixed(1)}<span className="text-xs text-slate-400 ml-1">%</span></div></div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-[10px] font-semibold text-slate-500 uppercase">Débit</div><div className="text-xl font-bold text-sky-700 mt-1">{debit.toFixed(1)}<span className="text-xs text-slate-400 ml-1">L/min</span></div></div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2"><div className="text-[10px] font-semibold text-slate-500 uppercase">Alertes actives</div><div className={`text-xl font-bold mt-1 ${alertes > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{alertes}</div></div>
              </div>
            </div>
          ) : <div className="text-center py-8 text-slate-400 text-sm">Aucun réservoir disponible</div>}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">🧪 Tests de sécurité MQTT/TLS</h2>
            <span className="text-xs text-slate-500">{Object.keys(resultats).length} / {scenarios.length} testés</span>
          </div>
          <div className="space-y-3">
            {scenarios.map((sc) => {
              const r = resultats[sc.id];
              const conforme = r?.conforme;
              const enCours = enTest === sc.id;
              const desactive = enCours || enTest !== null || testEnSerie;

              return (
                <div key={sc.id} className={`p-4 border-2 rounded-xl transition-all ${r ? (conforme ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50') : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 text-sm">{sc.libelle}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{sc.description}</div>
                    </div>
                    {r && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${conforme ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{r.resultat === 'accepte' ? '✅ OK' : '❌ REJETÉ'}</span>}
                  </div>
                  {r && <div className={`p-2 rounded text-[10px] font-mono break-all mb-2 ${conforme ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{r.message}</div>}
                  <button onClick={() => lancerTest(sc)} disabled={desactive} className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${r ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-sky-600 text-white hover:bg-sky-700'} disabled:bg-slate-300`}>
                    {enCours ? '⏳ Test en cours...' : r ? '🔄 Revoir la démonstration' : '▶ Tester ce scénario'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {demoPanelOpen && demoScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
            
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2"><span>🕵️</span> Console de Sécurité : {demoScenario.libelle}</h3>
                <p className="text-xs text-slate-400 mt-1">Inspection du protocole en temps réel</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-800 rounded-lg p-1 text-xs">
                  <button onClick={() => setDemoMode('vulgarise')} className={`px-3 py-1.5 rounded-md transition-colors ${demoMode === 'vulgarise' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>Vulgarisé</button>
                  <button onClick={() => setDemoMode('expert')} className={`px-3 py-1.5 rounded-md transition-colors ${demoMode === 'expert' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>Expert</button>
                </div>
                <button onClick={() => setDemoPanelOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
              </div>
            </div>

            <div className="flex-1 bg-[#0f172a] p-5 overflow-y-auto font-mono text-sm relative min-h-[250px]">
              <div className="space-y-1">
                {!apiResult ? (
                   <div className="text-slate-400 italic animate-pulse">Exécution du test en cours...</div>
                ) : (
                  logsAAfficher.map((log, i) => {
                    const logStr = String(log || '');
                    let colorClass = 'text-slate-300';
                    
                    // Coloration syntaxique de base
                    if (logStr.match(/(error|erreur|refus|perdue|failed|⛔|🔴)/i)) colorClass = 'text-rose-400';
                    else if (logStr.match(/(succès|accept|conforme|✅|🟢|🔒)/i)) colorClass = 'text-emerald-400';
                    else if (logStr.match(/(⚠️|warning|🟠|🟡)/i)) colorClass = 'text-amber-300';
                    
                    // Coloration spéciale pour le charabia cryptographique
                    const isCryptoBlock = logStr.includes('BEGIN') || logStr.includes('▼') || logStr.includes('▲');
                    if (isCryptoBlock) colorClass = 'text-fuchsia-400 font-bold bg-fuchsia-900/20 p-2 rounded block my-1 border border-fuchsia-800/50';

                    // 👇 NOUVELLES CONDITIONS POUR LE MAUVAIS MOT DE PASSE
                    if (logStr.includes('[CMD]')) {
                        colorClass = 'text-amber-300 font-bold bg-amber-900/20 p-1 rounded';
                    } else if (logStr.includes('CONNACK')) {
                        colorClass = 'text-rose-400 font-bold';
                    }

                    if (logStr.includes('\n')) {
                        return (
                            <div key={i} className="flex gap-3 my-2">
                                <span className="text-slate-600 text-xs shrink-0 select-none pt-0.5">{`[${new Date().toLocaleTimeString()}]`}</span>
                                <pre className={`whitespace-pre-wrap break-all text-xs leading-relaxed ${colorClass}`}>{logStr}</pre>
                            </div>
                        );
                    }
                    return (
                      <div key={i} className="flex gap-3">
                        <span className="text-slate-600 text-xs shrink-0 select-none pt-0.5">{`[${new Date().toLocaleTimeString()}]`}</span>
                        <span className={`break-words ${colorClass}`}>{logStr}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {apiResult && apiResult.preuves && demoMode === 'expert' && (
              <div className="bg-slate-800 p-4 border-t border-slate-700">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2"><span>🔬</span> Preuves Cryptographiques (Certificats)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg border ${apiResult.preuves.certificat_presente ? 'bg-slate-900 border-slate-600' : 'bg-slate-900 border-rose-900/50'}`}>
                    <div className="text-xs font-bold text-sky-400 mb-2">📄 Certificat présenté par le client</div>
                    {apiResult.preuves.certificat_presente ? (
                      <div className="space-y-1 text-[11px] font-mono">
                        <div><span className="text-slate-500">Sujet :</span> <span className="text-slate-200">{apiResult.preuves.certificat_presente.sujet}</span></div>
                        <div><span className="text-slate-500">Émetteur :</span> <span className={apiResult.preuves.certificat_presente.emetteur.includes('Fake') ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{apiResult.preuves.certificat_presente.emetteur}</span></div>
                        <div className="break-all"><span className="text-slate-500">Empreinte SHA-256 :</span> <span className="text-cyan-400">{apiResult.preuves.certificat_presente.empreinte}</span></div>
                      </div>
                    ) : (
                      <div className="text-xs text-rose-400 font-mono italic">[ AUCUN CERTIFICAT FOURNI ]</div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-600">
                    <div className="text-xs font-bold text-violet-400 mb-2">🏛️ CA de confiance (Serveur)</div>
                    {apiResult.preuves.ca_de_confiance ? (
                      <div className="space-y-1 text-[11px] font-mono">
                        <div><span className="text-slate-500">Sujet :</span> <span className="text-slate-200">{apiResult.preuves.ca_de_confiance.sujet}</span></div>
                        <div><span className="text-slate-500">Émetteur :</span> <span className="text-slate-200">{apiResult.preuves.ca_de_confiance.emetteur}</span></div>
                        <div className="break-all"><span className="text-slate-500">Empreinte SHA-256 :</span> <span className="text-cyan-400">{apiResult.preuves.ca_de_confiance.empreinte}</span></div>
                      </div>
                    ) : (
                      <div className="text-xs text-rose-400 font-mono italic">[ CA INTROUVABLE ]</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-xs text-center font-bold">
                  {apiResult.preuves.certificat_presente && apiResult.preuves.ca_de_confiance && apiResult.preuves.certificat_presente.emetteur === apiResult.preuves.ca_de_confiance.sujet ? (
                    <span className="text-emerald-400">✅ La chaîne de confiance est VALIDE (Émetteur = CA)</span>
                  ) : apiResult.preuves.certificat_presente ? (
                    <span className="text-rose-400">❌ La chaîne de confiance est BRISÉE (Émetteur ≠ CA)</span>
                  ) : null}
                </div>
              </div>
            )}

            {apiResult && (
              <div className={`p-5 border-t-4 shrink-0 transition-all duration-500 ${apiResult.conforme ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-rose-500'}`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{apiResult.conforme ? '🛡️' : '⛔'}</div>
                  <div>
                    <h4 className={`font-bold text-lg ${apiResult.conforme ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {apiResult.conforme && apiResult.resultat === 'accepte' && 'Verdict : Système Sécurisé (Accès Autorisé)'}
                      {apiResult.conforme && apiResult.resultat === 'refuse' && 'Verdict : Attaque Bloquée avec Succès'}
                      {!apiResult.conforme && apiResult.resultat === 'accepte' && 'Verdict : FAILLE CRITIQUE (Accès Accordé à tort)'}
                      {!apiResult.conforme && apiResult.resultat === 'refuse' && 'Verdict : ÉCHEC DU SYSTÈME (Accès Bloqué à tort)'}
                    </h4>
                    <p className="text-sm text-slate-700 mt-1 font-mono bg-white/50 p-2 rounded border border-slate-200">
                      <span className="font-bold">Sortie système :</span> {apiResult.message || 'Test terminé.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
              <button onClick={() => setDemoPanelOpen(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-sm transition-colors">Fermer la console</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SecuriteCertificats = () => (<ErrorBoundary><SecuriteCertificatsInner /></ErrorBoundary>);
export default SecuriteCertificats;
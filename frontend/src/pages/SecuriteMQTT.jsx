import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getStatsMQTTAPI, publierMessageTestAPI } from '../services/securiteService';
import { useWebSocket } from '../hooks/useWebSocket';

const POLL_MS = 5000; // On espace le polling car on a le WS

const SecuriteMQTT = () => {
  const [stats, setStats] = useState({
    messages_recus: 0,
    mesures_recues: 0,
    alertes_recues: 0,
    heartbeats_recus: 0,
    messages_rejetes: 0,
    uptime_formate: '—',
  });
  
  const [logs, setLogs] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [publishValue, setPublishValue] = useState('45');
  const [publishType, setPublishType] = useState('niveau');
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState(null);
  const [openAccordion, setOpenAccordion] = useState(null);

  // Animation
  const [isFlowing, setIsFlowing] = useState(false);
  const flowTimeoutRef = useRef(null);

  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
  const { data: messageWS, estConnecte } = useWebSocket(`${WS_BASE}/ws/telemetrie/`);

  const rafraichir = useCallback(async () => {
    try {
      const data = await getStatsMQTTAPI();
      setStats(data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    rafraichir();
    const id = setInterval(rafraichir, POLL_MS);
    return () => clearInterval(id);
  }, [rafraichir]);

  // Écoute du WebSocket : Mise à jour compteurs + logs + animation
  useEffect(() => {
    if (!messageWS) return;

    // On ne traite que les mesures et alertes pour le stream
    if (messageWS.type === 'mesure' || messageWS.type === 'alerte') {
      
      // 1. Mise à jour INSTANTANÉE des compteurs (sans attendre le polling)
      if (!isPaused) {
        setStats(prev => ({
          ...prev,
          messages_recus: prev.messages_recus + 1,
          mesures_recues: messageWS.type === 'mesure' ? prev.mesures_recues + 1 : prev.mesures_recues,
          alertes_recues: messageWS.type === 'alerte' ? prev.alertes_recues + 1 : prev.alertes_recues,
        }));
      }

      // 2. Formatage propre du log pour le terminal
      const capteurNom = messageWS.capteur || 'Inconnu';
      // On raccourcit le nom si besoin
      const capteurCourt = capteurNom.length > 15 ? capteurNom.substring(0, 15) + '...' : capteurNom;
      
      const valeurAffichee = messageWS.type === 'mesure' 
        ? `${messageWS.valeur} ${messageWS.unite || ''}`
        : messageWS.message;

      const newLog = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
        type: messageWS.type,
        capteur: capteurCourt,
        valeur: valeurAffichee,
      };

      if (!isPaused) {
        setLogs(prev => [newLog, ...prev].slice(0, 50));
      }

      // 3. Animation visuelle (seulement pour les mesures pour ne pas surcharger)
      if (messageWS.type === 'mesure') {
        setIsFlowing(true);
        if (flowTimeoutRef.current) clearTimeout(flowTimeoutRef.current);
        flowTimeoutRef.current = setTimeout(() => setIsFlowing(false), 1000);
      }
    }
  }, [messageWS, isPaused]);

  const handlePublier = async (e) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      await publierMessageTestAPI(parseFloat(publishValue), publishType);
      setToast({ message: "✅ Message publié avec succès !", type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      // 👇 Affiche l'erreur exacte renvoyée par le backend
      const errorMsg = err?.response?.data?.message || err?.message || "Erreur lors de la publication.";
      setToast({ message: `❌ ${errorMsg}`, type: "error" });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setIsPublishing(false);
    }
  };

  const KPICard = ({ titre, valeur, couleur, icone }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden transition-all duration-300">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{titre}</div>
          <div className={`text-3xl font-extrabold mt-2 ${couleur}`}>{valeur}</div>
        </div>
        <div className="text-2xl opacity-50">{icone}</div>
      </div>
    </div>
  );

  const AccordionItem = ({ id, title, icon, children }) => {
    const isOpen = openAccordion === id;
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 bg-white">
        <button 
          onClick={() => setOpenAccordion(isOpen ? null : id)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3 font-semibold text-slate-800">
            <span className="text-xl">{icon}</span> {title}
          </div>
          <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {isOpen && (
          <div className="p-4 text-sm text-slate-600 border-t border-slate-100 animate-fade-in">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-bold text-sm ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Démonstration MQTT</h1>
          <p className="text-sm text-slate-500">Fonctionnement du protocole MQTT en temps réel — Publish / Subscribe via broker</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${estConnecte ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          <span className={`w-2 h-2 rounded-full ${estConnecte ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {estConnecte ? 'WebSocket en direct' : 'WebSocket déconnecté'}
        </div>
      </div>

      {/* ARCHITECTURE ANIMÉE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Architecture du flux de messages</h2>
        
        <div className="relative flex justify-between items-center max-w-4xl mx-auto">
          <div className="absolute top-1/2 left-[15%] right-[50%] h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
          <div className="absolute top-1/2 left-[50%] right-[15%] h-1 bg-slate-200 -translate-y-1/2 z-0"></div>

          {/* Bille animée */}
          {isFlowing && (
            <div className="absolute top-1/2 -translate-y-1/2 z-10 w-4 h-4 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.8)] animate-flow" />
          )}

          <div className="relative z-20 p-4 bg-sky-50 border-2 border-sky-200 rounded-xl text-center w-40">
            <div className="text-3xl">🛰️</div>
            <div className="font-bold text-sm text-slate-800 mt-2">Simulateur</div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Publie</div>
          </div>
          
          <div className="relative z-20 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-center w-40">
            <div className="text-3xl">📮</div>
            <div className="font-bold text-sm text-slate-800 mt-2">Mosquitto</div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Broker</div>
          </div>

          <div className="relative z-20 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-center w-40">
            <div className="text-3xl">🖥️</div>
            <div className="font-bold text-sm text-slate-800 mt-2">Django</div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Écoute</div>
          </div>
        </div>
      </div>

      {/* COMPTEURS (Correction de la faute de frappe) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard titre="Messages reçus" valeur={stats.messages_recus} couleur="text-sky-600" icone="📥" />
        <KPICard titre="Mesures" valeur={stats.mesures_recues} couleur="text-emerald-600" icone="📊" />
        <KPICard titre="Heartbeats" valeur={stats.heartbeats_recus} couleur="text-violet-600" icone="💓" />
        <KPICard titre="Messages rejetés" valeur={stats.messages_rejetes} couleur="text-rose-600" icone="❌" />
      </div>

      {/* ZONE INTERACTIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulaire de test */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-fit">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>🚀</span> Publier un message test
          </h3>
          <form onSubmit={handlePublier} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Type de capteur</label>
              <select 
                value={publishType} 
                onChange={(e) => setPublishType(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="niveau">Niveau (cm)</option>
                <option value="debit">Débit (L/min)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">Valeur</label>
              <input 
                type="number" 
                value={publishValue} 
                onChange={(e) => setPublishValue(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isPublishing}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition-colors shadow-md flex justify-center items-center gap-2"
            >
              {isPublishing ? '⏳ Envoi en cours...' : '🚀 Publier via MQTT'}
            </button>
          </form>
          <p className="text-[10px] text-slate-400 mt-3 text-center italic">
            Le message passe par le broker Mosquitto et est renvoyé à Django via le WebSocket.
          </p>
        </div>

        {/* Terminal Live Stream (Formaté) */}
        <div className="lg:col-span-2 bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[400px]">
          <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-slate-400 font-mono ml-2">mqtt-live-stream</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsPaused(!isPaused)} className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                {isPaused ? '▶ Reprendre' : '⏸ Pause'}
              </button>
              <button onClick={() => setLogs([])} className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                🗑 Vider
              </button>
            </div>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic text-center mt-10">En attente de messages MQTT...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-3 items-center border-b border-slate-800/50 pb-1.5 animate-fade-in">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded text-[10px] ${log.type === 'alerte' ? 'bg-rose-900/50 text-rose-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                    {log.type === 'alerte' ? 'ALERTE' : 'MESURE'}
                  </span>
                  <span className="text-sky-300 shrink-0 w-32 truncate" title={log.capteur}>{log.capteur}</span>
                  <span className="text-slate-200 font-bold truncate">{log.valeur}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* EXPLICATIONS INTERACTIVES */}
      <div className="bg-transparent pt-4">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Comment fonctionne MQTT ?</h2>
        
        <AccordionItem id="broker" title="1. Le broker " icon="📮">
          Mosquitto est le serveur central. Il reçoit les messages des éditeurs (capteurs) et les redistribue aux abonnés (Django) sans jamais stocker les données. C'est le facteur de votre réseau IoT.
        </AccordionItem>
        
        <AccordionItem id="topics" title="2. Les topics " icon="🏷️">
          Chaque message est étiqueté avec un sujet hiérarchique : <code className="bg-slate-100 px-1 rounded">securewater/reservoirs/&lt;code&gt;/capteurs/&lt;code&gt;/mesures</code>. C'est ce qui permet de router le message vers le bon abonné.
        </AccordionItem>
        
        <AccordionItem id="wildcard" title="3. Le wildcard " icon="🃏">
          Le backend s'abonne à <code className="bg-slate-100 px-1 rounded">securewater/reservoirs/+/capteurs/+/mesures</code>. Le signe <strong>+</strong> est un joker qui remplace un niveau de la hiérarchie. Cela permet de recevoir tous les capteurs de tous les réservoirs avec une seule ligne de code.
        </AccordionItem>
        
        <AccordionItem id="qos" title="4. QoS " icon="✅">
          <strong>QoS 0</strong> (au plus une fois) : on envoie et on oublie. <strong>QoS 1</strong> (au moins une fois) : le message est réenvoyé jusqu'à réception d'un accusé. <strong>QoS 2</strong> (exactement une fois) : garanti sans doublon. Notre projet utilise <strong>QoS 1</strong>.
        </AccordionItem>
      </div>
    </div>
  );
};

export default SecuriteMQTT;
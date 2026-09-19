import React, { useEffect, useState, useCallback } from 'react';
import { getStatsMQTTAPI } from '../services/securiteService';

const POLL_MS = 2000;

const SecuriteMQTT = () => {
  const [stats, setStats] = useState({
    messages_recus: 0,
    mesures_recues: 0,
    alertes_recues: 0,
    heartbeats_recus: 0,
    messages_rejetes: 0,
    uptime_formate: '—',
  });

  const rafraichir = useCallback(async () => {
    try {
      const data = await getStatsMQTTAPI();
      setStats(data);
    } catch (e) {
      // silencieux
    }
  }, []);

  useEffect(() => {
    rafraichir();
    const id = setInterval(rafraichir, POLL_MS);
    return () => clearInterval(id);
  }, [rafraichir]);

  const KPICard = ({ titre, valeur, couleur }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="text-xs font-semibold text-slate-500 uppercase">{titre}</div>
      <div className={`text-3xl font-extrabold mt-3 ${couleur}`}>{valeur}</div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Démonstration MQTT
        </h1>
        <p className="text-sm text-slate-500">
          Fonctionnement du protocole MQTT en temps réel — Publish / Subscribe via broker
        </p>
      </div>

      {/* Schéma du flux */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          Architecture du flux de messages
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-center">
            <div className="text-3xl">🛰️</div>
            <div className="font-semibold text-sm text-slate-800 mt-2">Simulateur</div>
            <div className="text-xs text-slate-500 mt-1">Publie sur MQTT</div>
          </div>
          <div className="text-center text-2xl text-sky-400">→</div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <div className="text-3xl">📮</div>
            <div className="font-semibold text-sm text-slate-800 mt-2">Broker Mosquitto</div>
            <div className="text-xs text-slate-500 mt-1">TLS + mTLS</div>
          </div>
          <div className="text-center text-2xl text-sky-400">→</div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
            <div className="text-3xl">🖥️</div>
            <div className="font-semibold text-sm text-slate-800 mt-2">Backend Django</div>
            <div className="text-xs text-slate-500 mt-1">Écoute + stocke</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4 italic">
          Le backend s'abonne à <code className="bg-slate-100 px-1 rounded">
            securewater/reservoirs/+/capteurs/+/mesures
          </code> et traite chaque message.
        </p>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard titre="Messages reçus" valeur={stats.messages_recus} couleur="text-sky-600" />
        <KPICard titre="Mesures" valeur={stats.mesures_recues} couleur="text-emerald-600" />
        <KPICard titre="Heartbeats" valeur={stats.heartbeats_recus} couleur="text-violet-600" />
        <KPICard titre="Messages rejetés" valeur={stats.messages_rejetes} couleur="text-rose-600" />
      </div>

      {/* Explication MQTT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          Comment fonctionne MQTT ?
        </h2>
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <strong className="text-sky-700">1. Le broker</strong> — Mosquitto est le
            serveur central. Il reçoit les messages des éditeurs et les redistribue
            aux abonnés. Équivalent d'un « bureau de poste ».
          </div>
          <div>
            <strong className="text-sky-700">2. Les topics</strong> — Chaque message est
            étiqueté avec un sujet hiérarchique. Format :
            <code className="bg-slate-100 px-1.5 py-0.5 rounded ml-1 font-mono text-xs">
              securewater/reservoirs/&lt;code&gt;/capteurs/&lt;code&gt;/mesures
            </code>
          </div>
          <div>
            <strong className="text-sky-700">3. Le wildcard +</strong> — Le backend
            s'abonne à tous les réservoirs et tous les capteurs grâce au wildcard.
            Un seul abonnement reçoit les messages de tous les capteurs.
          </div>
          <div>
            <strong className="text-sky-700">4. QoS</strong> — Niveau de garantie de
            livraison : 0 (au plus une fois), 1 (au moins une fois), 2 (exactement une
            fois). Notre projet utilise <strong>QoS 1</strong>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuriteMQTT;
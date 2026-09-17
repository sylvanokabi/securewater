import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getCapteursAPI, ajouterCapteurAPI, supprimerCapteurAPI } from '../services/capteurService';
import { getReservoirsAPI } from '../services/reservoirService';

const Capteurs = () => {
  const [capteurs, setCapteurs] = useState([]);
  const [reservoirs, setReservoirs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);

  // Formulaire avec gestion automatique de l'unité
  const [nouveauCapteur, setNouveauCapteur] = useState({
    nom: '',
    code: '',
    type: 'niveau',
    unite: 'cm',
    reservoir: '',
    statut: 'actif',
  });

  // Connexion au canal WebSocket
  const WS_URL = 'ws://127.0.0.1:8000/ws/telemetrie/';
  const { data: websocketData, estConnecte } = useWebSocket(WS_URL);

  const chargerDonnees = async () => {
    setChargement(true);
    setErreur('');
    try {
      const [capteursRes, reservoirsRes] = await Promise.all([
        getCapteursAPI(),
        getReservoirsAPI(),
      ]);

      // Extraction sécurisée des tableaux (supporte la pagination Django REST)
      const listeCapteurs = Array.isArray(capteursRes?.results)
        ? capteursRes.results
        : Array.isArray(capteursRes)
        ? capteursRes
        : [];

      const listeReservoirs = Array.isArray(reservoirsRes?.results)
        ? reservoirsRes.results
        : Array.isArray(reservoirsRes)
        ? reservoirsRes
        : [];

      setCapteurs(listeCapteurs);
      setReservoirs(listeReservoirs);
    } catch (err) {
      setErreur(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  // Écoute de la télémétrie en direct
  useEffect(() => {
    if (!websocketData || capteurs.length === 0) return;

    const capteurIdTarget = websocketData.capteur_id || websocketData.capteur;
    const capteurCodeTarget = websocketData.code_capteur || websocketData.code;

    if (capteurIdTarget || capteurCodeTarget) {
      setCapteurs((prevCapteurs) =>
        prevCapteurs.map((c) => {
          if (
            (capteurIdTarget && Number(c.id) === Number(capteurIdTarget)) ||
            (capteurCodeTarget && c.code === capteurCodeTarget)
          ) {
            return {
              ...c,
              derniere_valeur: websocketData.valeur ?? websocketData.niveau ?? websocketData.debit ?? c.derniere_valeur,
              statut: websocketData.statut || c.statut,
            };
          }
          return c;
        })
      );
    }
  }, [websocketData]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setNouveauCapteur((prev) => {
      const maj = { ...prev, [name]: value };
      // Ajustement automatique de l'unité selon le type sélectionné
      if (name === 'type') {
        maj.unite = value === 'niveau' ? 'cm' : value === 'debit' ? 'L/min' : 'N/A';
      }
      return maj;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...nouveauCapteur };
      if (!payload.code.trim()) {
        delete payload.code;
      }

      await ajouterCapteurAPI(payload);
      setModalOuvert(false);

      setNouveauCapteur({
        nom: '',
        code: '',
        type: 'niveau',
        unite: 'cm',
        reservoir: '',
        statut: 'actif',
      });
      chargerDonnees();
    } catch (err) {
      alert(`Erreur de création : ${err.message}`);
    }
  };

  const handleSupprimer = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce capteur ?')) {
      try {
        await supprimerCapteurAPI(id);
        chargerDonnees();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Capteurs</h1>
          <p className="text-sm text-slate-500">Capteurs IoT rattachés aux réservoirs de distribution</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${estConnecte ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="font-medium text-slate-600">
              {estConnecte ? 'Flux Live Actif' : 'Déconnecté'}
            </span>
          </div>

          <button
            onClick={() => setModalOuvert(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
          >
            + Ajouter un Capteur
          </button>
        </div>
      </div>

      {erreur && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{erreur}</div>
      )}

      {chargement ? (
        <div className="text-center py-12 text-slate-500">Chargement des capteurs...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Nom</th>
                <th className="p-4">Code</th>
                <th className="p-4">Type</th>
                <th className="p-4">Réservoir Associé</th>
                <th className="p-4">Dernière Valeur</th>
                <th className="p-4">Unité</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {capteurs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    Aucun capteur enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                capteurs.map((capteur) => (
                  <tr key={capteur.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{capteur.nom}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{capteur.code || 'N/A'}</td>
                    <td className="p-4">
                      <span className="capitalize">{capteur.type_display || capteur.type}</span>
                    </td>
                    <td className="p-4 font-medium">
                      {capteur.reservoir_nom || (capteur.reservoir ? `Réservoir #${capteur.reservoir}` : 'Non assigné')}
                    </td>
                    <td className="p-4 font-mono font-semibold text-sky-700">
                      {capteur.derniere_valeur !== undefined && capteur.derniere_valeur !== null
                        ? capteur.derniere_valeur
                        : '-'}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500">{capteur.unite || '-'}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase ${
                          capteur.statut === 'actif'
                            ? 'bg-emerald-100 text-emerald-700'
                            : capteur.statut === 'maintenance'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {capteur.statut_display || capteur.statut}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleSupprimer(capteur.id)}
                        className="text-red-500 hover:text-red-700 font-medium text-xs transition-colors"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal d'ajout de capteur */}
      {modalOuvert && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Nouveau Capteur</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom du Capteur *</label>
                <input
                  type="text"
                  name="nom"
                  value={nouveauCapteur.nom}
                  required
                  onChange={handleChange}
                  placeholder="ex: Capteur Niveau Réserve A"
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code Identifiant (MQTT / Série)</label>
                <input
                  type="text"
                  name="code"
                  value={nouveauCapteur.code}
                  onChange={handleChange}
                  placeholder="ex: SENS-001"
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type de Capteur *</label>
                <select
                  name="type"
                  value={nouveauCapteur.type}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="niveau">Niveau (cm)</option>
                  <option value="debit">Débit (L/min)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Réservoir Associé *</label>
                <select
                  name="reservoir"
                  value={nouveauCapteur.reservoir}
                  required
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="">Sélectionner un réservoir</option>
                  {reservoirs.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.nom} ({res.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Statut *</label>
                <select
                  name="statut"
                  value={nouveauCapteur.statut}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="desactive">Désactivé</option>
                  <option value="inconnu">Inconnu</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOuvert(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 font-medium"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Capteurs;
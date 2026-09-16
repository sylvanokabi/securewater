import React, { useEffect, useState } from 'react';
import { getCapteursAPI, ajouterCapteurAPI, supprimerCapteurAPI } from '../services/capteurService';
import { getReservoirsAPI } from '../services/reservoirService';

const Capteurs = () => {
  const [capteurs, setCapteurs] = useState([]);
  const [reservoirs, setReservoirs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [modalOuvert, setModalOuvert] = useState(false);

  // Valeurs par défaut en minuscules pour correspondre aux TextChoices Django
  const [nouveauCapteur, setNouveauCapteur] = useState({
    nom: '',
    code: '',
    type: 'niveau',
    reservoir: '',
    statut: 'actif',
  });

  const chargerDonnees = async () => {
    setChargement(true);
    setErreur('');
    try {
      const [capteursData, reservoirsData] = await Promise.all([
        getCapteursAPI(),
        getReservoirsAPI(),
      ]);
      setCapteurs(capteursData);
      setReservoirs(reservoirsData);
    } catch (err) {
      setErreur(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const handleChange = (e) => {
    setNouveauCapteur((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
      
      // Réinitialisation avec les valeurs minuscules valides
      setNouveauCapteur({
        nom: '',
        code: '',
        type: 'niveau',
        reservoir: '',
        statut: 'actif',
      });
      chargerDonnees();
    } catch (err) {
      alert(`Erreur de création : ${err.message}`);
    }
  };

  const handleSupprimer = async (id) => {
    if (window.confirm('Voulez-vous supprimer ce capteur ?')) {
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Capteurs</h1>
          <p className="text-sm text-slate-500">Capteurs IoT rattachés aux réservoirs</p>
        </div>
        <button
          onClick={() => setModalOuvert(true)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Ajouter un Capteur
        </button>
      </div>

      {erreur && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">{erreur}</div>
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
                <th className="p-4">Unité</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {capteurs.map((capteur) => (
                <tr key={capteur.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-900">{capteur.nom}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{capteur.code}</td>
                  <td className="p-4">{capteur.type_display || capteur.type}</td>
                  <td className="p-4">{capteur.reservoir_nom || `Réservoir #${capteur.reservoir}`}</td>
                  <td className="p-4 font-mono">{capteur.unite || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase ${
                      capteur.statut === 'actif'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {capteur.statut_display || capteur.statut}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleSupprimer(capteur.id)}
                      className="text-red-500 hover:text-red-700 font-medium text-xs"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  placeholder="ex: Capteur de Niveau 01"
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code Identifiant (Optionnel)</label>
                <input
                  type="text"
                  name="code"
                  value={nouveauCapteur.code}
                  onChange={handleChange}
                  placeholder="ex: c001"
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Sélection du type alignée sur le modèle Django */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type de Capteur *</label>
                <select
                  name="type"
                  value={nouveauCapteur.type}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
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
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                >
                  <option value="">Sélectionner un réservoir</option>
                  {reservoirs.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sélection du statut alignée sur le modèle Django */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Statut *</label>
                <select
                  name="statut"
                  value={nouveauCapteur.statut}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
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
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700"
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

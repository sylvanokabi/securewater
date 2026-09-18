import React, { useState, useEffect, useCallback } from 'react';
import GraphiqueDebit from '../components/GraphiqueDebit';
import { useWebSocket } from '../hooks/useWebSocket';
import { getReservoirsAPI, creerReservoirAPI, supprimerReservoirAPI } from '../services/reservoirService';

const Reservoirs = () => {
  const [listeReservoirs, setListeReservoirs] = useState([]);
  const [reservoirSelectionneId, setReservoirSelectionneId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [donneesDebit, setDonneesDebit] = useState([]);

  // État local du réservoir enrichi des données temps réel
  const [reservoir, setReservoir] = useState(null);

  // Valeurs par défaut du formulaire de création
  const initialFormState = {
    nom: '',
    code: '',
    description: '',
    localisation: '',
    latitude: '',
    longitude: '',
    capacite_max_litres: '',
    hauteur_max_cm: '',
    seuil_critique_bas: '10',
    seuil_alerte_bas: '25',
    seuil_alerte_haut: '90',
    seuil_critique_haut: '95',
    statut: 'actif',
  };

  const [form, setForm] = useState(initialFormState);

  // WebSocket pour la télémétrie en temps réel
  const WS_URL = 'ws://127.0.0.1:8000/ws/telemetrie/';
  const { data: websocketData, estConnecte } = useWebSocket(WS_URL);

  // Initialisation à partir des données REST réelles
  const initialiserReservoir = useCallback((dataRes) => {
    const niveauInitial =
      dataRes.niveau_pourcentage ??
      dataRes.niveau ??
      (dataRes.volume_actuel_litres && dataRes.capacite_max_litres
        ? (dataRes.volume_actuel_litres / dataRes.capacite_max_litres) * 100
        : 0);

    const debitInitial = dataRes.debit_instantane ?? dataRes.debitActuel ?? dataRes.debit ?? 0;

    setReservoir({
      ...dataRes,
      code: dataRes.code || dataRes.code_mqtt || '',
      niveauActuel: Math.min(Math.max(parseFloat(niveauInitial) || 0, 0), 100),
      debitActuel: parseFloat(debitInitial) || 0,
    });
    setDonneesDebit([]);
  }, []);

  // 1. Charger la liste depuis l'API REST
  const chargerDonnees = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      const data = await getReservoirsAPI();
      const liste = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setListeReservoirs(liste);

      if (liste.length > 0) {
        const cible = liste.find((r) => r.id === reservoirSelectionneId) || liste[0];
        setReservoirSelectionneId(cible.id);
        initialiserReservoir(cible);
      } else {
        setReservoir(null);
        setReservoirSelectionneId(null);
      }
    } catch (err) {
      console.error('Erreur chargement API:', err);
      setErreur(err.message || 'Impossible de charger la liste des réservoirs.');
    } finally {
      setChargement(false);
    }
  }, [reservoirSelectionneId, initialiserReservoir]);

  useEffect(() => {
    chargerDonnees();
  }, []);

  // Changement de réservoir via le menu déroulant
  const handleSelectReservoir = (e) => {
    const id = parseInt(e.target.value, 10);
    setReservoirSelectionneId(id);
    const cible = listeReservoirs.find((r) => r.id === id);
    if (cible) {
      initialiserReservoir(cible);
    }
  };

  // 2. MISE À JOUR EN TEMPS RÉEL VIA WEBSOCKET
  useEffect(() => {
    if (!websocketData || !reservoir) return;

    const targetId = websocketData.reservoir_id || websocketData.reservoir || websocketData.id;
    const targetCode = websocketData.code || websocketData.code_mqtt;

    const correspondAuReservoir =
      !targetId ||
      Number(targetId) === Number(reservoirSelectionneId) ||
      targetCode === (reservoir.code || reservoir.code_mqtt);

    if (correspondAuReservoir) {
      let niveauRecu = websocketData.niveau_pourcentage ?? websocketData.niveau ?? websocketData.niveauActuel;

      if (websocketData.niveau_cm !== undefined && reservoir.hauteur_max_cm) {
        niveauRecu = (parseFloat(websocketData.niveau_cm) / parseFloat(reservoir.hauteur_max_cm)) * 100;
      }

      const niveauOriginal = reservoir.niveauActuel ?? 0;
      const nouveauNiveau = niveauRecu !== undefined ? Math.min(Math.max(parseFloat(niveauRecu), 0), 100) : niveauOriginal;
      const nouveauDebit = websocketData.debit_l_min ?? websocketData.debit_instantane ?? websocketData.debitActuel ?? websocketData.debit ?? reservoir.debitActuel;

      setReservoir((prev) => ({
        ...prev,
        niveauActuel: Math.round(nouveauNiveau * 10) / 10,
        debitActuel: parseFloat(nouveauDebit) || 0,
        statut: websocketData.statut || prev?.statut || 'actif',
      }));

      if (nouveauDebit !== undefined) {
        const timestamp = websocketData.temps || websocketData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setDonneesDebit((prev) => {
          const updated = [...prev, { temps: timestamp, debit: parseFloat(nouveauDebit) || 0 }];
          return updated.slice(-15);
        });
      }
    }
  }, [websocketData, reservoirSelectionneId, reservoir?.code, reservoir?.code_mqtt, reservoir?.hauteur_max_cm]);

  // Fonction pour déterminer la couleur de l'eau selon les seuils
  const obtenirCouleurSeuil = () => {
    if (!reservoir) return '#0284c7';
    const niv = reservoir.niveauActuel;

    const sCritBas = parseFloat(reservoir.seuil_critique_bas ?? reservoir.seuil_bas_critique ?? 10);
    const sCritHaut = parseFloat(reservoir.seuil_critique_haut ?? reservoir.seuil_haut_critique ?? 95);
    const sAltBas = parseFloat(reservoir.seuil_alerte_bas ?? reservoir.seuil_bas_alerte ?? 25);
    const sAltHaut = parseFloat(reservoir.seuil_alerte_haut ?? reservoir.seuil_haut_alerte ?? 90);

    if (niv <= sCritBas || niv >= sCritHaut) return '#ef4444';
    if (niv <= sAltBas || niv >= sAltHaut) return '#f97316';
    return '#0284c7';
  };

  const handleFormChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nom: form.nom,
        code: form.code,
        code_mqtt: form.code,
        description: form.description,
        localisation: form.localisation,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        capacite_max_litres: parseFloat(form.capacite_max_litres),
        hauteur_max_cm: parseFloat(form.hauteur_max_cm),
        seuil_critique_bas: parseFloat(form.seuil_critique_bas),
        seuil_alerte_bas: parseFloat(form.seuil_alerte_bas),
        seuil_alerte_haut: parseFloat(form.seuil_alerte_haut),
        seuil_critique_haut: parseFloat(form.seuil_critique_haut),
        statut: form.statut,
      };

      await creerReservoirAPI(payload);
      setForm(initialFormState);
      setModalOuvert(false);
      await chargerDonnees();
    } catch (err) {
      alert(`Erreur de création : ${err.message}`);
    }
  };

  const handleSupprimer = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce réservoir ?')) {
      try {
        await supprimerReservoirAPI(id);
        await chargerDonnees();
      } catch (err) {
        alert(`Erreur lors de la suppression : ${err.message}`);
      }
    }
  };

  if (chargement) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontWeight: '500' }}>Chargement des réservoirs en cours...</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.5rem' }}>
          {erreur}
        </div>
      </div>
    );
  }

  const capMax = parseFloat(reservoir?.capacite_max_litres) || 10000;
  const volumeLitresActuel = reservoir ? ((capMax * (reservoir.niveauActuel || 0)) / 100).toFixed(0) : 0;
  const couleurEau = obtenirCouleurSeuil();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* En-tête avec Sélecteur & Connexion WebSocket */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.75rem', fontWeight: 'bold' }}>
            {reservoir ? reservoir.nom : 'Aucun réservoir enregistré'}
          </h1>
          <span style={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'monospace' }}>
            Code MQTT: {reservoir?.code || reservoir?.code_mqtt || 'N/A'} | ID: {reservoir?.id || '-'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {listeReservoirs.length > 0 && (
            <select
              value={reservoirSelectionneId || ''}
              onChange={handleSelectReservoir}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
            >
              {listeReservoirs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom} ({r.code || r.code_mqtt})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setModalOuvert(true)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            + Nouveau
          </button>

          {/* Badge WebSocket */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: estConnecte ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
            <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: '500' }}>
              {estConnecte ? 'Télémétrie en temps réel' : 'Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      {reservoir ? (
        <>
          <div style={styles.container}>
            {/* CUVE D'EAU ANIMÉE */}
            <div style={styles.cardCuve}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Niveau d'Eau (Temps Réel)</h3>
              <div style={styles.cuveOuter}>
                <div
                  style={{
                    ...styles.eauFluid,
                    height: `${reservoir.niveauActuel || 0}%`,
                    backgroundColor: couleurEau,
                  }}
                >
                  <div style={styles.vague} />
                </div>
                <span style={styles.pourcentageTexte}>{reservoir.niveauActuel}%</span>
              </div>

              <p style={{ marginTop: '1.25rem', fontWeight: 'bold', color: '#334155', fontSize: '1.1rem' }}>
                {Number(volumeLitresActuel).toLocaleString()} / {capMax.toLocaleString()} L
              </p>
            </div>

            {/* SPÉCIFICATIONS ET MÉTRIQUES DYNAMIQUES */}
            <div style={styles.cardInfos}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>Détails & Seuils de Tolérance</h3>
                <button onClick={() => handleSupprimer(reservoir.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Supprimer
                </button>
              </div>

              <ul style={styles.listeSpec}>
                <li><strong>Débit instantané :</strong> <span style={{ color: '#0284c7', fontWeight: 'bold' }}>{reservoir.debitActuel} L/min</span></li>
                <li><strong>Localisation :</strong> {reservoir.localisation || 'N/A'}</li>
                <li><strong>Description :</strong> {reservoir.description || 'N/A'}</li>
                <li><strong>Coordonnées GPS :</strong> {reservoir.latitude || '-'}, {reservoir.longitude || '-'}</li>
                <li><strong>Hauteur Maximale :</strong> {reservoir.hauteur_max_cm} cm</li>
                <li><strong>Seuils d'Alerte (Bas / Haut) :</strong> {reservoir.seuil_alerte_bas ?? reservoir.seuil_bas_alerte}% / {reservoir.seuil_alerte_haut ?? reservoir.seuil_haut_alerte}%</li>
                <li><strong>Seuils Critiques (Bas / Haut) :</strong> {reservoir.seuil_critique_bas ?? reservoir.seuil_bas_critique}% / {reservoir.seuil_critique_haut ?? reservoir.seuil_haut_critique}%</li>
                <li>
                  <strong>Statut du réservoir :</strong>{' '}
                  <span style={{ color: reservoir.statut === 'actif' ? '#16a34a' : '#d97706', fontWeight: 'bold' }}>
                    {reservoir.statut}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* GRAPHIQUE DU DÉBIT EN TEMPS RÉEL */}
          <div style={{ marginTop: '2rem', backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Flux de Débit en Direct (L/min)</h3>
            <GraphiqueDebit donnees={donneesDebit} />
          </div>
        </>
      ) : (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b' }}>Aucun réservoir trouvé. Cliquez sur <strong>+ Nouveau</strong> pour en créer un.</p>
        </div>
      )}

      {/* MODAL CRÉATION RÉSERVOIR */}
      {modalOuvert && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: '#0f172a' }}>Ajouter un Réservoir</h2>
            <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={styles.label}>Nom (Unique) *</label>
                <input style={styles.input} type="text" name="nom" value={form.nom} required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Code MQTT (Unique) *</label>
                <input style={styles.input} type="text" name="code" value={form.code} required onChange={handleFormChange} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Description *</label>
                <input style={styles.input} type="text" name="description" value={form.description} required onChange={handleFormChange} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Localisation *</label>
                <input style={styles.input} type="text" name="localisation" value={form.localisation} required onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Latitude</label>
                <input style={styles.input} type="number" step="any" name="latitude" value={form.latitude} onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Longitude</label>
                <input style={styles.input} type="number" step="any" name="longitude" value={form.longitude} onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Capacité Max (L) *</label>
                <input style={styles.input} type="number" step="0.1" name="capacite_max_litres" value={form.capacite_max_litres} required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Hauteur Max (cm) *</label>
                <input style={styles.input} type="number" step="0.1" name="hauteur_max_cm" value={form.hauteur_max_cm} required onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Seuil Critique Bas (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_critique_bas" value={form.seuil_critique_bas} required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Seuil Alerte Bas (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_alerte_bas" value={form.seuil_alerte_bas} required onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Seuil Alerte Haut (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_alerte_haut" value={form.seuil_alerte_haut} required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Seuil Critique Haut (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_critique_haut" value={form.seuil_critique_haut} required onChange={handleFormChange} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Statut *</label>
                <select style={styles.input} name="statut" onChange={handleFormChange} value={form.statut}>
                  <option value="actif">Actif</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setModalOuvert(false)} style={styles.btnSecondary}>Annuler</button>
                <button type="submit" style={styles.btnPrimary}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes onduler {
          0% { transform: translateX(0) scaleY(1); }
          50% { transform: translateX(-25%) scaleY(1.1); }
          100% { transform: translateX(-50%) scaleY(1); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' },
  cardCuve: { background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' },
  cardInfos: { background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  cuveOuter: { position: 'relative', width: '150px', height: '220px', border: '4px solid #334155', borderRadius: '0 0 16px 16px', margin: '1rem auto 0 auto', overflow: 'hidden', backgroundColor: '#f1f5f9' },
  eauFluid: { position: 'absolute', bottom: 0, left: 0, right: 0, transition: 'height 0.8s ease-in-out, background-color 0.5s ease' },
  vague: { position: 'absolute', top: '-10px', left: 0, width: '200%', height: '20px', background: 'rgba(255, 255, 255, 0.3)', borderRadius: '40%', animation: 'onduler 4s infinite linear' },
  pourcentageTexte: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold', fontSize: '1.5rem', color: '#0f172a', zIndex: 2, textShadow: '0px 0px 4px rgba(255,255,255,0.9)' },
  listeSpec: { listStyle: 'none', padding: 0, margin: 0, lineHeight: '2.1rem', color: '#475569', fontSize: '0.9rem' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' },
  modalContent: { backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '0.25rem' },
  input: { width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' },
  btnPrimary: { padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' },
  btnSecondary: { padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '0.5rem', border: '1px solid #cbd5e1', cursor: 'pointer' },
};

export default Reservoirs;

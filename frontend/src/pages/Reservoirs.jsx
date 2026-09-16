import React, { useState, useEffect } from 'react';
import GraphiqueDebit from '../components/GraphiqueDebit';
import { useWebSocket } from '../hooks/useWebSocket';
import { getReservoirsAPI, creerReservoirAPI, supprimerReservoirAPI } from '../services/reservoirService';

const Reservoirs = () => {
  const [listeReservoirs, setListeReservoirs] = useState([]);
  const [reservoirSelectionneId, setReservoirSelectionneId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [donneesDebit, setDonneesDebit] = useState([]);

  // État local du réservoir enrichi des données temps réel
  const [reservoir, setReservoir] = useState(null);

  // Formulaire de création
  const [form, setForm] = useState({
    nom: '',
    code: '',
    description: '',
    localisation: '',
    latitude: '',
    longitude: '',
    capacite_max_litres: '',
    hauteur_max_cm: '',
    seuil_critique_bas: '',
    seuil_alerte_bas: '',
    seuil_alerte_haut: '',
    seuil_critique_haut: '',
    statut: 'actif',
  });

  // WebSocket pour la télémétrie en temps réel
  const WS_URL = 'ws://127.0.0.1:8000/ws/telemetrie/';
  const { data: websocketData, estConnecte } = useWebSocket(WS_URL);

  // 1. Charger la liste depuis l'API REST
  const chargerDonnees = async () => {
    try {
      setChargement(true);
      const data = await getReservoirsAPI();
      setListeReservoirs(data);
      if (data.length > 0) {
        const premier = data[0];
        setReservoirSelectionneId(premier.id);
        initialiserReservoir(premier);
      }
    } catch (err) {
      console.error('Erreur chargement API:', err);
    } finally {
      setChargement(false);
    }
  };

  const initialiserReservoir = (dataRes) => {
    setReservoir({
      ...dataRes,
      niveauActuel: 50, // Niveau par défaut (%) avant réception trame WS
      debitActuel: 0,   // Débit par défaut (L/min)
    });
    setDonneesDebit([]);
  };

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
    if (websocketData && reservoir) {
      // Filtrer les trames destinées au réservoir sélectionné
      const correspondAuReservoir = 
        !websocketData.reservoir_id || 
        websocketData.reservoir_id === reservoirSelectionneId || 
        websocketData.code === reservoir.code;

      if (correspondAuReservoir) {
        const nouveauNiveau = websocketData.niveau !== undefined ? websocketData.niveau : reservoir.niveauActuel;
        const nouveauDebit = websocketData.debitActuel !== undefined ? websocketData.debitActuel : reservoir.debitActuel;

        // Mise à jour instantanée de l'état
        setReservoir((prev) => ({
          ...prev,
          niveauActuel: Math.min(Math.max(nouveauNiveau, 0), 100), // Borner entre 0 et 100%
          debitActuel: nouveauDebit,
          statut: websocketData.statut || prev.statut,
        }));

        // Mise à jour de l'historique du débit pour le graphique
        if (nouveauDebit !== undefined) {
          const timestamp = websocketData.temps || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setDonneesDebit((prev) => {
            const updated = [...prev, { temps: timestamp, debit: nouveauDebit }];
            if (updated.length > 12) updated.shift(); // Conserver les 12 dernières mesures
            return updated;
          });
        }
      }
    }
  }, [websocketData, reservoirSelectionneId]);

  // Fonction pour déterminer la couleur de l'eau selon les seuils SQL
  const ObtenirCouleurSeuil = () => {
    if (!reservoir) return '#0284c7';
    const niv = reservoir.niveauActuel;
    
    if (niv <= reservoir.seuil_critique_bas || niv >= reservoir.seuil_critique_haut) {
      return '#ef4444'; // Rouge alert
    }
    if (niv <= reservoir.seuil_alerte_bas || niv >= reservoir.seuil_alerte_haut) {
      return '#f97316'; // Orange alerte
    }
    return '#0284c7'; // Bleu normal
  };

  // Formulaire & actions CRUD
  const handleFormChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nom: form.nom,
        code: form.code,
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
      setModalOuvert(false);
      chargerDonnees();
    } catch (err) {
      alert(`Erreur de validation: ${err.message}`);
    }
  };

  const handleSupprimer = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce réservoir ?')) {
      try {
        await supprimerReservoirAPI(id);
        chargerDonnees();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (chargement) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement du système temps réel...</div>;

  const volumeLitresActuel = reservoir ? ((reservoir.capacite_max_litres * reservoir.niveauActuel) / 100).toFixed(0) : 0;
  const couleurEau = ObtenirCouleurSeuil();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* En-tête avec Sélecteur & Connexion WebSocket */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.75rem', fontWeight: 'bold' }}>
            {reservoir ? reservoir.nom : 'Aucun réservoir'}
          </h1>
          <span style={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'monospace' }}>
            Code MQTT: {reservoir?.code || 'N/A'} | ID: {reservoir?.id || '-'}
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
                <option key={r.id} value={r.id}>{r.nom} ({r.code})</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setModalOuvert(true)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            + Nouveau
          </button>

          {/* Badge du flux Websocket */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: estConnecte ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
            <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: '500' }}>
              {estConnecte ? 'Télémétrie en temps réel' : 'Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      {reservoir && (
        <div style={styles.container}>
          {/* CUVE D'EAU ANIME EN TEMPS REEL */}
          <div style={styles.cardCuve}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Niveau d'Eau (Temps Réel)</h3>
            <div style={styles.cuveOuter}>
              <div
                style={{
                  ...styles.eauFluid,
                  height: `${reservoir.niveauActuel}%`,
                  backgroundColor: couleurEau,
                }}
              >
                <div style={styles.vague} />
              </div>
              <span style={styles.pourcentageTexte}>{reservoir.niveauActuel}%</span>
            </div>
            
            <p style={{ marginTop: '1.25rem', fontWeight: 'bold', color: '#334155', fontSize: '1.1rem' }}>
              {Number(volumeLitresActuel).toLocaleString()} / {reservoir.capacite_max_litres.toLocaleString()} L
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
              <li><strong>Localisation :</strong> {reservoir.localisation}</li>
              <li><strong>Description :</strong> {reservoir.description}</li>
              <li><strong>Coordonnées GPS :</strong> {reservoir.latitude || '-'}, {reservoir.longitude || '-'}</li>
              <li><strong>Hauteur Maximale :</strong> {reservoir.hauteur_max_cm} cm</li>
              <li><strong>Seuils d'Alerte (Bas / Haut) :</strong> {reservoir.seuil_alerte_bas}% / {reservoir.seuil_alerte_haut}%</li>
              <li><strong>Seuils Critiques (Bas / Haut) :</strong> {reservoir.seuil_critique_bas}% / {reservoir.seuil_critique_haut}%</li>
              <li>
                <strong>Statut du réservoir :</strong>{' '}
                <span style={{ color: reservoir.statut === 'actif' ? '#16a34a' : '#d97706', fontWeight: 'bold' }}>
                  {reservoir.statut}
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* GRAPHIQUE DU DÉBIT EN TEMPS RÉEL */}
      <div style={{ marginTop: '2rem', backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Flux de Débit en Direct (L/min)</h3>
        <GraphiqueDebit donnees={donneesDebit} />
      </div>

      {/* MODAL CREATION RESERVOIR */}
      {modalOuvert && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: '#0f172a' }}>Ajouter un Réservoir</h2>
            <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={styles.label}>Nom (Unique) *</label>
                <input style={styles.input} type="text" name="nom" required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Code MQTT (Unique) *</label>
                <input style={styles.input} type="text" name="code" required onChange={handleFormChange} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Description *</label>
                <input style={styles.input} type="text" name="description" required onChange={handleFormChange} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Localisation *</label>
                <input style={styles.input} type="text" name="localisation" required onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Latitude</label>
                <input style={styles.input} type="number" step="any" name="latitude" onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Longitude</label>
                <input style={styles.input} type="number" step="any" name="longitude" onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Capacité Max (L) *</label>
                <input style={styles.input} type="number" step="0.1" name="capacite_max_litres" required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Hauteur Max (cm) *</label>
                <input style={styles.input} type="number" step="0.1" name="hauteur_max_cm" required onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Seuil Critique Bas (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_critique_bas" required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Seuil Alerte Bas (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_alerte_bas" required onChange={handleFormChange} />
              </div>

              <div>
                <label style={styles.label}>Seuil Alerte Haut (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_alerte_haut" required onChange={handleFormChange} />
              </div>
              <div>
                <label style={styles.label}>Seuil Critique Haut (%) *</label>
                <input style={styles.input} type="number" step="0.1" name="seuil_critique_haut" required onChange={handleFormChange} />
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
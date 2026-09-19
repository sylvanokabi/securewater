import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import GraphiqueDebit from '../components/GraphiqueDebit';
import { useWebSocket } from '../hooks/useWebSocket';
import { getReservoirsAPI, creerReservoirAPI, supprimerReservoirAPI } from '../services/reservoirService';
import { getCapteursAPI } from '../services/capteurService';

const Reservoirs = () => {
  // ================================================================
  // States
  // ================================================================
  const [listeReservoirs, setListeReservoirs] = useState([]);
  const [reservoirSelectionneId, setReservoirSelectionneId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [donneesDebit, setDonneesDebit] = useState([]);

  const [reservoir, setReservoir] = useState(null);
  const [capteurs, setCapteurs] = useState([]);
  const [alertesDirect, setAlertesDirect] = useState([]);
  const [etatsCapteurs, setEtatsCapteurs] = useState({});

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

  // ================================================================
  // MAP : code capteur → objet capteur (pour router les messages WS)
  // ================================================================
  const capteursParCode = useMemo(() => {
    const map = {};
    capteurs.forEach((c) => {
      map[c.code] = c;
    });
    return map;
  }, [capteurs]);

  // ================================================================
  // Refs — pour éviter les boucles infinies dans les useEffect
  // ================================================================
  const capteursParCodeRef = useRef({});
  const reservoirRef = useRef(null);

  useEffect(() => {
    capteursParCodeRef.current = capteursParCode;
  }, [capteursParCode]);

  useEffect(() => {
    reservoirRef.current = reservoir;
  }, [reservoir]);

  // ================================================================
  // Construction de l'URL WebSocket
  // ⚠️ URL ABSOLUE vers Django, SANS token.
  //    Le hook useWebSocket ajoute le token automatiquement.
  // ================================================================
  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';

  const wsPath = reservoir?.code
    ? `${WS_BASE}/ws/reservoirs/${reservoir.code}/`
    : null;

  const { data: messageWS, estConnecte } = useWebSocket(wsPath);

  // ================================================================
  // 1. Initialisation du réservoir à partir des données REST
  // ================================================================
  const initialiserReservoir = useCallback((dataRes) => {
    const niveauInitial =
      dataRes.niveau_pourcentage ??
      dataRes.niveau ??
      (dataRes.volume_actuel_litres && dataRes.capacite_max_litres
        ? (dataRes.volume_actuel_litres / dataRes.capacite_max_litres) * 100
        : 0);

    const debitInitial =
      dataRes.debit_instantane ?? dataRes.debitActuel ?? dataRes.debit ?? 0;

    setReservoir({
      ...dataRes,
      code: dataRes.code || dataRes.code_mqtt || '',
      niveauActuel: Math.min(Math.max(parseFloat(niveauInitial) || 0, 0), 100),
      debitActuel: parseFloat(debitInitial) || 0,
    });
    setDonneesDebit([]);
    setAlertesDirect([]);
    setEtatsCapteurs({});
  }, []);

  // ================================================================
  // 2. Charger la liste des réservoirs (REST)
  // ================================================================
  const chargerDonnees = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      const data = await getReservoirsAPI();
      const liste = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setListeReservoirs(liste);

      if (liste.length > 0) {
        const cible =
          liste.find((r) => r.id === reservoirSelectionneId) || liste[0];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================================================================
  // 3. Charger les capteurs du réservoir sélectionné (REST)
  //    + Rafraîchissement auto toutes les 5s
  //    → utile quand on crée un capteur dans un autre onglet pendant
  //      une simulation, il apparaît tout seul ici
  // ================================================================
  useEffect(() => {
    if (!reservoirSelectionneId) {
      setCapteurs([]);
      return;
    }

    let annule = false;

    const chargerCapteurs = async () => {
      try {
        const data = await getCapteursAPI({ reservoir: reservoirSelectionneId });
        if (annule) return;
        const liste = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        setCapteurs(liste);
      } catch (err) {
        console.error('Erreur chargement capteurs:', err);
        if (!annule) setCapteurs([]);
      }
    };

    // Premier chargement immédiat
    chargerCapteurs();

    // Puis rafraîchit toutes les 5s
    const intervalle = setInterval(chargerCapteurs, 5000);

    return () => {
      annule = true;
      clearInterval(intervalle);
    };
  }, [reservoirSelectionneId]);

  // ================================================================
  // 4. Traitement des messages WebSocket
  // ⚠️ UNE SEULE dépendance : messageWS.
  // ================================================================
  useEffect(() => {
    if (!messageWS) return;
    if (!reservoirRef.current) return;

    const { type } = messageWS;
    const capteursParCodeCourant = capteursParCodeRef.current;

    // ----------------------------------------
    // Bienvenue
    // ----------------------------------------
    if (type === 'bienvenue') {
      console.log('[WS] Connecté au réservoir', messageWS.reservoir);
      return;
    }

    // ----------------------------------------
    // Nouvelle mesure
    // ----------------------------------------
    if (type === 'mesure') {
      const capteurCode = messageWS.capteur;
      const capteurInfo = capteursParCodeCourant[capteurCode];

      if (!capteurInfo) return;

      // -------------------- Capteur de NIVEAU --------------------
      if (capteurInfo.type === 'niveau') {
        const nouveauNiveau = messageWS.pourcentage_remplissage;

        if (nouveauNiveau !== undefined && nouveauNiveau !== null) {
          setReservoir((prev) => ({
            ...prev,
            niveauActuel: Math.round(nouveauNiveau * 10) / 10,
            etatNiveau: messageWS.etat_niveau,
            volumeActuel: messageWS.volume_litres,
          }));
        }
      }

      // -------------------- Capteur de DÉBIT ---------------------
      if (capteurInfo.type === 'debit') {
        const nouveauDebit = messageWS.valeur;
        if (nouveauDebit !== undefined && nouveauDebit !== null) {
          setReservoir((prev) => ({
            ...prev,
            debitActuel: Math.round(nouveauDebit * 100) / 100,
          }));

          const timestamp = messageWS.horodatage
            ? new Date(messageWS.horodatage).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

          setDonneesDebit((prev) =>
            [...prev, { temps: timestamp, debit: nouveauDebit }].slice(-15)
          );
        }
      }

      return;
    }

    // ----------------------------------------
    // Changement d'état d'un capteur
    // ----------------------------------------
    if (type === 'capteur_etat') {
      setEtatsCapteurs((prev) => ({
        ...prev,
        [messageWS.capteur]: {
          en_ligne: messageWS.en_ligne,
          etat_connexion: messageWS.etat_connexion,
        },
      }));
      return;
    }

    // ----------------------------------------
    // Nouvelle alerte
    // ----------------------------------------
    if (type === 'alerte') {
      setAlertesDirect((prev) =>
        [
          {
            id: messageWS.alerte_id,
            gravite: messageWS.gravite,
            type: messageWS.type_alerte,
            message: messageWS.message,
            capteur: messageWS.capteur,
            date: messageWS.date_declenchement,
          },
          ...prev,
        ].slice(0, 10)
      );
      return;
    }
  }, [messageWS]);

  // ================================================================
  // Handlers
  // ================================================================
  const handleSelectReservoir = (e) => {
    const id = parseInt(e.target.value, 10);
    setReservoirSelectionneId(id);
    const cible = listeReservoirs.find((r) => r.id === id);
    if (cible) initialiserReservoir(cible);
  };

  const handleFormChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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

  // ================================================================
  // Couleur de l'eau selon les seuils
  // ================================================================
  const obtenirCouleurSeuil = () => {
    if (!reservoir) return '#0284c7';
    const niv = reservoir.niveauActuel;

    const sCritBas = parseFloat(reservoir.seuil_critique_bas ?? 10);
    const sCritHaut = parseFloat(reservoir.seuil_critique_haut ?? 95);
    const sAltBas = parseFloat(reservoir.seuil_alerte_bas ?? 25);
    const sAltHaut = parseFloat(reservoir.seuil_alerte_haut ?? 90);

    if (niv <= sCritBas || niv >= sCritHaut) return '#ef4444';
    if (niv <= sAltBas || niv >= sAltHaut) return '#f97316';
    return '#0284c7';
  };

  // ================================================================
  // Rendu
  // ================================================================
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
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '0.5rem',
          }}
        >
          {erreur}
        </div>
      </div>
    );
  }

  const capMax = parseFloat(reservoir?.capacite_max_litres) || 10000;
  const volumeLitresActuel = reservoir
    ? ((capMax * (reservoir.niveauActuel || 0)) / 100).toFixed(0)
    : 0;
  const couleurEau = obtenirCouleurSeuil();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* En-tête */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              color: '#0f172a',
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 'bold',
            }}
          >
            {reservoir ? reservoir.nom : 'Aucun réservoir enregistré'}
          </h1>
          <span
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              fontFamily: 'monospace',
            }}
          >
            Code MQTT: {reservoir?.code || 'N/A'} | ID: {reservoir?.id || '-'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {listeReservoirs.length > 0 && (
            <select
              value={reservoirSelectionneId || ''}
              onChange={handleSelectReservoir}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
              }}
            >
              {listeReservoirs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom} ({r.code})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setModalOuvert(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0284c7',
              color: '#fff',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            + Nouveau
          </button>

          {/* Badge WebSocket */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f8fafc',
              padding: '0.5rem 0.75rem',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: estConnecte ? '#16a34a' : '#dc2626',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: '0.875rem',
                color: '#475569',
                fontWeight: '500',
              }}
            >
              {estConnecte ? 'Télémétrie en temps réel' : 'Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      {/* Alertes en direct */}
      {alertesDirect.length > 0 && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
          }}
        >
          <strong style={{ color: '#b91c1c' }}>🚨 Alertes en cours</strong>
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
            {alertesDirect.slice(0, 3).map((a) => (
              <li key={a.id} style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
                [{a.gravite}] {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reservoir ? (
        <>
          <div style={styles.container}>
            {/* CUVE */}
            <div style={styles.cardCuve}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>
                Niveau d'Eau (Temps Réel)
              </h3>
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
                <span style={styles.pourcentageTexte}>
                  {reservoir.niveauActuel}%
                </span>
              </div>

              <p
                style={{
                  marginTop: '1.25rem',
                  fontWeight: 'bold',
                  color: '#334155',
                  fontSize: '1.1rem',
                }}
              >
                {Number(volumeLitresActuel).toLocaleString()} /{' '}
                {capMax.toLocaleString()} L
              </p>

              {reservoir.etatNiveau && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    backgroundColor:
                      reservoir.etatNiveau === 'normal'
                        ? '#dcfce7'
                        : reservoir.etatNiveau === 'critique' ||
                          reservoir.etatNiveau === 'debordement'
                        ? '#fee2e2'
                        : '#fed7aa',
                    color:
                      reservoir.etatNiveau === 'normal'
                        ? '#166534'
                        : reservoir.etatNiveau === 'critique' ||
                          reservoir.etatNiveau === 'debordement'
                        ? '#991b1b'
                        : '#9a3412',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}
                >
                  {reservoir.etatNiveau}
                </span>
              )}
            </div>

            {/* DÉTAILS */}
            <div style={styles.cardInfos}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h3 style={{ margin: 0, color: '#1e293b' }}>
                  Détails & Seuils de Tolérance
                </h3>
                <button
                  onClick={() => handleSupprimer(reservoir.id)}
                  style={{
                    color: '#ef4444',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Supprimer
                </button>
              </div>

              <ul style={styles.listeSpec}>
                <li>
                  <strong>Débit instantané :</strong>{' '}
                  <span style={{ color: '#0284c7', fontWeight: 'bold' }}>
                    {reservoir.debitActuel} L/min
                  </span>
                </li>
                <li>
                  <strong>Localisation :</strong>{' '}
                  {reservoir.localisation || 'N/A'}
                </li>
                <li>
                  <strong>Description :</strong> {reservoir.description || 'N/A'}
                </li>
                <li>
                  <strong>Coordonnées GPS :</strong>{' '}
                  {reservoir.latitude || '-'}, {reservoir.longitude || '-'}
                </li>
                <li>
                  <strong>Hauteur Maximale :</strong> {reservoir.hauteur_max_cm}{' '}
                  cm
                </li>
                <li>
                  <strong>Seuils d'Alerte (Bas / Haut) :</strong>{' '}
                  {reservoir.seuil_alerte_bas}% / {reservoir.seuil_alerte_haut}%
                </li>
                <li>
                  <strong>Seuils Critiques (Bas / Haut) :</strong>{' '}
                  {reservoir.seuil_critique_bas}% /{' '}
                  {reservoir.seuil_critique_haut}%
                </li>
                <li>
                  <strong>Statut du réservoir :</strong>{' '}
                  <span
                    style={{
                      color:
                        reservoir.statut === 'actif' ? '#16a34a' : '#d97706',
                      fontWeight: 'bold',
                    }}
                  >
                    {reservoir.statut}
                  </span>
                </li>
              </ul>

              {/* Liste des capteurs en direct */}
              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1rem',
                }}
              >
                <strong style={{ color: '#1e293b', fontSize: '0.9rem' }}>
                  Capteurs ({capteurs.length})
                </strong>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0.5rem 0 0 0',
                  }}
                >
                  {capteurs.map((c) => {
                    const etat = etatsCapteurs[c.code];
                    const enLigne = etat ? etat.en_ligne : c.en_ligne;
                    return (
                      <li
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.25rem 0',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: enLigne ? '#16a34a' : '#dc2626',
                          }}
                        />
                        <span style={{ fontFamily: 'monospace' }}>
                          {c.code}
                        </span>
                        <span style={{ color: '#94a3b8' }}>({c.type})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* GRAPHIQUE DÉBIT */}
          <div
            style={{
              marginTop: '2rem',
              backgroundColor: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>
              Flux de Débit en Direct (L/min)
            </h3>
            <GraphiqueDebit donnees={donneesDebit} />
          </div>
        </>
      ) : (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <p style={{ color: '#64748b' }}>
            Aucun réservoir trouvé. Cliquez sur <strong>+ Nouveau</strong> pour en
            créer un.
          </p>
        </div>
      )}

      {/* MODAL CRÉATION */}
      {modalOuvert && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: '#0f172a' }}>
              Ajouter un Réservoir
            </h2>
            <form
              onSubmit={handleCreateSubmit}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              <div>
                <label style={styles.label}>Nom (Unique) *</label>
                <input
                  style={styles.input}
                  type="text"
                  name="nom"
                  value={form.nom}
                  required
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label style={styles.label}>Code MQTT (Unique) *</label>
                <input
                  style={styles.input}
                  type="text"
                  name="code"
                  value={form.code}
                  required
                  onChange={handleFormChange}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Description *</label>
                <input
                  style={styles.input}
                  type="text"
                  name="description"
                  value={form.description}
                  required
                  onChange={handleFormChange}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Localisation *</label>
                <input
                  style={styles.input}
                  type="text"
                  name="localisation"
                  value={form.localisation}
                  required
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label style={styles.label}>Latitude</label>
                <input
                  style={styles.input}
                  type="number"
                  step="any"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label style={styles.label}>Longitude</label>
                <input
                  style={styles.input}
                  type="number"
                  step="any"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label style={styles.label}>Capacité Max (L) *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  name="capacite_max_litres"
                  value={form.capacite_max_litres}
                  required
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label style={styles.label}>Hauteur Max (cm) *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  name="hauteur_max_cm"
                  value={form.hauteur_max_cm}
                  required
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label style={styles.label}>Seuil Critique Bas (%) *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  name="seuil_critique_bas"
                  value={form.seuil_critique_bas}
                  required
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label style={styles.label}>Seuil Alerte Bas (%) *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  name="seuil_alerte_bas"
                  value={form.seuil_alerte_bas}
                  required
                  onChange={handleFormChange}
                />
              </div>

              <div>
                <label style={styles.label}>Seuil Alerte Haut (%) *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  name="seuil_alerte_haut"
                  value={form.seuil_alerte_haut}
                  required
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label style={styles.label}>Seuil Critique Haut (%) *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.1"
                  name="seuil_critique_haut"
                  value={form.seuil_critique_haut}
                  required
                  onChange={handleFormChange}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={styles.label}>Statut *</label>
                <select
                  style={styles.input}
                  name="statut"
                  onChange={handleFormChange}
                  value={form.statut}
                >
                  <option value="actif">Actif</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>

              <div
                style={{
                  gridColumn: 'span 2',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '1rem',
                  marginTop: '1rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOuvert(false)}
                  style={styles.btnSecondary}
                >
                  Annuler
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  Enregistrer
                </button>
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
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  cardCuve: {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  cardInfos: {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
  },
  cuveOuter: {
    position: 'relative',
    width: '150px',
    height: '220px',
    border: '4px solid #334155',
    borderRadius: '0 0 16px 16px',
    margin: '1rem auto 0 auto',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  eauFluid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    transition: 'height 0.8s ease-in-out, background-color 0.5s ease',
  },
  vague: {
    position: 'absolute',
    top: '-10px',
    left: 0,
    width: '200%',
    height: '20px',
    background: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '40%',
    animation: 'onduler 4s infinite linear',
  },
  pourcentageTexte: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontWeight: 'bold',
    fontSize: '1.5rem',
    color: '#0f172a',
    zIndex: 2,
    textShadow: '0px 0px 4px rgba(255,255,255,0.9)',
  },
  listeSpec: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    lineHeight: '2.1rem',
    color: '#475569',
    fontSize: '0.9rem',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: '1rem',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '1.5rem',
    borderRadius: '12px',
    maxWidth: '650px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '0.25rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.875rem',
  },
  btnPrimary: {
    padding: '0.5rem 1rem',
    backgroundColor: '#0284c7',
    color: '#fff',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
};

export default Reservoirs;
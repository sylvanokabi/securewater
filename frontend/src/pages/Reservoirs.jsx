import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getReservoirsAPI, creerReservoirAPI, supprimerReservoirAPI } from '../services/reservoirService';
import { getCapteursAPI, ajouterCapteurAPI, supprimerCapteurAPI } from '../services/capteurService';
import { getAlertesAPI, resoudreAlerteAPI } from '../services/alerteService';
import api from '../services/api';

const Reservoirs = () => {
  // ================================================================
  // States
  // ================================================================
  const [listeReservoirs, setListeReservoirs] = useState([]);
  const [reservoirSelectionneId, setReservoirSelectionneId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [reservoir, setReservoir] = useState(null);
  const [capteurs, setCapteurs] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [acquittementEnCours, setAcquittementEnCours] = useState({});

  const [modalReservoir, setModalReservoir] = useState(false);
  const [modalCapteur, setModalCapteur] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, type: '', id: null, nom: '' });

  const initialReservoirForm = {
    nom: '', description: '', localisation: '', latitude: '', longitude: '',
    capacite_max_litres: '', hauteur_max_cm: '', seuil_critique_bas: '10',
    seuil_alerte_bas: '25', seuil_alerte_haut: '90', seuil_critique_haut: '95', statut: 'actif',
  };
  const [formReservoir, setFormReservoir] = useState(initialReservoirForm);
  const [formCapteur, setFormCapteur] = useState({ nom: '', type: 'niveau' });

  const reservoirRef = useRef(null);
  useEffect(() => { reservoirRef.current = reservoir; }, [reservoir]);

  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
  const wsPath = reservoir?.code ? `${WS_BASE}/ws/reservoirs/${reservoir.code}/` : null;
  const { data: messageWS, estConnecte } = useWebSocket(wsPath);

  // ================================================================
  // Toast (AXE 4)
  // ================================================================
  const showToast = (message, type = 'success', details = null) => {
    setToast({ message, type, details });
    const duration = type === 'error' || type === 'warning' ? 6000 : 3500;
    setTimeout(() => setToast(null), duration);
  };

  // ================================================================
  // Helpers Alertes (AXE 1 & 2)
  // ================================================================
  const getAlerteStyle = (gravite) => {
    switch (gravite?.toLowerCase()) {
      case 'critique':
        return { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', icon: '🚨', pulse: true };
      case 'avertissement':
        return { bg: '#fff7ed', border: '#f97316', text: '#c2410c', icon: '⚠️', pulse: false };
      case 'info':
      default:
        return { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', icon: 'ℹ️', pulse: false };
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      niveau_critique_bas: 'Niveau critique bas',
      niveau_bas: 'Niveau bas',
      niveau_haut: 'Niveau haut',
      debordement: 'Débordement',
      capteur_hors_ligne: 'Capteur hors ligne',
      capteur_silencieux: 'Capteur silencieux',
      erreur_capteur: 'Erreur capteur',
      manuelle: 'Alerte manuelle',
    };
    return labels[type] || type || 'Alerte';
  };

  // ================================================================
  // Chargement
  // ================================================================
  const initialiserReservoir = useCallback((dataRes) => {
    const niveauInitial = dataRes.niveau_actuel_pct ?? 70;
    setReservoir({
      ...dataRes,
      code: dataRes.code || '',
      niveauActuel: Math.min(Math.max(parseFloat(niveauInitial) || 0, 0), 100),
      debitActuel: 0,
    });
  }, []);

  const chargerReservoirs = useCallback(async () => {
    try {
      setChargement(true);
      const data = await getReservoirsAPI();
      const liste = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setListeReservoirs(liste);

      if (liste.length > 0) {
        const cible = liste.find((r) => r.id === reservoirSelectionneId) || liste[0];
        setReservoirSelectionneId(cible.id);
        initialiserReservoir(cible);
      } else {
        setReservoir(null);
      }
    } catch (err) {
      showToast("Erreur de chargement des réservoirs", "error");
    } finally {
      setChargement(false);
    }
  }, [reservoirSelectionneId, initialiserReservoir]);

  useEffect(() => { chargerReservoirs(); }, []);

  const chargerCapteurs = useCallback(async () => {
    if (!reservoirSelectionneId) return;
    try {
      const data = await getCapteursAPI({ reservoir: reservoirSelectionneId });
      setCapteurs(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  }, [reservoirSelectionneId]);

  const chargerAlertes = useCallback(async () => {
    if (!reservoirSelectionneId) return;
    try {
      // ✅ Le service accepte désormais les params
      const data = await getAlertesAPI({ reservoir: reservoirSelectionneId, statut: 'active' });
      const liste = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      // ✅ Filtrage client-side de sécurité (au cas où le backend ignore les params)
      const filtrees = liste.filter(a => a.statut === 'active');
      setAlertes(filtrees);
    } catch (err) { console.error(err); }
  }, [reservoirSelectionneId]);

  useEffect(() => {
    chargerCapteurs();
    chargerAlertes();
    const interval = setInterval(() => {
      chargerCapteurs();
      chargerAlertes();
    }, 5000);
    return () => clearInterval(interval);
  }, [chargerCapteurs, chargerAlertes]);

  // Mise à jour de secours pour la jauge
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!reservoirRef.current) return;
      try {
        const res = await api.get(`reservoirs/${reservoirRef.current.id}/`);
        setReservoir((prev) => ({ 
          ...prev, 
          niveauActuel: Math.round(res.data.niveau_actuel_pct * 10) / 10 
        }));
      } catch (err) { /* silencieux */ }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ================================================================
  // WebSocket
  // ================================================================
  useEffect(() => {
    if (!messageWS || !reservoirRef.current) return;
    const { type } = messageWS;

    if (type === 'mesure') {
      setCapteurs(prev => prev.map(c => 
        c.code === messageWS.capteur ? { ...c, derniere_valeur: messageWS.valeur, en_ligne: true } : c
      ));
      if (messageWS.unite === 'L/min' && messageWS.valeur != null) {
        setReservoir((prev) => ({ ...prev, debitActuel: Math.round(messageWS.valeur * 100) / 100 }));
      }
    }

    if (type === 'capteur_etat') {
      setCapteurs(prev => prev.map(c => c.code === messageWS.capteur ? { ...c, en_ligne: messageWS.en_ligne } : c));
    }

    if (type === 'alerte') {
      // ✅ Normalisation du payload avec fallback (gère les deux conventions de nommage)
      const nouvelleAlerte = {
        id: messageWS.alerte_id || messageWS.id || Date.now(),
        message: messageWS.message || 'Alerte détectée',
        gravite: messageWS.gravite || 'avertissement',
        type: messageWS.type || messageWS.type_alerte || 'manuelle',
        type_display: messageWS.type_display,
        statut: 'active',
        capteur: messageWS.capteur_id || messageWS.capteur,
        capteur_code: messageWS.capteur_code || messageWS.capteur,
        capteur_nom: messageWS.capteur_nom,
        valeur_mesure: messageWS.valeur_mesure ?? messageWS.valeur_mesuree ?? null,
        seuil_franchi: messageWS.seuil_franchi ?? messageWS.seuil ?? null,
        date_declenchement: messageWS.date_declenchement || messageWS.created_at || new Date().toISOString(),
      };
      
      setAlertes(prev => {
        if (prev.find(a => a.id === nouvelleAlerte.id)) return prev;
        return [nouvelleAlerte, ...prev];
      });

      const isCritique = nouvelleAlerte.gravite.toLowerCase() === 'critique';
      
      showToast(
        nouvelleAlerte.message, 
        isCritique ? 'error' : 'warning',
        {
          actionLabel: 'Voir les alertes',
          onAction: () => {
            setToast(null);
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
          }
        }
      );
    }
  }, [messageWS]);

  // ================================================================
  // Acquittement (AXE 3)
  // ================================================================
  const handleAcquitterAlerte = async (id) => {
    if (acquittementEnCours[id]) return;
    setAcquittementEnCours(prev => ({ ...prev, [id]: true }));
    try {
      await resoudreAlerteAPI(id);
      setAlertes(prev => prev.filter(a => a.id !== id));
      showToast("Alerte acquittée avec succès", "success");
    } catch (err) {
      showToast("Erreur lors de l'acquittement", "error");
    } finally {
      setAcquittementEnCours(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // ================================================================
  // Autres actions
  // ================================================================
  const handleScenarioChange = async (e) => {
    const newScenario = e.target.value;
    const oldScenario = reservoir.scenario_actuel;
    setReservoir((prev) => ({ ...prev, scenario_actuel: newScenario }));
    
    try {
      await api.patch(`reservoirs/${reservoir.id}/`, { scenario_actuel: newScenario });
      showToast(`Scénario modifié : ${e.target.options[e.target.selectedIndex].text}`);
    } catch (err) {
      showToast("Erreur lors du changement de scénario", "error");
      setReservoir((prev) => ({ ...prev, scenario_actuel: oldScenario }));
    }
  };

  const handleCreateReservoir = async (e) => {
    e.preventDefault();
    try {
      await creerReservoirAPI(formReservoir);
      setFormReservoir(initialReservoirForm); setModalReservoir(false);
      await chargerReservoirs();
      showToast("Réservoir créé avec succès !");
    } catch (err) {
      showToast("Erreur de création : " + err.message, "error");
    }
  };

  const handleCreateCapteur = async (e) => {
    e.preventDefault();
    try {
      await ajouterCapteurAPI({ ...formCapteur, reservoir: reservoir.id });
      setFormCapteur({ nom: '', type: 'niveau' }); setModalCapteur(false);
      await chargerCapteurs();
      showToast("Capteur ajouté avec succès !");
    } catch (err) {
      showToast("Erreur lors de l'ajout du capteur", "error");
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (confirmDelete.type === 'reservoir') {
        await supprimerReservoirAPI(confirmDelete.id);
        await chargerReservoirs();
      } else {
        await supprimerCapteurAPI(confirmDelete.id);
        await chargerCapteurs();
      }
      showToast(`${confirmDelete.type === 'reservoir' ? 'Réservoir' : 'Capteur'} supprimé.`);
    } catch (err) {
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setConfirmDelete({ isOpen: false, type: '', id: null, nom: '' });
    }
  };

  if (chargement) return <div style={{ padding: '3rem', textAlign: 'center' }}>Chargement...</div>;

  const couleurEau = reservoir?.niveauActuel <= 10 || reservoir?.niveauActuel >= 95 ? '#ef4444' : reservoir?.niveauActuel <= 25 || reservoir?.niveauActuel >= 90 ? '#f97316' : '#0284c7';
  const capMax = parseFloat(reservoir?.capacite_max_litres) || 0;
  const volumeLitresActuel = ((capMax * (reservoir?.niveauActuel || 0)) / 100).toFixed(0);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
      
      {/* Animations CSS */}
      <style>{`
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .alerte-critique-pulse { animation: pulse-red 2s infinite; }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* TOAST (AXE 4) */}
      {toast && (
        <div style={{ 
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100, padding: '1rem 1.5rem', borderRadius: '12px', color: '#fff', 
          backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f97316' : '#10b981', 
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '350px', animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
            {toast.type === 'error' ? '🚨 Alerte Critique' : toast.type === 'warning' ? '⚠️ Avertissement' : '✅ Succès'}
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{toast.message}</div>
          
          {toast.details?.actionLabel && (
            <button 
              onClick={toast.details.onAction}
              style={{ marginTop: '0.5rem', padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', alignSelf: 'flex-start' }}
            >
              {toast.details.actionLabel}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.75rem', fontWeight: 'bold' }}>{reservoir ? reservoir.nom : 'Aucun réservoir'}</h1>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>ID: {reservoir?.id || '-'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <select value={reservoirSelectionneId || ''} onChange={(e) => { const id = parseInt(e.target.value); setReservoirSelectionneId(id); initialiserReservoir(listeReservoirs.find(r => r.id === id)); }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
            {listeReservoirs.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>

          {reservoir && (
            <select value={reservoir.scenario_actuel || 'normal'} onChange={handleScenarioChange} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '2px solid #0284c7', fontWeight: 'bold' }}>
              <option value="normal">Normal (Fluctuation)</option>
              <option value="remplissage">Remplissage (30s)</option>
              <option value="vidage">Vidage (30s)</option>
            </select>
          )}

          <button onClick={() => setModalReservoir(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600' }}>+ Réservoir</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: estConnecte ? '#16a34a' : '#dc2626' }} />
            <span style={{ fontSize: '0.875rem', color: '#475569' }}>{estConnecte ? 'En direct' : 'Déconnecté'}</span>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* BANDEAU DES ALERTES (AXES 1, 2, 3)                               */}
      {/* ================================================================ */}
      {alertes.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: 'bold' }}>
            Alertes actives ({alertes.length})
          </h3>
          
          {alertes.map((a) => {
            const style = getAlerteStyle(a.gravite);
            
            // ✅ Résolution du nom du capteur (fallback : lookup dans capteurs chargés)
            const nomCapteur = a.capteur_nom 
              || capteurs.find(c => c.code === a.capteur_code || c.id === a.capteur)?.nom 
              || a.capteur_code 
              || 'Capteur';
            
            // ✅ Formatage de la date (fallback sur date_declenchement)
            let heure = '';
            try {
              if (a.date_declenchement) {
                heure = new Date(a.date_declenchement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              }
            } catch (e) {}
            
            const enCours = acquittementEnCours[a.id];

            return (
              <div 
                key={a.id} 
                className={style.pulse ? 'alerte-critique-pulse' : ''}
                style={{
                  backgroundColor: style.bg,
                  borderLeft: `5px solid ${style.border}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  opacity: enCours ? 0.6 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{style.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    {/* AXE 2 : En-tête contextuel */}
                    <div style={{ color: style.text, fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                      {getTypeLabel(a.type || a.type_alerte)} — <span style={{ textDecoration: 'underline' }}>{nomCapteur}</span>
                    </div>
                    {/* AXE 2 : Message + valeurs */}
                    <div style={{ color: '#475569', fontSize: '0.875rem' }}>
                      {a.message}
                      {a.valeur_mesure != null && a.seuil_franchi != null && (
                        <span style={{ fontWeight: 'bold', color: style.text }}>
                          {" "}(Mesure: {Number(a.valeur_mesure).toFixed(1)} | Seuil: {Number(a.seuil_franchi).toFixed(1)})
                        </span>
                      )}
                    </div>
                    {/* AXE 2 : Timestamp */}
                    {heure && (
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        ⏱ Déclenchée à {heure}
                      </div>
                    )}
                  </div>
                </div>

                {/* AXE 3 : Bouton Acquitter */}
                <button 
                  onClick={() => handleAcquitterAlerte(a.id)}
                  disabled={enCours}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#fff',
                    color: style.text,
                    border: `1px solid ${style.border}`,
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: enCours ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    marginLeft: '0.75rem',
                    flexShrink: 0,
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => { if (!enCours) e.currentTarget.style.backgroundColor = style.bg; }}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  {enCours ? '⏳...' : '✔️ Acquitter'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {reservoir ? (
        <>
          <div style={styles.container}>
            <div style={styles.cardCuve}>
              <div style={styles.cuveOuter}>
                <div style={{ ...styles.eauFluid, height: `${reservoir.niveauActuel || 0}%`, backgroundColor: couleurEau }}><div style={styles.vague} /></div>
                <span style={styles.pourcentageTexte}>{reservoir.niveauActuel}%</span>
              </div>
              <p style={{ marginTop: '1.25rem', fontWeight: 'bold', color: '#334155', fontSize: '1.1rem' }}>{Number(volumeLitresActuel).toLocaleString()} / {capMax.toLocaleString()} L</p>
            </div>

            <div style={styles.cardInfos}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>Détails du Réservoir</h3>
                <button onClick={() => setConfirmDelete({ isOpen: true, type: 'reservoir', id: reservoir.id, nom: reservoir.nom })} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Supprimer</button>
              </div>
              <ul style={styles.listeSpec}>
                <li><strong>Débit :</strong> {reservoir.debitActuel} L/min</li>
                <li><strong>Localisation :</strong> {reservoir.localisation || 'N/A'}</li>
                <li><strong>Capacité :</strong> {reservoir.capacite_max_litres} L</li>
                <li><strong>Hauteur :</strong> {reservoir.hauteur_max_cm} cm</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Capteurs Connectés ({capteurs.length})</h3>
              <button onClick={() => setModalCapteur(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: '#fff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600' }}>+ Ajouter un Capteur</button>
            </div>
            
            {capteurs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>Aucun capteur sur ce réservoir.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                {capteurs.map(c => (
                  <div key={c.id} style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{c.nom}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{c.type}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: c.en_ligne ? '#dcfce7' : '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '99px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c.en_ligne ? '#16a34a' : '#dc2626' }}></span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: c.en_ligne ? '#166534' : '#991b1b' }}>{c.en_ligne ? 'EN LIGNE' : 'HORS LIGNE'}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.25rem', fontWeight: 'bold', color: '#0284c7' }}>
                      {c.derniere_valeur !== undefined && c.derniere_valeur !== null ? `${c.derniere_valeur.toFixed(1)} ${c.unite}` : '—'}
                    </div>
                    <button onClick={() => setConfirmDelete({ isOpen: true, type: 'capteur', id: c.id, nom: c.nom })} style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>Aucun réservoir trouvé.</div>
      )}

      {/* MODAL : CRÉATION RÉSERVOIR */}
      {modalReservoir && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: '#0f172a' }}>Ajouter un Réservoir</h2>
            <form onSubmit={handleCreateReservoir} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}><label style={styles.label}>Nom (Unique) *</label><input style={styles.input} type="text" name="nom" value={formReservoir.nom} required onChange={e => setFormReservoir({...formReservoir, nom: e.target.value})} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={styles.label}>Description</label><input style={styles.input} type="text" name="description" value={formReservoir.description} onChange={e => setFormReservoir({...formReservoir, description: e.target.value})} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={styles.label}>Localisation</label><input style={styles.input} type="text" name="localisation" value={formReservoir.localisation} onChange={e => setFormReservoir({...formReservoir, localisation: e.target.value})} /></div>
              <div><label style={styles.label}>Latitude</label><input style={styles.input} type="number" step="any" value={formReservoir.latitude} onChange={e => setFormReservoir({...formReservoir, latitude: e.target.value})} /></div>
              <div><label style={styles.label}>Longitude</label><input style={styles.input} type="number" step="any" value={formReservoir.longitude} onChange={e => setFormReservoir({...formReservoir, longitude: e.target.value})} /></div>
              <div><label style={styles.label}>Capacité Max (L) *</label><input style={styles.input} type="number" step="0.1" value={formReservoir.capacite_max_litres} required onChange={e => setFormReservoir({...formReservoir, capacite_max_litres: e.target.value})} /></div>
              <div><label style={styles.label}>Hauteur Max (cm) *</label><input style={styles.input} type="number" step="0.1" value={formReservoir.hauteur_max_cm} required onChange={e => setFormReservoir({...formReservoir, hauteur_max_cm: e.target.value})} /></div>
              <div><label style={styles.label}>Seuil Critique Bas (%) *</label><input style={styles.input} type="number" step="0.1" value={formReservoir.seuil_critique_bas} required onChange={e => setFormReservoir({...formReservoir, seuil_critique_bas: e.target.value})} /></div>
              <div><label style={styles.label}>Seuil Alerte Bas (%) *</label><input style={styles.input} type="number" step="0.1" value={formReservoir.seuil_alerte_bas} required onChange={e => setFormReservoir({...formReservoir, seuil_alerte_bas: e.target.value})} /></div>
              <div><label style={styles.label}>Seuil Alerte Haut (%) *</label><input style={styles.input} type="number" step="0.1" value={formReservoir.seuil_alerte_haut} required onChange={e => setFormReservoir({...formReservoir, seuil_alerte_haut: e.target.value})} /></div>
              <div><label style={styles.label}>Seuil Critique Haut (%) *</label><input style={styles.input} type="number" step="0.1" value={formReservoir.seuil_critique_haut} required onChange={e => setFormReservoir({...formReservoir, seuil_critique_haut: e.target.value})} /></div>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setModalReservoir(false)} style={styles.btnSecondary}>Annuler</button>
                <button type="submit" style={styles.btnPrimary}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : AJOUT CAPTEUR */}
      {modalCapteur && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0, color: '#0f172a' }}>Ajouter un Capteur</h2>
            <form onSubmit={handleCreateCapteur} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={styles.label}>Nom du capteur *</label><input style={styles.input} type="text" value={formCapteur.nom} required onChange={e => setFormCapteur({...formCapteur, nom: e.target.value})} placeholder="Ex: Sonde A" /></div>
              <div><label style={styles.label}>Type *</label>
                <select style={styles.input} value={formCapteur.type} onChange={e => setFormCapteur({...formCapteur, type: e.target.value})}>
                  <option value="niveau">Niveau (cm)</option>
                  <option value="debit">Débit (L/min)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setModalCapteur(false)} style={styles.btnSecondary}>Annuler</button>
                <button type="submit" style={styles.btnPrimary}>Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : CONFIRMATION DE SUPPRESSION */}
      {confirmDelete.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ marginTop: 0, color: '#ef4444' }}>⚠️ Confirmation</h2>
            <p style={{ color: '#334155', marginBottom: '1.5rem' }}>Supprimer le {confirmDelete.type} <strong>"{confirmDelete.nom}"</strong> ?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button type="button" onClick={() => setConfirmDelete({ isOpen: false, type: '', id: null, nom: '' })} style={styles.btnSecondary}>Annuler</button>
              <button type="button" onClick={handleConfirmDelete} style={{ ...styles.btnPrimary, backgroundColor: '#ef4444' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
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
  listeSpec: { listStyle: 'none', padding: 0, margin: 0, lineHeight: '2rem', color: '#475569', fontSize: '0.9rem' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' },
  modalContent: { backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#334155', marginBottom: '0.25rem' },
  input: { width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' },
  btnPrimary: { padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600' },
  btnSecondary: { padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '0.5rem', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600' },
};

export default Reservoirs;
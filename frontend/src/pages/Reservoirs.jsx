import React, { useState, useEffect, useRef } from 'react';
import GraphiqueDebit from '../components/GraphiqueDebit';

const MOCK_INITIAL = [
  {
    id: 1,
    nom: 'Réservoir Principal',
    code: 'RES-001',
    description: 'Cuve de stockage haute pression',
    localisation: 'Kinshasa - Gombe',
    capacite_max_litres: 10000,
    hauteur_max_cm: 300,
    seuil_critique_bas: 10,
    seuil_alerte_bas: 25,
    seuil_alerte_haut: 90,
    seuil_critique_haut: 95,
    statut: 'actif',
    niveauActuel: 45,
    debitActuel: 125,
  },
  {
    id: 2,
    nom: 'Réservoir Secondaire',
    code: 'RES-002',
    description: 'Cuve de distribution de secours',
    localisation: 'Kinshasa - Limete',
    capacite_max_litres: 5000,
    hauteur_max_cm: 200,
    seuil_critique_bas: 15,
    seuil_alerte_bas: 30,
    seuil_alerte_haut: 85,
    seuil_critique_haut: 92,
    statut: 'actif',
    niveauActuel: 70,
    debitActuel: 80,
  },
];

const enregistrerAlerteSimulee = (alerte) => {
  const existantes = JSON.parse(localStorage.getItem('securewater_alertes') || '[]');
  const derniere = existantes[0];
  if (derniere && derniere.message === alerte.message && Date.now() - new Date(derniere.date_creation).getTime() < 3000) {
    return;
  }
  const miseAJour = [alerte, ...existantes].slice(0, 50);
  localStorage.setItem('securewater_alertes', JSON.stringify(miseAJour));
  window.dispatchEvent(new CustomEvent('securewater_nouvelle_alerte', { detail: alerte }));
};

const Reservoirs = () => {
  const [listeReservoirs] = useState(MOCK_INITIAL);
  const [reservoirSelectionneId, setReservoirSelectionneId] = useState(1);
  const [reservoir, setReservoir] = useState(MOCK_INITIAL[0]);
  const [donneesDebit, setDonneesDebit] = useState([]);

  const directionRef = useRef(1);

  // MOTEUR DE SIMULATION (Mise à jour toutes les 0.5s)
  useEffect(() => {
    const interval = setInterval(() => {
      setReservoir((prev) => {
        if (!prev) return prev;

        const sCritBas = parseFloat(prev.seuil_critique_bas || 10);
        const sCritHaut = parseFloat(prev.seuil_critique_haut || 95);
        const sAltBas = parseFloat(prev.seuil_alerte_bas || 25);
        const sAltHaut = parseFloat(prev.seuil_alerte_haut || 90);

        let nouveauNiveau = prev.niveauActuel + directionRef.current * 1.5;
        let nouveauDebit = Math.round((120 + Math.sin(Date.now() / 1000) * 25 + Math.random() * 5) * 10) / 10;

        if (nouveauNiveau >= 98) {
          directionRef.current = -1;
          nouveauNiveau = 98;
        } else if (nouveauNiveau <= 5) {
          directionRef.current = 1;
          nouveauNiveau = 5;
        }

        nouveauNiveau = Math.round(nouveauNiveau * 10) / 10;

        // Génération des alertes lors des franchissements de seuils
        if (nouveauNiveau >= sCritHaut) {
          enregistrerAlerteSimulee({
            id: Date.now(),
            type_alerte: 'Seuil Critique Haut Dépassé',
            message: `Niveau critique (${nouveauNiveau}%) atteint dans le ${prev.nom}. Risque de débordement !`,
            gravite: 'critique',
            resolu: false,
            date_creation: new Date().toISOString(),
            reservoir_nom: prev.nom,
          });
        } else if (nouveauNiveau <= sCritBas) {
          enregistrerAlerteSimulee({
            id: Date.now(),
            type_alerte: 'Seuil Critique Bas Dépassé',
            message: `Niveau critique bas (${nouveauNiveau}%) dans le ${prev.nom}. Pénurie imminente !`,
            gravite: 'critique',
            resolu: false,
            date_creation: new Date().toISOString(),
            reservoir_nom: prev.nom,
          });
        } else if (nouveauNiveau >= sAltHaut) {
          enregistrerAlerteSimulee({
            id: Date.now(),
            type_alerte: 'Avertissement Niveau Haut',
            message: `Niveau d'eau élevé (${nouveauNiveau}%) dans le ${prev.nom}.`,
            gravite: 'avertissement',
            resolu: false,
            date_creation: new Date().toISOString(),
            reservoir_nom: prev.nom,
          });
        } else if (nouveauNiveau <= sAltBas) {
          enregistrerAlerteSimulee({
            id: Date.now(),
            type_alerte: 'Avertissement Niveau Bas',
            message: `Niveau d'eau faible (${nouveauNiveau}%) dans le ${prev.nom}.`,
            gravite: 'avertissement',
            resolu: false,
            date_creation: new Date().toISOString(),
            reservoir_nom: prev.nom,
          });
        }

        const tempsActuel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setDonneesDebit((old) => [...old.slice(-14), { temps: tempsActuel, debit: nouveauDebit }]);

        return { ...prev, niveauActuel: nouveauNiveau, debitActuel: nouveauDebit };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [reservoirSelectionneId]);

  const handleSelectReservoir = (e) => {
    const id = parseInt(e.target.value, 10);
    setReservoirSelectionneId(id);
    const cible = listeReservoirs.find((r) => r.id === id);
    if (cible) setReservoir(cible);
  };

  const obtenirCouleurSeuil = () => {
    if (!reservoir) return '#0284c7';
    const niv = reservoir.niveauActuel;
    const sCritBas = parseFloat(reservoir.seuil_critique_bas || 10);
    const sCritHaut = parseFloat(reservoir.seuil_critique_haut || 95);
    const sAltBas = parseFloat(reservoir.seuil_alerte_bas || 25);
    const sAltHaut = parseFloat(reservoir.seuil_alerte_haut || 90);

    if (niv <= sCritBas || niv >= sCritHaut) return '#ef4444';
    if (niv <= sAltBas || niv >= sAltHaut) return '#f97316';
    return '#0284c7';
  };

  const capMax = parseFloat(reservoir?.capacite_max_litres) || 10000;
  const volumeLitresActuel = reservoir ? ((capMax * (reservoir.niveauActuel || 0)) / 100).toFixed(0) : 0;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.75rem', fontWeight: 'bold' }}>
            {reservoir ? reservoir.nom : 'Aucun réservoir'}
          </h1>
          <span style={{ fontSize: '0.875rem', color: '#64748b', fontFamily: 'monospace' }}>
            Code: {reservoir?.code || 'N/A'} | Simulation autonome (0.5s)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select
            value={reservoirSelectionneId}
            onChange={handleSelectReservoir}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
          >
            {listeReservoirs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom} ({r.code})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f0fdf4', padding: '0.5rem 0.75rem', borderRadius: '9999px', border: '1px solid #bbf7d0' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
            <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '600' }}>
              Simulateur actif (0.5s)
            </span>
          </div>
        </div>
      </div>

      {reservoir && (
        <div style={styles.container}>
          <div style={styles.cardCuve}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Niveau d'Eau (Simulation Temps Réel)</h3>
            <div style={styles.cuveOuter}>
              <div style={{ ...styles.eauFluid, height: `${reservoir.niveauActuel}%`, backgroundColor: obtenirCouleurSeuil() }}>
                <div style={styles.vague} />
              </div>
              <span style={styles.pourcentageTexte}>{reservoir.niveauActuel}%</span>
            </div>
            <p style={{ marginTop: '1.25rem', fontWeight: 'bold', color: '#334155', fontSize: '1.1rem' }}>
              {Number(volumeLitresActuel).toLocaleString()} / {capMax.toLocaleString()} L
            </p>
          </div>

          <div style={styles.cardInfos}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Détails & Seuils de Tolérance</h3>
            <ul style={styles.listeSpec}>
              <li><strong>Débit instantané :</strong> <span style={{ color: '#0284c7', fontWeight: 'bold' }}>{reservoir.debitActuel} L/min</span></li>
              <li><strong>Localisation :</strong> {reservoir.localisation}</li>
              <li><strong>Hauteur Maximale :</strong> {reservoir.hauteur_max_cm} cm</li>
              <li><strong>Seuils d'Alerte (Bas / Haut) :</strong> {reservoir.seuil_alerte_bas}% / {reservoir.seuil_alerte_haut}%</li>
              <li><strong>Seuils Critiques (Bas / Haut) :</strong> {reservoir.seuil_critique_bas}% / {reservoir.seuil_critique_haut}%</li>
              <li><strong>Statut :</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{reservoir.statut}</span></li>
            </ul>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>Flux de Débit Temps Réel (0.5s)</h3>
        <GraphiqueDebit donnees={donneesDebit} />
      </div>

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
  eauFluid: { position: 'absolute', bottom: 0, left: 0, right: 0, transition: 'height 0.4s ease-in-out, background-color 0.3s ease' },
  vague: { position: 'absolute', top: '-10px', left: 0, width: '200%', height: '20px', background: 'rgba(255, 255, 255, 0.3)', borderRadius: '40%', animation: 'onduler 2s infinite linear' },
  pourcentageTexte: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold', fontSize: '1.5rem', color: '#0f172a', zIndex: 2, textShadow: '0px 0px 4px rgba(255,255,255,0.9)' },
  listeSpec: { listStyle: 'none', padding: 0, margin: 0, lineHeight: '2.1rem', color: '#475569', fontSize: '0.9rem' },
};

export default Reservoirs;

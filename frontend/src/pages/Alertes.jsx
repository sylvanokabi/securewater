import React, { useEffect, useState } from 'react';
import alerteService from '../services/alerteService';
import CarteAlerte from '../components/CarteAlerte';

const Alertes = () => {
  const [alertes, setAlertes] = useState([]);
  const [chargement, setChargement] = useState(true);

  const chargerAlertes = async () => {
    try {
      const data = await alerteService.getAlertes();
      setAlertes(data);
    } catch (erreur) {
      console.error("Erreur lors du chargement des alertes :", erreur);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerAlertes();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Journal des Alertes</h1>
      <p>Page de gestion et de suivi des alertes et anomalies du réseau.</p>

      {chargement ? (
        <p>Chargement des alertes en cours...</p>
      ) : alertes.length === 0 ? (
        <p>Aucune alerte à afficher.</p>
      ) : (
        <div style={{ marginTop: '20px' }}>
          {alertes.map((alerte) => (
            <CarteAlerte
              key={alerte.id}
              titre={alerte.titre || alerte.type}
              message={alerte.message}
              niveauUrgence={alerte.niveau || 'AVERTISSEMENT'}
              horodatage={alerte.date_creation || alerte.created_at}
              acquittee={alerte.acquittee}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Alertes;
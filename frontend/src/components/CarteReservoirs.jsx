import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Correction des icônes par défaut de Leaflet sous Webpack/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const CarteReservoirs = ({ reservoirs }) => {
  // Centre initial de la carte (ex: Kinshasa)
  const positionCentre = [-4.325, 15.322];

  return (
    <div style={styles.card}>
      <h3 style={styles.titre}>Géolocalisation des Réservoirs</h3>
      <div style={{ height: '350px', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
        <MapContainer center={positionCentre} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {reservoirs.map((res) => (
            <Marker key={res.id} position={res.coords}>
              <Popup>
                <strong>{res.nom}</strong> <br />
                Niveau : <span style={{ fontWeight: 'bold', color: res.niveau < 20 ? 'red' : 'green' }}>{res.niveau}%</span> <br />
                Capacité : {res.capacite.toLocaleString()} L <br />
                Emplacement : {res.localisation}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.25rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
    marginTop: '2rem',
  },
  titre: {
    margin: '0 0 1rem 0',
    fontSize: '1.1rem',
    color: '#1e293b',
  },
};

export default CarteReservoirs;
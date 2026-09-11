import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import TableauDeBord from './pages/TableauDeBord';
import Reservoirs from './pages/Reservoirs';
import Capteurs from './pages/Capteurs';
import Alertes from './pages/Alertes';

// Composants
import RouteProtegee from './components/RouteProtegee';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Layout global pour les pages authentifiées (Largeur 100% forcée)
const MainLayout = ({ children }) => {
  return (
    <div style={styles.appLayout}>
      <Sidebar />
      <div style={styles.contentWrapper}>
        <Navbar />
        <main style={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  );
};

const styles = {
  appLayout: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw', // Force l'occupation de TOUTE la largeur de l'écran
    backgroundColor: '#f4f6f8',
    overflowX: 'hidden',
  },
  contentWrapper: {
    flex: 1, // Prends tout l'espace disponible à droite du Sidebar
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0, // Empêche les éléments enfants de dépasser/réduire le conteneur
  },
  mainContent: {
    padding: '2rem',
    flex: 1,
    backgroundColor: '#f4f6f8',
    boxSizing: 'border-box',
  },
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Routes Publiques */}
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />

        {/* Routes Protégées (Authentification requise) */}
        <Route element={<RouteProtegee />}>
          <Route
            path="/"
            element={
              <MainLayout>
                <TableauDeBord />
              </MainLayout>
            }
          />
          <Route
            path="/reservoirs"
            element={
              <MainLayout>
                <Reservoirs />
              </MainLayout>
            }
          />
          <Route
            path="/capteurs"
            element={
              <MainLayout>
                <Capteurs />
              </MainLayout>
            }
          />
          <Route
            path="/alertes"
            element={
              <MainLayout>
                <Alertes />
              </MainLayout>
            }
          />
        </Route>

        {/* Redirection en cas de route inconnue */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

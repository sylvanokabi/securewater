import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
//import TableauDeBord from './pages/TableauDeBord';
//import Reservoirs from './pages/Reservoirs';
//import Capteurs from './pages/Capteurs';
//import Alertes from './pages/Alertes';

// Composants
import RouteProtegee from './components/RouteProtegee';
//import Navbar from './components/Navbar';
//import Sidebar from './components/Sidebar';

// Layout global pour les pages authentifiées
const MainLayout = ({ children }) => {
  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ padding: '20px', flex: 1, backgroundColor: '#f4f6f8' }}>
          {children}
        </main>
      </div>
    </div>
  );
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

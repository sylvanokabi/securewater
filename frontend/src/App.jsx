import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import TableauDeBord from './pages/TableauDeBord';
import Reservoirs from './pages/Reservoirs';
import Capteurs from './pages/Capteurs';
import Alertes from './pages/Alertes';
// import Simulation from './pages/Simulation'; // ❌ SUPPRIMÉ
import SecuriteMQTT from './pages/SecuriteMQTT';
import SecuriteCertificats from './pages/SecuriteCertificats';
import SecuriteJournal from './pages/SecuriteJournal';

// Composants
import RouteProtegee from './components/RouteProtegee';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

const MainLayout = ({ children }) => (
  <div style={styles.appLayout}>
    <Sidebar />
    <div style={styles.contentWrapper}>
      <Navbar />
      <main style={styles.mainContent}>{children}</main>
    </div>
  </div>
);

const styles = {
  appLayout: { display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: '#f4f6f8', overflowX: 'hidden' },
  contentWrapper: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  mainContent: { padding: '2rem', flex: 1, backgroundColor: '#f4f6f8', boxSizing: 'border-box' },
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />

        <Route element={<RouteProtegee />}>
          <Route path="/" element={<MainLayout><TableauDeBord /></MainLayout>} />
          <Route path="/reservoirs" element={<MainLayout><Reservoirs /></MainLayout>} />
          <Route path="/capteurs" element={<MainLayout><Capteurs /></MainLayout>} />
          <Route path="/alertes" element={<MainLayout><Alertes /></MainLayout>} />
          {/* <Route path="/simulation" element={<MainLayout><Simulation /></MainLayout>} /> ❌ SUPPRIMÉ */}
          <Route path="/securite/mqtt" element={<MainLayout><SecuriteMQTT /></MainLayout>} />
          <Route path="/securite/certificats" element={<MainLayout><SecuriteCertificats /></MainLayout>} />
          <Route path="/securite/journal" element={<MainLayout><SecuriteJournal /></MainLayout>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
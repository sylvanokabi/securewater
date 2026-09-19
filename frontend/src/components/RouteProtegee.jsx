import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const RouteProtegee = () => {
  const estAuthentifie = true; // Simulé pour l'instant

  if (!estAuthentifie) {
    return <Navigate to="/connexion" replace />;
  }

  // ⚠️ Aucun layout ici — c'est MainLayout (dans App.jsx) qui gère
  //     le Sidebar, le Navbar et le contenu.
  return <Outlet />;
};

export default RouteProtegee;
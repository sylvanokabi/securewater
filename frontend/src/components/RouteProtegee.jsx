

//import React from 'react';
//import { Navigate, Outlet } from 'react-router-dom';

//const RouteProtegee = () => {
//  const token = localStorage.getItem('access_token');

  // Si le token est présent, on affiche les pages enfants, sinon redirection
//  return token ? <Outlet /> : <Navigate to="/connexion" replace />;
//};

//export default RouteProtegee;




import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const RouteProtegee = () => {
  const token = localStorage.getItem('access_token');

  // Si le jeton (même fictif) existe, afficher les pages privées avec MainLayout
  return token ? <Outlet /> : <Navigate to="/connexion" replace />;
};

export default RouteProtegee;
import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const liens = [
    { path: '/tableau-de-bord', label: 'Tableau de bord' },
    { path: '/reservoirs', label: 'Réservoirs' },
    { path: '/capteurs', label: 'Capteurs' },
    { path: '/alertes', label: 'Alertes' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-6 flex flex-col justify-between">
      <div>
        <div className="mb-8">
          <h1 className="text-xl font-bold text-sky-400">SecureWater</h1>
          <p className="text-xs text-slate-400">IoT Monitoring Platform</p>
        </div>

        <nav className="flex flex-col gap-2">
          {liens.map((lien) => (
            <NavLink
              key={lien.path}
              to={lien.path}
              className={({ isActive }) =>
                `px-4 py-3 rounded-lg font-medium transition-colors text-sm ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {lien.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
        v1.0.0 &bull; SecureWater IoT
      </div>
    </aside>
  );
};

export default Sidebar;

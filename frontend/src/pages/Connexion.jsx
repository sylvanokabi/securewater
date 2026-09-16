import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { connexionAPI } from '../services/auth';

const Connexion = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);

    try {
      await connexionAPI(email, password);
      navigate('/');
    } catch (err) {
      setErreur(err.message || 'Identifiants invalides.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">SecureWater</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connectez-vous à votre espace de supervision
          </p>
        </div>

        {erreur && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {erreur}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Adresse Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-slate-800"
              placeholder="Ex: vano@gmail.com"
              required
              disabled={chargement}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-slate-800"
              placeholder="••••••••"
              required
              disabled={chargement}
            />
          </div>

          <button
            type="submit"
            disabled={chargement}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {chargement ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connexion en cours...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Vous n'avez pas de compte ?{' '}
          <Link to="/inscription" className="text-sky-600 hover:text-sky-700 font-semibold">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Connexion;

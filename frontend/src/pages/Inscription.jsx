import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { inscriptionAPI } from '../services/auth';

const Inscription = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [chargement, setChargement] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setSucces('');

    if (formData.password !== formData.confirmPassword) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }

    setChargement(true);

    try {
      // Transformation des données pour correspondre aux clés attendues par le Serializer Django
      const dataAEnvoyer = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword, // Transmission de la clé obligatoire demandée par le backend
      };

      await inscriptionAPI(dataAEnvoyer);
      
      setSucces('Compte créé avec succès ! Redirection vers la page de connexion...');
      
      setTimeout(() => {
        navigate('/connexion');
      }, 2000);
    } catch (err) {
      setErreur(err.message || 'Une erreur est survenue lors de l\'inscription.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">SecureWater</h1>
          <p className="text-sm text-slate-500 mt-1">Créer un nouveau compte utilisateur</p>
        </div>

        {erreur && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {erreur}
          </div>
        )}

        {succes && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm rounded-lg">
            {succes}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom d'utilisateur
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-slate-800"
              placeholder="Ex: joel_doe"
              required
              disabled={chargement}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Adresse Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-slate-800"
              placeholder="Ex: utilisateur@domain.com"
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
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all text-slate-800"
              placeholder="••••••••"
              required
              disabled={chargement}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
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
                Création du compte...
              </>
            ) : (
              "S'inscrire"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Vous avez déjà un compte ?{' '}
          <Link to="/connexion" className="text-sky-600 hover:text-sky-700 font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Inscription;

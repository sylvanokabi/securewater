import { useEffect, useRef, useState } from 'react';

// Récupération de la base WebSocket depuis le .env
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';

export const useWebSocket = (pathOrUrl) => {
  const [data, setData] = useState(null);
  const [estConnecte, setEstConnecte] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    if (!pathOrUrl) return;

    // Si on passe un chemin relatif ("/ws/telemetrie/"), on ajoute le domaine de base
    // Si on passe déjà une URL complète ("wss://..."), on la garde telle quelle
    const fullUrl = pathOrUrl.startsWith('/') 
      ? `${WS_BASE_URL}${pathOrUrl}` 
      : pathOrUrl;

    const token = localStorage.getItem('access_token');
    const wsUrl = token ? `${fullUrl}?token=${token}` : fullUrl;

    // Définition de l'instance WebSocket
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('Connexion WebSocket établie avec le serveur.');
      setEstConnecte(true);
    };

    socket.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (err) {
        console.error('Erreur lors du parsing des données WS :', err);
      }
    };

    socket.onclose = (e) => {
      console.log(`Connexion WebSocket fermée. Code: ${e.code}`);
      setEstConnecte(false);
    };

    socket.onerror = (error) => {
      console.error('Erreur WebSocket :', error);
    };

    // Nettoyage lors du démontage du composant
    return () => {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [pathOrUrl]);

  return { data, estConnecte };
};
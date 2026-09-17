import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [estConnecte, setEstConnecte] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    // Ne pas tenter de connexion si l'URL est indéfinie
    if (!url) return;

    const token = localStorage.getItem('access_token');
    const wsUrl = token ? `${url}?token=${token}` : url;

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

    // Nettoyage lors du démonte du composant
    return () => {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [url]);

  return { data, estConnecte };
};

import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [estConnecte, setEstConnecte] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const wsUrl = token ? `${url}?token=${token}` : url;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('Connexion WebSocket établie avec le serveur.');
      setEstConnecte(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (err) {
        console.error('Erreur lors du parsing des données WS :', err);
      }
    };

    ws.current.onclose = () => {
      console.log('Connexion WebSocket fermée.');
      setEstConnecte(false);
    };

    ws.current.onerror = (error) => {
      console.error('Erreur WebSocket :', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  return { data, estConnecte };
};

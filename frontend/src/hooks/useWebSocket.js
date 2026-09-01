import { useState, useEffect, useRef } from 'react';

export const useWebSocket = () => {
  const [connectionStatus, setConnectionStatus] = useState('OFFLINE'); // LIVE, RECONNECTING, OFFLINE
  const [lastMessage, setLastMessage] = useState(null);
  const [eventFeed, setEventFeed] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const connectWebSocket = () => {
      const token = localStorage.getItem('cat_fleet_token');
      if (!token) {
        setConnectionStatus('OFFLINE');
        return;
      }

      setConnectionStatus('RECONNECTING');
      const envWsUrl = import.meta.env.VITE_WS_URL;
      let baseWsUrl = envWsUrl;
      if (!baseWsUrl) {
        const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
        const wsProtocol = (window.location.protocol === 'https:' || apiUrl.startsWith('https')) ? 'wss:' : 'ws:';
        baseWsUrl = apiUrl.replace(/^https?:/, wsProtocol);
      }
      baseWsUrl = baseWsUrl.replace(/\/$/, '');
      const wsUrl = `${baseWsUrl}/ws/telemetry?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          setConnectionStatus('LIVE');
        }
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (data.type === 'TELEMETRY_UPDATE' && data.event_message) {
            setEventFeed((prev) => [
              {
                id: Date.now() + Math.random(),
                timestamp: new Date().toLocaleTimeString(),
                equipment_id: data.equipment_id,
                message: data.event_message,
                status: data.status
              },
              ...prev.slice(0, 24) // Retain last 25 events
            ]);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onerror = () => {
        if (isMounted) {
          setConnectionStatus('OFFLINE');
        }
      };

      ws.onclose = (e) => {
        if (!isMounted) return;
        setConnectionStatus('OFFLINE');
        // Auto-reconnect after 3 seconds if unmounted cleanly
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted && localStorage.getItem('cat_fleet_token')) {
            connectWebSocket();
          }
        }, 3000);
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connectionStatus, lastMessage, eventFeed };
};

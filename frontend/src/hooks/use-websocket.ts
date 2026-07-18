"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  event_type?: string;
  message?: string;
  type?: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onNotification?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

const HEARTBEAT_INTERVAL = 30000;
const PING_MESSAGE = JSON.stringify({ type: "ping" });
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(userId: string | null, options: UseWebSocketOptions = {}) {
  const { onNotification, onError } = options;
  const ws = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isUnmounted = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  const onNotificationRef = useRef(onNotification);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onNotificationRef.current = onNotification;
    onErrorRef.current = onError;
  });

  const clearTimers = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    heartbeatInterval.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(PING_MESSAGE);
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const connect = useCallback(() => {
    if (!userId || isUnmounted.current) return;

    if (ws.current) {
      ws.current.close(1000, "Reconnecting");
      ws.current = null;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost/ws';
    const url = `${wsUrl}/notifications/${userId}`;

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        if (isUnmounted.current) {
          ws.current?.close(1000, "Unmounted");
          return;
        }
        console.log('[WS] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        startHeartbeat();
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          if (data.type === 'pong') return;
          console.log('[WS] Message:', data);
          onNotificationRef.current?.(data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.current.onclose = (event) => {
        console.log(`[WS] Disconnected code=${event.code} reason="${event.reason}"`);
        clearTimers();
        setIsConnected(false);
        ws.current = null;

        if (isUnmounted.current) return;
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log('[WS] Max reconnect attempts reached');
          return;
        }

        reconnectAttempts.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), MAX_RECONNECT_DELAY);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
        reconnectTimeout.current = setTimeout(() => connect(), delay);
      };

      ws.current.onerror = (error) => {
        console.error('[WS] Error:', error);
        onErrorRef.current?.(error);
      };
    } catch (e) {
      console.error('[WS] Create error:', e);
    }
  }, [userId, clearTimers, startHeartbeat]);

  useEffect(() => {
    isUnmounted.current = false;
    connect();

    return () => {
      isUnmounted.current = true;
      clearTimers();
      if (ws.current) {
        ws.current.close(1000, "Component unmounting");
        ws.current = null;
      }
    };
  }, [connect, clearTimers]);

  const sendMessage = useCallback((message: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(message);
    }
  }, []);

  return {
    isConnected,
    sendMessage,
  };
}

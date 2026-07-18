"use client";

import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "@/components/providers/toast-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAppStore } from "@/stores/app-store";

function WebSocketHandler() {
  const { user } = useAppStore();
  const { showToast } = useToast();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    const storage = localStorage.getItem('pubg-finder-storage');
    if (storage) {
      try {
        const parsed = JSON.parse(storage);
        if (parsed.state?.user) {
          setIsAuthChecked(true);
        } else {
          setIsAuthChecked(false);
        }
      } catch {
        setIsAuthChecked(false);
      }
    } else {
      setIsAuthChecked(false);
    }
  }, [user]);

  const userId = (isAuthChecked && user?.id) ? user.id : null;

  useWebSocket(userId, {
    onNotification: (message) => {
      console.log("Received notification:", message);
      switch (message.event_type) {
        case "match_invite_sent":
          showToast(`Вас пригласили в матч!`, "info");
          break;
        case "invite_accepted":
          showToast(`Игрок принял приглашение`, "success");
          break;
        case "match_left":
          showToast(`Игрок покинул матч`, "warning");
          break;
        case "match_completed":
          showToast(`Матч завершён`, "success");
          break;
        default:
          showToast(message.message || "Новое уведомление", "info");
      }
    },
    onError: (error) => console.error("WebSocket error:", error),
  });

  return null;
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WebSocketHandler />
      {children}
    </ToastProvider>
  );
}

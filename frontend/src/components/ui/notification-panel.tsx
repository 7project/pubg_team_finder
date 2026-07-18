"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import { Button, Badge } from "@/components/ui";
import { X, Bell, Check, CheckCheck, ExternalLink } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  matchId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationPanelProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationPanel({
  notifications,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "invite":
      case "match_invite_sent":
        return "📬";
      case "invite_accepted":
        return "✅";
      case "match_left":
        return "🚪";
      case "match_cancelled":
        return "❌";
      case "participant_removed":
        return "👋";
      case "confirmation_requested":
        return "📋";
      case "match_ready":
        return "🎮";
      default:
        return "🔔";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "invite":
      case "match_invite_sent":
        return "Приглашение";
      case "invite_accepted":
        return "Принято";
      case "match_left":
        return "Выход";
      case "match_cancelled":
        return "Отменено";
      case "participant_removed":
        return "Удалён";
      case "confirmation_requested":
        return "Подтверждение";
      case "match_ready":
        return "Готово";
      default:
        return type;
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 bg-background-dark border border-white/10 rounded-lg shadow-xl z-50"
    >
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Уведомления</span>
          {unreadCount > 0 && (
            <Badge variant="danger" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              className="h-8 w-8 p-0"
              title="Отметить все прочитанными"
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Нет уведомлений</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                !notification.read ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex gap-3">
                <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    {!notification.read && (
                      <button
                        onClick={() => onMarkRead(notification.id)}
                        className="shrink-0 text-gray-400 hover:text-primary"
                        title="Отметить прочитанной"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(notification.createdAt)}
                    </span>
                    {notification.matchId && (
                      <Link
                        href={`/matches/${notification.matchId}`}
                        onClick={onClose}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Открыть <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

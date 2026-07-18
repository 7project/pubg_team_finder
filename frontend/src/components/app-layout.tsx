"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore, Notification } from "@/stores/app-store";
import { Header } from "@/components/features/header";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/services/api";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isDarkMode,
    toggleDarkMode,
    setUser,
    user,
    logout,
    language,
    setLanguage,
    notifications,
    unreadCount,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    setNotifications,
    setUnreadCount,
  } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("access_token");
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        document.cookie = "pubg-auth-session=1; path=/; max-age=604800";
      } catch (e) {
        console.error("Failed to parse stored user:", e);
      }
    }

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.background = '#1A1A1A';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.background = '#F5F5F5';
    }
  }, [setUser, isDarkMode]);

  useEffect(() => {
    if (mounted) {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [isDarkMode, mounted]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await api.notifications.list({ pageSize: 20 });
      setNotifications(response.items);
      setUnreadCount(response.items.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [user?.id, setNotifications, setUnreadCount]);

  useEffect(() => {
    if (mounted && user?.id) {
      fetchNotifications();
    }
  }, [mounted, user?.id, fetchNotifications]);

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await api.notifications.markRead(notificationId);
      markNotificationRead(notificationId);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.notifications.markAllRead();
      markAllNotificationsRead();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const isAuthPage = pathname === "/" || pathname.startsWith("/api/");
  const showHeader = !isAuthPage && mounted;

  return (
    <div className="min-h-screen bg-background-dark">
      {showHeader && (
        <Header
          user={user || null}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleDarkMode}
          onLogout={logout}
          language={language}
          onLanguageChange={setLanguage}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        />
      )}
      {children}
    </div>
  );
}
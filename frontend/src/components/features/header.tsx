"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { t as translate, Language } from "@/lib/i18n";
import { Avatar, Button } from "@/components/ui";
import { NotificationPanel } from "@/components/ui/notification-panel";
import {
  Home,
  Users,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  MessageCircle,
  Bell,
  Search,
  Sword,
} from "lucide-react";
import type { Notification } from "@/stores/app-store";

interface HeaderProps {
  user?: {
    username: string;
    displayName?: string;
    pubgNickname?: string;
    avatarUrl?: string;
    discordUsername?: string;
  } | null;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout?: () => void;
  language?: "ru" | "en";
  onLanguageChange?: (lang: "ru" | "en") => void;
  notifications?: Notification[];
  unreadCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
}

export function Header({
  user,
  isDarkMode,
  onToggleTheme,
  onLogout,
  language = "ru",
  onLanguageChange,
  notifications = [],
  unreadCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}: HeaderProps) {
  const pathname = usePathname();
  const lang = language || "ru";
  const getLabel = (key: string) => translate(key as any, lang);
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { href: "/dashboard", icon: Home, label: getLabel("nav.home") },
    { href: "/groups", icon: Users, label: getLabel("nav.groups") },
    { href: "/matches", icon: Sword, label: getLabel("nav.matches") },
    { href: "/profile", icon: User, label: getLabel("nav.profile") },
  ];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background-dark/95 backdrop-blur-sm border-b border-white/5">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-primary font-bold text-xl">PUBG</span>
            <span className="text-white font-medium">Finder</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onToggleTheme}>
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLanguageChange?.(language === "ru" ? "en" : "ru")}
            className="text-sm font-medium min-w-[40px]"
          >
            {language === "ru" ? "EN" : "RU"}
          </Button>

          {user && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
              {showNotifications && (
                <NotificationPanel
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onClose={() => setShowNotifications(false)}
                  onMarkRead={onMarkNotificationRead || (() => {})}
                  onMarkAllRead={onMarkAllNotificationsRead || (() => {})}
                />
              )}
            </div>
          )}

          {user ? (
            <Link href="/profile">
              <Avatar src={user.avatarUrl} alt={user.pubgNickname || user.displayName || user.discordUsername || "User"} size="sm" fallback={(user.pubgNickname || user.displayName || user.discordUsername || "U")[0]?.toUpperCase() || "U"} />
            </Link>
          ) : (
            <Link href="/">
              <Button variant="primary" size="sm">
                Войти
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 py-2 px-4">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            {user && onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Выйти
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
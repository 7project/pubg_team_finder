import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Language } from "@/lib/i18n";

export interface User {
  id: string;
  discordUsername?: string;
  username: string;
  displayName?: string;
  pubgNickname?: string;
  pubgRank?: string;
  avatarUrl?: string;
  tiktokLink?: string;
  youtubeShortsLink?: string;
  privacySetting: "GROUP_ONLY" | "PUBLIC" | "NO_INVITES";
  status?: "ACTIVE" | "BUSY" | "OFFLINE";
  discordInviteLink?: string;
}

export interface Group {
  id: string;
  name: string;
  memberCount: number;
  isPublic: boolean;
  ownerId: string;
  members: Array<{
    id: string;
    username: string;
    avatarUrl?: string;
  }>;
}

export interface Match {
  id: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  matchType?: "SQUAD" | "DUO" | "CUSTOM";
  participants: Array<{
    id: string;
    username: string;
    avatarUrl?: string;
  }>;
  discordInviteLink?: string;
  createdAt: string;
}

export interface PlayerSuggestion {
  id: string;
  username: string;
  pubgNickname?: string;
  pubgRank?: string;
  rating: number;
  avatarUrl?: string;
  isFromGroup: boolean;
  kdRatio?: number;
  wins?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: "invite" | "match_ready" | "match_cancelled" | "participant_removed" | "confirmation_requested" | "invite_accepted" | "match_left";
  matchId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface AppState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isDarkMode: boolean;
  language: "ru" | "en";
  suggestedPlayers: PlayerSuggestion[];
  groupPlayers: PlayerSuggestion[];
  groups: Group[];
  activeMatch: Match | null;
  invitedPlayers: string[];
  notifications: Notification[];
  unreadCount: number;

  setUser: (user: User | null) => void;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
  toggleDarkMode: () => void;
  setLanguage: (lang: "ru" | "en") => void;
  setSuggestedPlayers: (players: PlayerSuggestion[]) => void;
  setGroupPlayers: (players: PlayerSuggestion[]) => void;
  setGroups: (groups: Group[]) => void;
  setActiveMatch: (match: Match | null) => void;
  invitePlayer: (playerId: string) => void;
  removeInvitedPlayer: (playerId: string) => void;
  clearInvites: () => void;
  logout: () => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isDarkMode: true,
      language: "ru",
      suggestedPlayers: [],
      groupPlayers: [],
      groups: [],
      activeMatch: null,
      invitedPlayers: [],
      notifications: [],
      unreadCount: 0,

      setUser: (user) => set({ user }),

      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),

      clearTokens: () => set({ accessToken: null, refreshToken: null }),

      toggleDarkMode: () => set((state) => {
        const newMode = !state.isDarkMode;
        if (typeof document !== 'undefined') {
          if (newMode) {
            document.documentElement.classList.add('dark');
            document.body.style.background = '#1A1A1A';
          } else {
            document.documentElement.classList.remove('dark');
            document.body.style.background = '#F5F5F5';
          }
        }
        return { isDarkMode: newMode };
      }),

      setLanguage: (language) => {
        set({ language });
      },

      setSuggestedPlayers: (suggestedPlayers) => set({ suggestedPlayers }),

      setGroupPlayers: (groupPlayers) => set({ groupPlayers }),

      setGroups: (groups) => set({ groups }),

      setActiveMatch: (activeMatch) => set({ activeMatch }),

      invitePlayer: (playerId) =>
        set((state) => ({
          invitedPlayers: state.invitedPlayers.includes(playerId)
            ? state.invitedPlayers
            : [...state.invitedPlayers, playerId],
        })),

      removeInvitedPlayer: (playerId) =>
        set((state) => ({
          invitedPlayers: state.invitedPlayers.filter((id) => id !== playerId),
        })),

      clearInvites: () => set({ invitedPlayers: [] }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          suggestedPlayers: [],
          groupPlayers: [],
          groups: [],
          activeMatch: null,
          invitedPlayers: [],
          notifications: [],
          unreadCount: 0,
        }),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        })),

      markNotificationRead: (notificationId) =>
        set((state) => {
          const notification = state.notifications.find((n) => n.id === notificationId);
          if (!notification || notification.read) return state;
          return {
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        }),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      setNotifications: (notifications) =>
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }),

      setUnreadCount: (count) => set({ unreadCount: count }),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: "pubg-finder-storage",
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        language: state.language,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [url, options] = args;
    const urlStr = typeof url === 'string' ? url : (url as Request).url;
    const method = options?.method || 'GET';
    
    console.log(`[FETCH] → ${method} ${urlStr}`);
    
    const response = await originalFetch(...args);
    
    console.log(`[FETCH] ← ${method} ${urlStr} - ${response.status}`);
    
    return response;
  };
  
  console.log(`[ENV] NEXT_PUBLIC_DISCORD_REDIRECT_URI: ${process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI}`);
  console.log(`[ENV] NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL}`);
}

function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pubg-finder-storage');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.state?.accessToken || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('pubg-finder-storage');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.state?.refreshToken || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function refreshToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      // Update stored tokens
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('pubg-finder-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.state) {
            parsed.state.accessToken = data.access_token;
            localStorage.setItem('pubg-finder-storage', JSON.stringify(parsed));
          }
        }
      }
      return data.access_token;
    }
  } catch (e) {
    console.error("Failed to refresh token:", e);
  }
  return null;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && token) {
    const newToken = await refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      // Refresh failed, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = "/";
      }
      throw new Error("Session expired. Please login again.");
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface User {
  id: string;
  username: string;
  display_name?: string;
  pubg_nickname?: string;
  pubg_rank?: string;
  avatar_url?: string;
  tiktok_link?: string;
  youtube_shorts_link?: string;
  privacy_setting: "GROUP_ONLY" | "PUBLIC" | "NO_INVITES";
  discord_id?: string;
  internal_name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Group {
  id: string;
  name: string;
  is_public: boolean;
  owner_id: string;
  member_count?: number;
  members?: Array<{
    user_id: string;
    group_id: string;
    role?: string;
    joined_at?: string;
    user?: {
      id: string;
      username: string;
      display_name?: string;
      avatar_url?: string;
    };
  }>;
  created_at?: string;
}

export interface Match {
  id: string;
  status: string;
  match_type?: string;
  max_players?: number;
  participants?: Array<{
    id: string;
    user_id: string;
    match_id: string;
    status: string;
    is_ready?: boolean;
    user?: {
      id: string;
      username: string;
      avatar_url?: string;
    };
  }>;
  discord_invite_link?: string;
  created_at: string;
  created_by?: string;
}

export interface Rating {
  id: string;
  matchId: string;
  fromUserId: string;
  toUserId: string;
  friendliness?: number;
  skill?: number;
  adequacy?: number;
  characterRating?: number;
  activityLevel?: "ACTIVE" | "PASSIVE" | "AVERAGE";
  isInadequate: boolean;
  comment?: string;
  createdAt: string;
}

export interface PlayerStats {
  rankTier: string;
  kdRatio: number;
  wins: number;
  gamesPlayed: number;
  avgDamage: number;
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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const api = {
  auth: {
    discord: () => `${API_URL}/api/v1/auth/discord`,
    callback: (code: string) => fetchApi<{ access_token: string }>("/api/v1/auth/discord/callback", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
    refresh: (refreshToken: string) =>
      fetchApi<{ access_token: string }>("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
    logout: () => fetchApi("/api/v1/auth/logout", { method: "POST" }),
    me: () => fetchApi<User>("/api/v1/auth/me"),
  },

  users: {
    me: () => fetchApi<User>("/api/v1/users/me"),
    update: (data: Partial<User>) =>
      fetchApi<User>("/api/v1/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    get: (id: string) => fetchApi<User>(`/api/v1/users/${id}`),
    search: (params?: { q?: string; rank?: string; minRating?: number; groupOnly?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.set("q", params.q);
      if (params?.rank) searchParams.set("rank", params.rank);
      if (params?.minRating) searchParams.set("min_rating", params.minRating.toString());
      if (params?.groupOnly) searchParams.set("group_only", "true");
      return fetchApi<User[]>(`/api/v1/users/search/?${searchParams}`);
    },
    searchPaginated: (params?: { q?: string; rank?: string; page?: number; pageSize?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.set("q", params.q);
      if (params?.rank) searchParams.set("rank", params.rank);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.pageSize) searchParams.set("page_size", params.pageSize.toString());
      return fetchApi<PaginatedResponse<User>>(`/api/v1/users/search/paginated/?${searchParams}`);
    },
    getRatingStats: (userId: string) =>
      fetchApi<{ rating_average: number; rating_count: number }>(`/api/v1/users/${userId}/rating-stats`),
  },

  groups: {
    list: () => fetchApi<Group[]>("/api/v1/groups/"),
    create: (name: string, isPublic: boolean) =>
      fetchApi<Group>("/api/v1/groups/", { method: "POST", body: JSON.stringify({ name, is_public: isPublic }) }),
    get: (id: string) => fetchApi<Group>(`/api/v1/groups/${id}`),
    update: (id: string, data: { name?: string; isPublic?: boolean }) =>
      fetchApi<Group>(`/api/v1/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/api/v1/groups/${id}`, { method: "DELETE" }),
    addMember: (groupId: string, userId: string) =>
      fetchApi(`/api/v1/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
    removeMember: (groupId: string, userId: string) =>
      fetchApi(`/api/v1/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
  },

  matches: {
    suggestions: () =>
      fetchApi<{ users: User[]; from_group: User[] }>("/api/v1/matches/suggestions"),
    create: (invitedUserIds: string[], matchType?: string, maxPlayers?: number) =>
      fetchApi<Match>("/api/v1/matches/", {
        method: "POST",
        body: JSON.stringify({
          invited_user_ids: invitedUserIds,
          match_type: matchType || "SQUAD",
          max_players: maxPlayers,
        }),
      }),
    get: (id: string) => fetchApi<Match>(`/api/v1/matches/${id}`),
    list: (params?: { page?: number; pageSize?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.pageSize) searchParams.set("page_size", params.pageSize.toString());
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Match>>(`/api/v1/matches/${query ? `?${query}` : ""}`);
    },
    complete: (id: string) =>
      fetchApi(`/api/v1/matches/${id}/complete`, { method: "POST" }),
    invite: (matchId: string, userId: string) =>
      fetchApi(`/api/v1/matches/${matchId}/invite/${userId}`, { method: "POST" }),
    acceptInvite: (matchId: string) =>
      fetchApi(`/api/v1/matches/${matchId}/accept`, { method: "POST" }),
    leave: (matchId: string) =>
      fetchApi(`/api/v1/matches/${matchId}/remove-my-participation`, { method: "POST" }),
    cancel: (matchId: string) =>
      fetchApi(`/api/v1/matches/${matchId}`, { method: "DELETE" }),
    update: (matchId: string, data: { name?: string; discordChannelId?: string; discordInviteLink?: string; mainChannel?: string }) =>
      fetchApi<Match>(`/api/v1/matches/${matchId}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeParticipant: (matchId: string, userId: string) =>
      fetchApi(`/api/v1/matches/${matchId}/participants/${userId}`, { method: "DELETE" }),
    requestConfirmation: (matchId: string) =>
      fetchApi(`/api/v1/matches/${matchId}/request-confirmation`, { method: "POST" }),
    confirm: (matchId: string) =>
      fetchApi(`/api/v1/matches/${matchId}/confirm`, { method: "POST" }),
  },

  notifications: {
    list: (params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.pageSize) searchParams.set("page_size", params.pageSize.toString());
      if (params?.unreadOnly) searchParams.set("unread_only", "true");
      const query = searchParams.toString();
      return fetchApi<PaginatedResponse<Notification>>(`/api/v1/notifications/${query ? `?${query}` : ""}`);
    },
    markRead: (notificationId: string) =>
      fetchApi(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH" }),
    markAllRead: () =>
      fetchApi(`/api/v1/notifications/read-all`, { method: "POST" }),
    getUnreadCount: () => fetchApi<{ unread_count: number }>("/api/v1/notifications/unread-count"),
  },

  ratings: {
    create: (data: Omit<Rating, "id" | "createdAt">) =>
      fetchApi<Rating>("/api/v1/ratings/", { method: "POST", body: JSON.stringify(data) }),
    getForUser: (userId: string) => fetchApi<Rating[]>(`/api/v1/ratings/user/${userId}`),
  },

  parser: {
    player: (username: string) => fetchApi<PlayerStats>(`/api/v1/parser/player/${username}`),
  },
};

export default api;
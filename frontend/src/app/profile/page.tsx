"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import api from "@/services/api";
import { Avatar, Button, Input, Select, Toggle, Card, Badge } from "@/components/ui";
import { User, Save, Settings, Link as LinkIcon, Shield, LogOut, MessageCircle, RotateCcw, Star } from "lucide-react";

const privacyOptions = [
  { value: "PUBLIC", label: "Играть со всеми" },
  { value: "GROUP_ONLY", label: "Только с группой" },
  { value: "NO_INVITES", label: "Не принимать приглашения" },
];

const toSnakeCase = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
};

export default function ProfilePage() {
  const { user, accessToken, setUser, logout } = useAppStore();
  const [formData, setFormData] = useState<{
    displayName: string;
    pubgNickname: string;
    tiktokLink: string;
    youtubeShortsLink: string;
    privacySetting: "PUBLIC" | "GROUP_ONLY" | "NO_INVITES";
  }>({
    displayName: "",
    pubgNickname: "",
    tiktokLink: "",
    youtubeShortsLink: "",
    privacySetting: "PUBLIC",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingStats, setRatingStats] = useState<{ rating_average: number; rating_count: number } | null>(null);
  const [discordData, setDiscordData] = useState<{
    displayName: string;
    avatarUrl: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const data = await api.auth.me();
        setFormData({
          displayName: data.display_name || "",
          pubgNickname: data.pubg_nickname || "",
          tiktokLink: data.tiktok_link || "",
          youtubeShortsLink: data.youtube_shorts_link || "",
          privacySetting: data.privacy_setting || "PUBLIC",
        });
        setDiscordData({
          displayName: data.display_name || "",
          avatarUrl: data.avatar_url || "",
          username: data.username || "",
        });
        setUser(data);

        if (data.id) {
          const stats = await api.users.getRatingStats(data.id);
          setRatingStats(stats);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [accessToken, setUser]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const snakeData = toSnakeCase(formData);
      console.log("[PROFILE] Saving:", snakeData);
      const updatedUser = await api.users.update(snakeData);
      setUser(updatedUser);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("[PROFILE] Save error:", err);
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDiscord = () => {
    if (!discordData) return;
    setFormData({
      ...formData,
      displayName: discordData.displayName,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-700 rounded-full" />
              <div className="space-y-2">
                <div className="h-6 bg-gray-700 rounded w-32" />
                <div className="h-4 bg-gray-700 rounded w-24" />
              </div>
            </div>
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <div className="h-4 bg-gray-700 rounded w-full mb-2" />
                <div className="h-10 bg-gray-700 rounded w-full" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !accessToken) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="text-center py-8">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <h2 className="text-xl font-bold text-white mb-2">Вход не выполнен</h2>
            <p className="text-gray-400 mb-4">Войдите через Discord для просмотра профиля</p>
            <Button variant="primary" onClick={() => window.location.href = "/api/v1/auth/discord"}>
              Войти через Discord
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <h1 className="text-2xl font-bold text-white mb-4">Профиль</h1>

        {error && (
          <Card className="mb-4 bg-red-900/20 border-red-500/30">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

        <Card className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            <Avatar
              src={user?.avatarUrl}
              alt={user?.displayName || user?.username}
              size="lg"
              fallback={(user?.displayName?.[0] || user?.username?.[0] || "U").toUpperCase()}
            />
            <div>
              <h2 className="text-lg font-medium text-white">
                {user?.displayName || user?.username}
              </h2>
              {user?.username && (
                <p className="text-sm text-gray-400">@{user.username}</p>
              )}
              {user?.pubgNickname && (
                <p className="text-sm text-primary">PUBG: {user.pubgNickname}</p>
              )}
              {user?.pubgRank && (
                <p className="text-xs text-gray-400">{user.pubgRank}</p>
              )}
            </div>
          </div>

          {user?.discordInviteLink && (
            <a
              href={user.discordInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg text-white font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Discord комната
            </a>
          )}
        </Card>

        {ratingStats && ratingStats.rating_average !== null && ratingStats.rating_average !== undefined && ratingStats.rating_count > 0 && (
          <Card className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-medium text-white">Ваш рейтинг</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= Math.round(ratingStats.rating_average)
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-600"
                    }`}
                  />
                ))}
              </div>
              <Badge variant="warning">
                {ratingStats.rating_average.toFixed(1)} ({ratingStats.rating_count} оценок)
              </Badge>
            </div>
          </Card>
        )}

        <Card className="mb-4">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Основная информация
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Discord имя (только чтение)</label>
              <Input
                value={user?.username || ""}
                disabled
                className="bg-gray-800/50 cursor-not-allowed"
              />
            </div>

            <Input
              label="Отображаемое имя"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Ваше имя"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToDiscord}
              className="mt-6"
              title="Сбросить к данным Discord"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <Input
              label="PUBG никнейм"
              value={formData.pubgNickname}
              onChange={(e) => setFormData({ ...formData, pubgNickname: e.target.value })}
              placeholder="Ваш ник в PUBG"
            />
          </div>
        </Card>

        <Card className="mb-4">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Социальные сети
          </h3>
          
          <div className="space-y-3">
            <Input
              label="TikTok"
              value={formData.tiktokLink}
              onChange={(e) => setFormData({ ...formData, tiktokLink: e.target.value })}
              placeholder="https://tiktok.com/@username"
            />
            
            <Input
              label="YouTube Shorts"
              value={formData.youtubeShortsLink}
              onChange={(e) => setFormData({ ...formData, youtubeShortsLink: e.target.value })}
              placeholder="https://youtube.com/shorts/@username"
            />
          </div>
        </Card>

        <Card className="mb-4">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Настройки приватности
          </h3>
          
          <div>
            <label className="block text-sm text-gray-300 mb-2">Кто может приглашать вас в матчи</label>
            <select
              value={formData.privacySetting}
              onChange={(e) => setFormData({ ...formData, privacySetting: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-background-dark border border-white/10 rounded-lg text-gray-100"
            >
              {privacyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </Card>

        <Button
          variant="primary"
          className="w-full"
          onClick={handleSave}
          loading={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saved ? "Сохранено!" : "Сохранить изменения"}
        </Button>

        <Button
          variant="ghost"
          className="w-full mt-3 text-red-400 hover:text-red-300"
          onClick={() => {
            logout();
            window.location.href = "/";
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Выйти из профиля
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Avatar, Badge } from "@/components/ui";
import { Sword, Clock, CheckCircle, XCircle, Users, ExternalLink, MessageCircle, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/services/api";
import type { PaginatedResponse, Match } from "@/services/api";

function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return { icon: CheckCircle, label: "Завершён", variant: "success" as const };
    case "ACTIVE":
      return { icon: Clock, label: "Активный", variant: "warning" as const };
    case "PENDING":
      return { icon: Sword, label: "Ожидает", variant: "default" as const };
    case "CANCELLED":
      return { icon: XCircle, label: "Отменён", variant: "danger" as const };
    default:
      return { icon: XCircle, label: status, variant: "danger" as const };
  }
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  return date.toLocaleDateString("ru-RU");
}

export default function MatchesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchesData, userData] = await Promise.all([
          api.matches.list(),
          api.auth.me(),
        ]);
        const paginatedResponse = matchesData as PaginatedResponse<Match>;
        const items: Match[] = paginatedResponse?.items || [];
        setMatches(items);
        setUser(userData);
      } catch (err: any) {
        if (err.message?.includes("401")) {
          router.push("/");
        } else {
          setError(err.message || "Failed to load matches");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLeaveMatch = async (matchId: string) => {
    if (!confirm("Вы уверены что хотите покинуть матч?")) return;

    setLeavingId(matchId);
    try {
      await api.matches.leave(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (err: any) {
      alert(err.message || "Не удалось покинуть матч");
    } finally {
      setLeavingId(null);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm("Вы уверены что хотите удалить матч? Это действие нельзя отменить.")) return;

    setDeletingId(matchId);
    try {
      await api.matches.cancel(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (err: any) {
      alert(err.message || "Не удалось удалить матч");
    } finally {
      setDeletingId(null);
    }
  };

  const isParticipant = (match: Match, userId: string) => {
    if (!userId || !match.participants) return false;
    return match.participants.some((p: any) => p.user_id === userId);
  };

  const isCreator = (match: Match, userId: string) => {
    return match.created_by === userId;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-4 h-4 bg-gray-700 rounded-full" />
                  <div className="h-4 bg-gray-700 rounded w-24" />
                </div>
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="w-8 h-8 bg-gray-700 rounded-full" />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Матчи</h1>
            <p className="text-gray-400 text-sm">{matches.length} матчей</p>
          </div>
          <Link href="/create-match">
            <Button variant="primary" size="sm">
              <Sword className="w-4 h-4 mr-1" />
              Создать
            </Button>
          </Link>
        </div>

        {error && (
          <Card className="mb-4 bg-red-900/20 border-red-500/30">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

        {matches.length > 0 ? (
          <div className="space-y-3">
            {matches.map((match: any) => {
              const statusInfo = getStatusBadge(match.status);
              const StatusIcon = statusInfo.icon;
              const participantCount = match.participants?.length || 0;
              const maxPlayers = match.max_players || 0;

              return (
                <Card key={match.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusInfo.variant}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">
                        {formatTime(match.created_at)}
                      </span>
                      {isCreator(match, user?.id) && match.status !== "COMPLETED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          onClick={() => handleDeleteMatch(match.id)}
                          disabled={deletingId === match.id}
                          title="Удалить матч"
                        >
                          {deletingId === match.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {match.match_type && (
                    <p className="text-xs text-gray-400 mb-2">
                      {match.match_type === "SQUAD" ? "Сквад" :
                       match.match_type === "DUO" ? "Дуо" : "Кастомный"}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">
                      Участники ({participantCount}/{maxPlayers}):
                    </span>
                    <div className="flex -space-x-2">
                      {(match.participants || []).map((p: any) => (
                        <Avatar
                          key={p.user_id}
                          src={p.user?.avatar_url}
                          alt={p.user?.username}
                          size="sm"
                          fallback={p.user?.username?.[0]?.toUpperCase() || '?'}
                        />
                      ))}
                    </div>
                  </div>

                  {match.status === "ACTIVE" && match.discord_invite_link && (
                    <a
                      href={match.discord_invite_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg text-white font-medium transition-colors mb-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Открыть Discord
                    </a>
                  )}

                  {match.status === "ACTIVE" && user && isParticipant(match, user.id) && !isCreator(match, user.id) && (
                    <Button
                      variant="danger"
                      className="w-full mb-2"
                      onClick={() => handleLeaveMatch(match.id)}
                      disabled={leavingId === match.id}
                    >
                      {leavingId === match.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Покинуть матч
                    </Button>
                  )}

                  <Link href={`/matches/${match.id}`} className="block">
                    <Button variant="secondary" className="w-full">
                      Подробнее
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-8">
            <Sword className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">У вас пока нет матчей</p>
            <p className="text-gray-500 text-sm mt-1">Найдите игроков и создайте матч</p>
            <Link href="/dashboard" className="mt-4 inline-block">
              <Button variant="primary">
                Найти игроков
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/services/api";
import { Button, Card, Badge, Avatar } from "@/components/ui";
import {
  Clock, CheckCircle, XCircle, Sword, Users, ExternalLink,
  MessageCircle, LogOut, UserMinus, Trash2, Check, Loader2, Star
} from "lucide-react";
import Link from "next/link";

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

interface MatchDetail {
  id: string;
  status: string;
  matchType?: string;
  maxPlayers?: number;
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
  discordInviteLink?: string;
  createdAt: string;
  createdBy?: string;
}

interface UserRating {
  rating_average?: number;
  rating_count: number;
}

export default function MatchPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;

  const { user } = useAppStore();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [requestingConfirmation, setRequestingConfirmation] = useState(false);
  const [completingMatch, setCompletingMatch] = useState(false);
  const [userRatings, setUserRatings] = useState<Record<string, UserRating>>({});

  useEffect(() => {
    if (!matchId) return;

    const fetchMatch = async () => {
      try {
        const data = await api.matches.get(matchId);
        setMatch(data);
      } catch (err: any) {
        setError(err.message || "Failed to load match");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchId]);

  useEffect(() => {
    if (match?.participants) {
      const fetchRatings = async () => {
        const ratings: Record<string, UserRating> = {};
        for (const p of match.participants) {
          if (p.user_id) {
            try {
              const stats = await api.users.getRatingStats(p.user_id) as UserRating;
              ratings[p.user_id] = stats;
            } catch {
              ratings[p.user_id] = { rating_count: 0 };
            }
          }
        }
        setUserRatings(ratings);
      };
      fetchRatings();
    }
  }, [match?.participants]);

  const handleAcceptInvite = async () => {
    if (!matchId) return;
    try {
      await api.matches.acceptInvite(matchId);
      const data = await api.matches.get(matchId);
      setMatch(data);
    } catch (err: any) {
      setError(err.message || "Failed to accept invite");
    }
  };

  const handleLeaveMatch = async () => {
    if (!matchId) return;
    if (!confirm("Вы уверены что хотите покинуть матч?")) return;
    try {
      await api.matches.leave(matchId);
      router.push("/matches");
    } catch (err: any) {
      setError(err.message || "Failed to leave match");
    }
  };

  const handleRemoveParticipant = async (participantUserId: string) => {
    if (!matchId) return;
    if (!confirm("Удалить этого участника из матча?")) return;

    setRemovingId(participantUserId);
    try {
      await api.matches.removeParticipant(matchId, participantUserId);
      const data = await api.matches.get(matchId);
      setMatch(data);
    } catch (err: any) {
      setError(err.message || "Failed to remove participant");
    } finally {
      setRemovingId(null);
    }
  };

  const handleConfirmParticipation = async () => {
    if (!matchId) return;
    setConfirmingId("self");
    try {
      await api.matches.confirm(matchId);
      const data = await api.matches.get(matchId);
      setMatch(data);
    } catch (err: any) {
      setError(err.message || "Failed to confirm participation");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRequestConfirmation = async () => {
    if (!matchId) return;
    setRequestingConfirmation(true);
    try {
      await api.matches.requestConfirmation(matchId);
      alert("Уведомления отправлены участникам");
    } catch (err: any) {
      setError(err.message || "Failed to request confirmation");
    } finally {
      setRequestingConfirmation(false);
    }
  };

  const handleCompleteMatch = async () => {
    if (!matchId) return;
    if (!confirm("Вы уверены что хотите завершить матч?")) return;
    setCompletingMatch(true);
    try {
      await api.matches.complete(matchId);
      const data = await api.matches.get(matchId);
      setMatch(data);
      alert("Матч завершён! Теперь вы можете оставить отзыв.");
    } catch (err: any) {
      setError(err.message || "Failed to complete match");
    } finally {
      setCompletingMatch(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full" />
                  <div className="h-4 bg-gray-700 rounded w-24" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-gray-400">{error || "Match not found"}</p>
            <Link href="/matches" className="mt-4 inline-block">
              <Button variant="secondary">Назад к матчам</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusBadge(match.status);
  const StatusIcon = statusInfo.icon;
  const isParticipant = match.participants?.some(p => p.user_id === user?.id);
  const isCreator = match.createdBy === user?.id;
  const userParticipant = match.participants?.find(p => p.user_id === user?.id);
  const hasInvite = userParticipant?.status === "INVITED";
  const canConfirm = userParticipant?.status === "ACCEPTED" && !userParticipant?.is_ready && match.status === "ACTIVE";

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/matches" className="text-gray-400 hover:text-white">
            <UserMinus className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Матч</h1>
        </div>

        <Card className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <Badge variant={statusInfo.variant}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
            <span className="text-sm text-gray-400">
              {formatTime(match.createdAt)}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-1">Тип матча</p>
            <p className="text-white font-medium">
              {match.matchType === "SQUAD" ? "Сквад (4 игрока)" :
               match.matchType === "DUO" ? "Дуо (2 игрока)" : "Кастомный"}
            </p>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">
              Участники ({match.participants?.length || 0}/{match.maxPlayers || 0}):
            </p>
            <div className="space-y-2">
              {match.participants?.map((p) => {
                const rating = userRatings[p.user_id];
                return (
                  <div key={p.user_id} className="flex items-center gap-3 p-2 bg-background-dark rounded-lg">
                    <Avatar
                      src={p.user?.avatar_url}
                      alt={p.user?.username}
                      size="sm"
                      fallback={p.user?.username?.[0]?.toUpperCase()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm truncate">{p.user?.username || "Unknown"}</p>
                        {rating?.rating_average && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs text-gray-400">{rating.rating_average.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {p.status === "INVITED" && (
                          <span className="text-xs text-yellow-500">Приглашён</span>
                        )}
                        {p.status === "ACCEPTED" && (
                          <span className="text-xs text-green-500">Принял</span>
                        )}
                        {p.is_ready && (
                          <Badge variant="success" className="text-xs">Готов</Badge>
                        )}
                        {p.user_id === user?.id && (
                          <Badge variant="default" className="text-xs">Вы</Badge>
                        )}
                        {p.user_id === match.createdBy && (
                          <Badge variant="primary" className="text-xs">Создатель</Badge>
                        )}
                      </div>
                    </div>
                    {isCreator && p.user_id !== user?.id && match.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={() => handleRemoveParticipant(p.user_id)}
                        disabled={removingId === p.user_id}
                        title="Удалить участника"
                      >
                        {removingId === p.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {match.status === "ACTIVE" && match.discordInviteLink && (
            <a
              href={match.discordInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg text-white font-medium transition-colors mb-3"
            >
              <MessageCircle className="w-4 h-4" />
              Открыть Discord
            </a>
          )}

          <div className="flex flex-col gap-2">
            {hasInvite && (
              <Button variant="primary" className="w-full" onClick={handleAcceptInvite}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Принять приглашение
              </Button>
            )}

            {canConfirm && (
              <Button
                variant="primary"
                className="w-full"
                onClick={handleConfirmParticipation}
                disabled={confirmingId === "self"}
              >
                {confirmingId === "self" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Подтвердить участие
              </Button>
            )}

            {isParticipant && !hasInvite && !isCreator && match.status === "ACTIVE" && (
              <Button variant="danger" className="w-full" onClick={handleLeaveMatch}>
                <LogOut className="w-4 h-4 mr-2" />
                Покинуть матч
              </Button>
            )}

            {isCreator && match.status === "ACTIVE" && (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleCompleteMatch}
                  disabled={completingMatch}
                >
                  {completingMatch ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Завершить матч
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleRequestConfirmation}
                  disabled={requestingConfirmation}
                >
                  {requestingConfirmation ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Запросить подтверждение
                </Button>

                <Link href={`/matches/${matchId}/invite`} className="w-full">
                  <Button variant="secondary" className="w-full">
                    <Users className="w-4 h-4 mr-2" />
                    Пригласить игроков
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Card>

        {match.status === "COMPLETED" && (
          <Link href={`/rating/${match.id}`}>
            <Button variant="secondary" className="w-full">
              Оставить отзыв
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/services/api";
import { Button, Card, Avatar, Input, Badge } from "@/components/ui";
import { Users, Search, Check, Loader2 } from "lucide-react";
import Link from "next/link";

interface Player {
  id: string;
  username: string;
  displayName?: string;
  pubgNickname?: string;
  pubgRank?: string;
  avatarUrl?: string;
  status?: string;
}

export default function MatchInvitePage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;
  
  const [match, setMatch] = useState<any>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [invitedPlayers, setInvitedPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    
    const fetchData = async () => {
      try {
        const [matchData, suggestions] = await Promise.all([
          api.matches.get(matchId),
          api.matches.suggestions(),
        ]);
        
        setMatch(matchData);
        setAvailablePlayers(suggestions.users || []);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [matchId]);

  const handleInvite = async (playerId: string) => {
    if (!matchId || inviting) return;
    
    setInviting(playerId);
    try {
      await api.matches.invite(matchId, playerId);
      const player = availablePlayers.find(p => p.id === playerId);
      if (player) {
        setInvitedPlayers(prev => [...prev, player]);
      }
    } catch (err: any) {
      console.error("Failed to invite player:", err);
    } finally {
      setInviting(null);
    }
  };

  const filteredPlayers = availablePlayers.filter((p: any) => {
    if (p.status === "BUSY") return false;
    if (match?.participants?.some((mp: any) => mp.user_id === p.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.username?.toLowerCase().includes(searchLower) ||
      p.display_name?.toLowerCase().includes(searchLower) ||
      p.pubg_nickname?.toLowerCase().includes(searchLower)
    );
  });

  const rankColors: Record<string, string> = {
    Bronze: "bg-amber-700",
    Silver: "bg-gray-400",
    Gold: "bg-yellow-500",
    Platinum: "bg-cyan-500",
    Diamond: "bg-blue-500",
    Master: "bg-purple-600",
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full" />
                  <div className="h-4 bg-gray-700 rounded w-24" />
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
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/matches/${matchId}`} className="text-gray-400 hover:text-white">
            <Users className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Пригласить игроков</h1>
        </div>

        {match && (
          <Card className="mb-4">
            <p className="text-sm text-gray-400 mb-1">Матч</p>
            <p className="text-white font-medium">
              {match.matchType === "SQUAD" ? "Сквад" :
               match.matchType === "DUO" ? "Дуо" : "Кастомный"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Участники: {match.participants?.length || 0}/{match.maxPlayers}
            </p>
          </Card>
        )}

        {invitedPlayers.length > 0 && (
          <Card className="mb-4 bg-green-900/20 border-green-500/30">
            <h3 className="text-sm font-medium text-green-400 mb-2">
              Приглашены ({invitedPlayers.length})
            </h3>
            <div className="space-y-2">
              {invitedPlayers.map((player: any) => (
                <div key={player.id} className="flex items-center gap-2">
                  <Avatar src={player.avatar_url} alt={player.username} size="sm" />
                  <span className="text-white text-sm">{player.display_name || player.username}</span>
                  <Badge variant="success" className="ml-auto text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Приглашён
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск игроков..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredPlayers.map((player: any) => (
            <Card key={player.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={player.avatar_url}
                    alt={player.username}
                    size="sm"
                    fallback={player.username?.[0]?.toUpperCase()}
                  />
                  <div>
                    <p className="text-white text-sm font-medium">
                      {player.display_name || player.username}
                    </p>
                    {player.pubg_rank && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs text-white ${rankColors[player.pubg_rank] || 'bg-gray-600'}`}>
                        {player.pubg_rank}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleInvite(player.id)}
                  disabled={inviting === player.id}
                >
                  {inviting === player.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Users className="w-4 h-4 mr-1" />
                      Пригласить
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <Card className="text-center py-8">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Игроки не найдены</p>
          </Card>
        )}
      </div>
    </div>
  );
}

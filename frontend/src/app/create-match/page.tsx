"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/services/api";
import { Avatar, Button, Card, Input } from "@/components/ui";
import { Sword, Users, X, Link2, Loader2 } from "lucide-react";
import Link from "next/link";

interface Player {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  pubgRank?: string;
  pubgNickname?: string;
  status?: string;
}

const rankColors: Record<string, string> = {
  Bronze: "bg-amber-700",
  Silver: "bg-gray-400",
  Gold: "bg-yellow-500",
  Platinum: "bg-cyan-500",
  Diamond: "bg-blue-500",
  Master: "bg-purple-600",
};

export default function CreateMatchPage() {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "invite" | "discord" | "complete">("type");
  const [matchType, setMatchType] = useState<"SQUAD" | "DUO" | "CUSTOM">("SQUAD");
  const [customPlayers, setCustomPlayers] = useState(4);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAppStore();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const data = await api.matches.suggestions();
        setSuggestions((data.users || []) as Player[]);
      } catch (err: any) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, []);

  useEffect(() => {
    if (!playerSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.users.search({ q: playerSearch });
        setSearchResults(results as Player[]);
      } catch (err: any) {
        console.error("Failed to search players:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  const maxPlayers = matchType === "SQUAD" ? 4 : matchType === "DUO" ? 2 : customPlayers;
  const canSelectMore = selectedPlayers.length < maxPlayers - 1;

  const filteredPlayers = (playerSearch.trim() ? searchResults : suggestions).filter(p =>
    p.id !== user?.id &&
    !selectedPlayers.find(sp => sp.id === p.id) &&
    (p.username.toLowerCase().includes(playerSearch.toLowerCase()) ||
     (p.displayName || "").toLowerCase().includes(playerSearch.toLowerCase()) ||
     (p.pubgNickname || "").toLowerCase().includes(playerSearch.toLowerCase()))
  );

  const handleSelectPlayer = (player: Player) => {
    if (selectedPlayers.length < maxPlayers - 1) {
      setSelectedPlayers([...selectedPlayers, player]);
      setPlayerSearch("");
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
  };

  const handleCreateMatch = async () => {
    setCreating(true);
    setError(null);
    try {
      const match = await api.matches.create(
        [...selectedPlayers.map(p => p.id)],
        matchType,
        maxPlayers
      );
      router.push(`/matches/${match.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create match");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="animate-pulse space-y-4">
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

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/matches" className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Создание матча</h1>
          <div className="w-6" />
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {["type", "invite", "discord"].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                step === s ? "bg-primary text-white" :
                ["type", "invite", "discord"].indexOf(step) > idx ? "bg-green-500 text-white" :
                "bg-gray-700 text-gray-400"
              }`}>
                {idx + 1}
              </div>
              {idx < 2 && <div className="w-8 h-0.5 bg-gray-700" />}
            </div>
          ))}
        </div>

        {error && (
          <Card className="mb-4 bg-red-900/20 border-red-500/30">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

        {/* Step 1: Select match type */}
        {step === "type" && (
          <>
            <Card className="mb-4">
              <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Sword className="w-5 h-5" />
                Тип матча
              </h2>
              <div className="space-y-3">
                <Button
                  variant={matchType === "SQUAD" ? "primary" : "secondary"}
                  className="w-full justify-start"
                  onClick={() => setMatchType("SQUAD")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Сквад (4 игрока)
                </Button>
                <Button
                  variant={matchType === "DUO" ? "primary" : "secondary"}
                  className="w-full justify-start"
                  onClick={() => setMatchType("DUO")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Дуо (2 игрока)
                </Button>
                <Button
                  variant={matchType === "CUSTOM" ? "primary" : "secondary"}
                  className="w-full justify-start"
                  onClick={() => setMatchType("CUSTOM")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Кастомный
                </Button>
                {matchType === "CUSTOM" && (
                  <Input
                    label="Количество игроков"
                    type="number"
                    value={customPlayers.toString()}
                    onChange={(e) => setCustomPlayers(parseInt(e.target.value) || 4)}
                    min="2"
                    max="10"
                  />
                )}
                <div className="pt-3 border-t border-white/10">
                  <p className="text-sm text-gray-400">
                    Выбрано: {selectedPlayers.length}/{maxPlayers} (включая вас)
                  </p>
                </div>
              </div>
            </Card>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => router.push("/matches")}>
                Отмена
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => setStep("invite")}>
                Далее
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Invite players */}
        {step === "invite" && (
          <>
            <Card className="mb-4">
              <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Пригласить игроков
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedPlayers.map(player => (
                  <div key={player.id} className="flex items-center gap-2 bg-background-dark px-3 py-2 rounded-lg">
                    <Avatar src={player.avatarUrl} alt={player.username} size="sm" fallback={player.username[0]?.toUpperCase()} />
                    <span className="text-white text-sm">{player.displayName || player.username}</span>
                    <button onClick={() => handleRemovePlayer(player.id)} className="text-gray-400 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Input
                placeholder="Поиск игроков..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
              {playerSearch && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {filteredPlayers.map(player => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-2 bg-background-dark rounded-lg cursor-pointer hover:bg-gray-800 ${
                        !canSelectMore ? "opacity-50" : ""
                      }`}
                      onClick={() => canSelectMore && handleSelectPlayer(player)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar src={player.avatarUrl} alt={player.username} size="sm" fallback={player.username[0]?.toUpperCase()} />
                        <div>
                          <div className="text-white text-sm">{player.displayName || player.username}</div>
                          {player.pubgRank && (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs text-white ${rankColors[player.pubgRank] || 'bg-gray-600'}`}>
                              {player.pubgRank}
                            </span>
                          )}
                        </div>
                      </div>
                      {canSelectMore && (
                        <div className="text-primary text-sm">Добавить</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep("type")}>
                Назад
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => setStep("discord")} disabled={selectedPlayers.length === 0}>
                Далее
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Discord room */}
        {step === "discord" && (
          <>
            <Card className="mb-4">
              <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Discord комната
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Обменяйтесь ссылками на Discord комнату с игроками для связи во время игры
              </p>
              <div className="p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-sm">
                  Приглашённые игроки увидят ссылку в своём профиле и смогут присоединиться к голосовому каналу
                </p>
              </div>
            </Card>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep("invite")}>
                Назад
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleCreateMatch} disabled={creating}>
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sword className="w-4 h-4 mr-2" />
                )}
                Создать матч
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

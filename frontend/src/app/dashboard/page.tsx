"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { UserCard, UserCardSkeleton, FilterPanel, Filters } from "@/components/features";
import { Button, Spinner, Card } from "@/components/ui";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { Search, Users, Sword, RefreshCw } from "lucide-react";
import api from "@/services/api";

export default function DashboardPage() {
  const router = useRouter();
  const { user, invitedPlayers, invitePlayer, removeInvitedPlayer, clearInvites } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Array<{
    id: string;
    username: string;
    pubgNickname?: string;
    pubgRank?: string;
    avatarUrl?: string;
    tiktokLink?: string;
    youtubeShortsLink?: string;
    isFromGroup: boolean;
  }>>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchPlayers = useCallback(async (pageNum: number, append: boolean = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const data = await api.users.searchPaginated({
        q: filters.search,
        rank: filters.rank,
        page: pageNum,
        pageSize: 20,
      });

      const newPlayers = (data.items || [])
        .filter((p: any) => p.id !== user?.id)
        .map((p: any) => ({
          id: p.id,
          username: p.username,
          pubgNickname: p.pubgNickname,
          pubgRank: p.pubgRank,
          avatarUrl: p.avatarUrl,
          tiktokLink: p.tiktokLink,
          youtubeShortsLink: p.youtubeShortsLink,
          isFromGroup: false,
        }));

      if (append) {
        setPlayers(prev => [...prev, ...newPlayers]);
      } else {
        setPlayers(newPlayers);
      }

      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch players:", err);
      setError("Не удалось загрузить игроков");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, user?.id]);

  useEffect(() => {
    setPage(1);
    fetchPlayers(1, false);
  }, [filters, user?.id]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPlayers(nextPage, true);
    }
  };

  const handleToggleInvite = (playerId: string) => {
    if (invitedPlayers.includes(playerId)) {
      removeInvitedPlayer(playerId);
    } else {
      invitePlayer(playerId);
    }
  };

  const handleCreateMatch = async () => {
    if (invitedPlayers.length === 0) return;
    try {
      const match = await api.matches.create(invitedPlayers);
      clearInvites();
      router.push(`/matches/${match.id}`);
    } catch (err) {
      console.error("Failed to create match:", err);
    }
  };

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white mb-1">
            Привет, {user?.pubgNickname || user?.displayName || "Игрок"}!
          </h1>
          <p className="text-gray-400 text-sm">
            {user?.discordUsername && `@${user.discordUsername}`}
            {user?.pubgNickname && user?.discordUsername && " • "}
            {user?.pubgNickname && `PUBG: ${user.pubgNickname}`}
          </p>
        </div>

        <FilterPanel filters={filters} onChange={setFilters} />

        {invitedPlayers.length > 0 && (
          <Card className="mb-4 bg-primary/10 border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-white font-medium">
                  Выбрано игроков: {invitedPlayers.length}
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={handleCreateMatch}>
                <Sword className="w-4 h-4 mr-1" />
                Создать матч
              </Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <UserCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="text-center py-8">
            <RefreshCw className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-red-400">{error}</p>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() => fetchPlayers(1, false)}
            >
              Повторить
            </Button>
          </Card>
        ) : players.length > 0 ? (
          <InfiniteScroll
            onLoadMore={loadMore}
            hasMore={hasMore}
            isLoading={loadingMore}
          >
            {players.map((player) => (
              <div key={player.id} className="mb-3">
                <UserCard
                  id={player.id}
                  username={player.username}
                  pubgNickname={player.pubgNickname}
                  pubgRank={player.pubgRank}
                  avatarUrl={player.avatarUrl}
                  tiktokLink={player.tiktokLink}
                  youtubeShortsLink={player.youtubeShortsLink}
                  isFromGroup={player.isFromGroup}
                  onInvite={() => handleToggleInvite(player.id)}
                  isInvited={invitedPlayers.includes(player.id)}
                />
              </div>
            ))}
          </InfiniteScroll>
        ) : (
          <Card className="text-center py-8">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Игроки не найдены</p>
            <p className="text-gray-500 text-sm mt-1">Попробуйте изменить фильтры</p>
          </Card>
        )}

        <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-gradient-to-t from-background-dark to-transparent md:hidden">
          <Button
            variant="primary"
            className="w-full shadow-lg"
            onClick={handleCreateMatch}
            disabled={invitedPlayers.length === 0}
          >
            <Sword className="w-5 h-5 mr-2" />
            Создать матч ({invitedPlayers.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

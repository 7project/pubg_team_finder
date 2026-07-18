"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { Avatar, Button, Card, Badge } from "@/components/ui";
import { t as translate } from "@/lib/i18n";
import { ArrowLeft, Sword, Star, MessageCircle, ExternalLink, UserPlus } from "lucide-react";
import Link from "next/link";
import api from "@/services/api";

interface PlayerReview {
  id: string;
  fromUser: string;
  friendliness: number;
  skill: number;
  adequacy: number;
  character: number;
  activity: string;
  comment?: string;
  isInadequate: boolean;
}

interface Player {
  id: string;
  username: string;
  displayName: string;
  pubgNickname: string;
  pubgRank: string;
  avatarUrl: string;
  tiktokLink?: string;
  youtubeShortsLink?: string;
  privacySetting: string;
  reviews: PlayerReview[];
}

const rankColors: Record<string, string> = {
  Bronze: "bg-amber-700",
  Silver: "bg-gray-400",
  Gold: "bg-yellow-500",
  Platinum: "bg-cyan-500",
  Diamond: "bg-blue-500",
  Master: "bg-purple-600"
};

export default function PlayerDetailPage() {
  const params = useParams();
  const playerId = params.id as string;
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteSent, setInviteSent] = useState(false);
  
  const { user, invitedPlayers, invitePlayer, language } = useAppStore();
  const t = (key: string) => translate(key as any, language);

  useEffect(() => {
    const fetchPlayer = async () => {
      setLoading(true);
      try {
        const userData = await api.users.get(playerId);
        let reviews: PlayerReview[] = [];
        try {
          const ratingsData = await api.ratings.getForUser(playerId);
          reviews = ratingsData.map((r: any) => ({
            id: r.id,
            fromUser: r.fromUserId || "",
            friendliness: r.friendliness || 0,
            skill: r.skill || 0,
            adequacy: r.adequacy || 0,
            character: r.characterRating || 0,
            activity: r.activityLevel || "",
            comment: r.comment,
            isInadequate: r.isInadequate || false,
          }));
        } catch {
          // ratings might fail, that's ok
        }
        setPlayer({
          id: userData.id,
          username: userData.username,
          displayName: userData.displayName || userData.username,
          pubgNickname: userData.pubgNickname || "",
          pubgRank: userData.pubgRank || "Bronze",
          avatarUrl: userData.avatarUrl || "",
          tiktokLink: userData.tiktokLink,
          youtubeShortsLink: userData.youtubeShortsLink,
          privacySetting: userData.privacySetting,
          reviews,
        });
      } catch (err) {
        console.error("Failed to fetch player:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayer();
  }, [playerId]);

  const isCurrentUser = user?.id === playerId;
  const alreadyInvited = invitedPlayers.includes(playerId);

  const handleInvite = () => {
    if (isCurrentUser || alreadyInvited) return;
    invitePlayer(playerId);
    setInviteSent(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20 flex items-center justify-center">
        <div className="text-gray-400">{t("common.loading")}</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen pt-14 pb-20 flex items-center justify-center">
        <div className="text-gray-400">{t("common.error")}</div>
      </div>
    );
  }

  const rankColor = rankColors[player.pubgRank] || "bg-gray-500";

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
          <ArrowLeft className="w-5 h-5" />
          {t("common.back")}
        </Link>

        <Card className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            <Avatar src={player.avatarUrl} alt={player.username} size="lg" fallback={player.username[0]?.toUpperCase()} />
            <div>
              <h1 className="text-xl font-bold text-white">{player.displayName}</h1>
              <p className="text-gray-400">@{player.username}</p>
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white mt-1 ${rankColor}`}>
                {player.pubgRank}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!isCurrentUser && (
              <Button variant="primary" className="flex-1" onClick={handleInvite} disabled={isCurrentUser || alreadyInvited || inviteSent}>
                {isCurrentUser ? t("player.cantInvite") : inviteSent ? t("player.inviteSent") : alreadyInvited ? t("player.alreadyInvited") : t("profile.invite")}
              </Button>
            )}
          </div>
        </Card>

        <Card className="mb-4">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Sword className="w-5 h-5" />
            {t("profile.stats")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-background-dark rounded-lg">
              <div className="text-2xl font-bold text-white">{player.pubgNickname}</div>
              <div className="text-sm text-gray-400">PUBG Nick</div>
            </div>
            <div className="text-center p-3 bg-background-dark rounded-lg">
              <div className="text-2xl font-bold text-primary">{player.pubgRank}</div>
              <div className="text-sm text-gray-400">Ранг</div>
            </div>
          </div>
        </Card>

        {(player.tiktokLink || player.youtubeShortsLink) && (
          <Card className="mb-4">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {t("profile.social")}
            </h2>
            <div className="space-y-2">
              {player.tiktokLink && (
                <a href={player.tiktokLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-pink-400 hover:underline">
                  <ExternalLink className="w-4 h-4" />
                  TikTok
                </a>
              )}
              {player.youtubeShortsLink && (
                <a href={player.youtubeShortsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-red-400 hover:underline">
                  <ExternalLink className="w-4 h-4" />
                  YouTube Shorts
                </a>
              )}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            {t("profile.reviews")}
          </h2>
          {player.reviews.length > 0 ? (
            <div className="space-y-3">
              {player.reviews.map((review) => (
                <div key={review.id} className="p-3 bg-background-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{review.fromUser}</span>
                    {review.isInadequate && <Badge variant="danger">Неадекватен</Badge>}
                  </div>
                  <div className="flex gap-2 text-sm text-gray-400 mb-1">
                    <span>Д: {review.friendliness}</span>
                    <span>С: {review.skill}</span>
                    <span>А: {review.adequacy}</span>
                    <span>Х: {review.character}</span>
                  </div>
                  {review.comment && <p className="text-gray-300 text-sm italic">{review.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">{t("profile.noReviews")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

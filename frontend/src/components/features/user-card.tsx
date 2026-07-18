"use client";

import { Avatar, Badge, Button, StarRating } from "@/components/ui";
import { Users, MessageCircle, TrendingUp, X } from "lucide-react";
import Link from "next/link";

export interface UserCardProps {
  id: string;
  username: string;
  pubgNickname?: string;
  pubgRank?: string;
  rating?: number;
  avatarUrl?: string;
  isFromGroup?: boolean;
  kdRatio?: number;
  wins?: number;
  tiktokLink?: string;
  youtubeShortsLink?: string;
  onInvite?: () => void;
  onProfileClick?: () => void;
  isInvited?: boolean;
}

export function UserCard({
  id,
  username,
  pubgNickname,
  pubgRank,
  rating = 0,
  avatarUrl,
  isFromGroup,
  kdRatio,
  wins,
  tiktokLink,
  youtubeShortsLink,
  onInvite,
  onProfileClick,
  isInvited = false,
}: UserCardProps) {
  const handleInvite = () => {
    onInvite?.();
  };

  const rankColors: Record<string, string> = {
    Bronze: "text-amber-600",
    Silver: "text-gray-300",
    Gold: "text-yellow-500",
    Platinum: "text-cyan-400",
    Diamond: "text-blue-400",
    Master: "text-purple-500",
  };

  return (
    <div
      className={`bg-background-darker rounded-lg p-4 transition-all duration-200 hover:border-primary/30 border border-transparent ${
        isFromGroup ? "border-l-4 border-l-primary" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div 
          className="cursor-pointer" 
          onClick={onProfileClick}
        >
          <Avatar src={avatarUrl} alt={username} size="lg" fallback={username[0]?.toUpperCase()} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/players/${id}`} className="font-medium text-white truncate hover:text-primary transition-colors">
              {pubgNickname || username}
            </Link>
            {isFromGroup && (
              <Badge variant="primary">
                <Users className="w-3 h-3 mr-1" />
                Из группы
              </Badge>
            )}
          </div>
          
          {pubgRank && (
            <span className={`text-sm font-medium ${rankColors[pubgRank] || "text-gray-400"}`}>
              {pubgRank}
            </span>
          )}

          {rating > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <StarRating value={rating} readonly />
              <span className="text-sm text-gray-400">({rating.toFixed(1)})</span>
            </div>
          )}

          <div className="flex gap-3 mt-2 text-sm text-gray-400">
            {kdRatio && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                KD: {kdRatio}
              </span>
            )}
            {wins !== undefined && (
              <span>Побед: {wins}</span>
            )}
          </div>

          {(tiktokLink || youtubeShortsLink) && (
            <div className="flex gap-2 mt-2">
              {tiktokLink && (
                <a
                  href={tiktokLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-primary transition-colors"
                >
                  TikTok
                </a>
              )}
              {youtubeShortsLink && (
                <a
                  href={youtubeShortsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-primary transition-colors"
                >
                  YouTube
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {onInvite && (
        <Button
          variant={isInvited ? "ghost" : "primary"}
          className="w-full mt-3"
          onClick={handleInvite}
        >
          {isInvited ? (
            <>
              <X className="w-4 h-4 mr-1" />
              Отмена
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4 mr-1" />
              Пригласить
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="bg-background-darker rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gray-700 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-20" />
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-4 h-4 bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
      <div className="h-10 bg-gray-700 rounded mt-3 w-full" />
    </div>
  );
}
"use client";

import Link from "next/link";
import { Badge, Button, Avatar } from "@/components/ui";
import { Users, Settings, Trash2, Plus, Crown } from "lucide-react";

export interface GroupCardProps {
  id: string;
  name: string;
  memberCount: number;
  isPublic: boolean;
  ownerName?: string;
  members?: Array<{
    id: string;
    username: string;
    avatarUrl?: string;
  }>;
  onManage?: () => void;
  onDelete?: () => void;
  onAddMember?: () => void;
  showSettings?: boolean;
}

export function GroupCard({
  id,
  name,
  memberCount,
  isPublic,
  ownerName,
  members = [],
  onManage,
  onDelete,
  onAddMember,
  showSettings = false,
}: GroupCardProps) {
  return (
    <div className="bg-background-darker rounded-lg p-4 border border-white/5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-white text-lg">{name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={isPublic ? "success" : "warning"}>
              {isPublic ? "Публичная" : "Приватная"}
            </Badge>
            <span className="text-sm text-gray-400">
              <Users className="w-4 h-4 inline mr-1" />
              {memberCount} участников
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {showSettings ? (
            <Link href={`/groups/${id}/settings`}>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="sm" onClick={onManage}>
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </div>

      {ownerName && (
        <p className="text-sm text-gray-400 mb-3">
          <Crown className="w-3 h-3 inline mr-1 text-yellow-500" />
          Владелец: {ownerName}
        </p>
      )}

      {members.length > 0 && (
        <div className="mb-3">
          <p className="text-sm text-gray-400 mb-2">Участники:</p>
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((member) => (
              <Avatar
                key={member.id}
                src={member.avatarUrl}
                alt={member.username}
                size="sm"
                fallback={member.username[0]?.toUpperCase()}
              />
            ))}
            {members.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                +{members.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      <Button variant="secondary" className="w-full" onClick={onAddMember}>
        <Plus className="w-4 h-4 mr-2" />
        Добавить участника
      </Button>
    </div>
  );
}

export function GroupCardSkeleton() {
  return (
    <div className="bg-background-darker rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-5 bg-gray-700 rounded w-32 mb-2" />
          <div className="h-4 bg-gray-700 rounded w-24" />
        </div>
        <div className="w-8 h-8 bg-gray-700 rounded" />
      </div>
      <div className="h-4 bg-gray-700 rounded w-20 mb-3" />
      <div className="h-10 bg-gray-700 rounded w-full" />
    </div>
  );
}
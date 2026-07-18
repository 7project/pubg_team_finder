"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/services/api";
import { Button, Card, Input, Avatar, Badge } from "@/components/ui";
import { ArrowLeft, Settings, Users, Trash2, Loader2, Search, Crown } from "lucide-react";

export default function GroupSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const { user } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.groups.get(groupId);
      setGroup(data);
      setGroupName(data.name || "");
    } catch (err: any) {
      setError(err.message || "Failed to load group");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    const searchMembers = async () => {
      if (!memberSearch.trim() || memberSearch.length < 2) {
        setMemberResults([]);
        return;
      }
      setSearchingMembers(true);
      try {
        const results = await api.users.search({ q: memberSearch });
        const currentMemberIds = new Set(
          (group?.members || []).map((m: any) => m.user?.id || m.user_id)
        );
        setMemberResults(
          results
            .filter((u: any) => !currentMemberIds.has(u.id))
            .slice(0, 5)
            .map((u: any) => ({
              id: u.id,
              username: u.username || u.displayName || "Unknown",
              avatarUrl: u.avatarUrl,
            }))
        );
      } catch (err) {
        console.error("Failed to search members:", err);
      } finally {
        setSearchingMembers(false);
      }
    };

    const timer = setTimeout(searchMembers, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, group?.members]);

  const handleSaveName = async () => {
    if (!groupName.trim() || !group) return;
    setSaving(true);
    try {
      await api.groups.update(groupId, { name: groupName });
      await fetchGroup();
    } catch (err: any) {
      alert(err.message || "Failed to update group name");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Вы уверены что хотите удалить группу? Это действие нельзя отменить.")) return;
    setDeleting(true);
    try {
      await api.groups.delete(groupId);
      router.push("/groups");
    } catch (err: any) {
      alert(err.message || "Failed to delete group");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await api.groups.addMember(groupId, userId);
      setMemberSearch("");
      setMemberResults([]);
      await fetchGroup();
    } catch (err: any) {
      alert(err.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm("Удалить этого участника из группы?")) return;
    setRemovingMemberId(memberUserId);
    try {
      await api.groups.removeMember(groupId, memberUserId);
      await fetchGroup();
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="animate-pulse p-6">
            <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-700 rounded w-1/4" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="text-center py-8">
            <p className="text-red-400 mb-4">{error || "Group not found"}</p>
            <Link href="/groups">
              <Button variant="secondary">Назад к группам</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const isOwner = group.owner_id === user?.id;

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/groups" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Настройки группы</h1>
        </div>

        <Card className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-white">Основные настройки</h2>
          </div>

          {isOwner ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Название группы</label>
                <div className="flex gap-2">
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Введите название"
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    onClick={handleSaveName}
                    disabled={saving || !groupName.trim() || groupName === group.name}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400 mb-2">Публичная группа</p>
                <p className="text-xs text-gray-500">
                  {group.is_public ? "Группа видна всем пользователям" : "Группа видна только участникам"}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white font-medium">{group.name}</p>
              <p className="text-sm text-gray-400 mt-1">
                Вы не являетесь владельцем группы
              </p>
            </div>
          )}
        </Card>

        <Card className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-medium text-white">Участники ({group.members?.length || 0})</h2>
          </div>

          <div className="space-y-2 mb-4">
            {group.members?.map((member: any) => {
              const memberId = member.user?.id || member.user_id;
              const isGroupOwner = memberId === group.owner_id;
              return (
                <div
                  key={memberId}
                  className="flex items-center gap-3 p-2 bg-background-dark rounded-lg"
                >
                  <Avatar
                    src={member.user?.avatar_url}
                    alt={member.user?.username}
                    size="sm"
                    fallback={member.user?.username?.[0]?.toUpperCase() || "?"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm truncate">
                        {member.user?.username || "Unknown"}
                      </p>
                      {isGroupOwner && (
                        <Badge variant="primary" className="text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          Создатель
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {member.role || "Участник"}
                    </p>
                  </div>
                  {isOwner && !isGroupOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      onClick={() => handleRemoveMember(memberId)}
                      disabled={removingMemberId === memberId}
                    >
                      {removingMemberId === memberId ? (
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

          {isOwner && (
            <div className="border-t border-white/10 pt-4">
              <label className="block text-sm text-gray-400 mb-2">Добавить участника</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по никнейму..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-background-dark border border-white/10 rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50"
                />
                {searchingMembers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {memberResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {memberResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAddMember(result.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <Avatar src={result.avatarUrl} alt={result.username} size="sm" fallback={result.username[0]?.toUpperCase()} />
                      <span className="text-white text-sm">{result.username}</span>
                      <Badge variant="success" className="ml-auto text-xs">Добавить</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {isOwner && (
          <Card className="border-red-500/30">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-medium text-red-400">Опасная зона</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Удаление группы приведёт к потере всех данных. Это действие нельзя отменить.
            </p>
            <Button
              variant="danger"
              className="w-full"
              onClick={handleDeleteGroup}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Удалить группу
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

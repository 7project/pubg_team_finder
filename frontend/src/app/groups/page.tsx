"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { GroupCard, GroupCardSkeleton } from "@/components/features";
import { Button, Card, Input, Toggle, Avatar } from "@/components/ui";
import { Plus, Users, Search } from "lucide-react";
import api from "@/services/api";

export default function GroupsPage() {
  const router = useRouter();
  const { accessToken } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<Array<{ id: string; username: string; avatarUrl?: string }>>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupPublic, setNewGroupPublic] = useState(true);
  const [groupSearch, setGroupSearch] = useState("");
  const [groups, setGroups] = useState<Array<{
    id: string;
    name: string;
    isPublic: boolean;
    ownerId: string;
    memberCount: number;
    members: Array<{ id: string; username: string; avatarUrl?: string }>;
  }>>([]);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.groups.list();
      const items = data.items || data;
      setGroups(items.map((g: any) => ({
        id: g.id,
        name: g.name,
        isPublic: g.is_public,
        ownerId: g.owner_id || "",
        memberCount: g.member_count || (g.members?.length || 0),
        members: (g.members || []).map((m: any) => ({
          id: m.user?.id || m.user_id,
          username: m.user?.username || m.user?.display_name || "Unknown",
          avatarUrl: m.user?.avatar_url,
        })),
      })));
    } catch (err) {
      console.error("Failed to fetch groups:", err);
      setError("Не удалось загрузить группы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    fetchGroups();
  }, [accessToken]);

  useEffect(() => {
    const searchMembers = async () => {
      if (!memberSearch.trim() || memberSearch.length < 2) {
        setMemberResults([]);
        return;
      }
      setSearchingMembers(true);
      try {
        const results = await api.users.search({ q: memberSearch });
        setMemberResults(
          results.slice(0, 5).map((u: any) => ({
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
  }, [memberSearch]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await api.groups.create(newGroupName, newGroupPublic);
      setNewGroupName("");
      setShowCreateModal(false);
      await fetchGroups();
    } catch (err) {
      console.error("Failed to create group:", err);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await api.groups.delete(id);
      setGroups(groups.filter((g) => g.id !== id));
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  const handleAddMember = async () => {
    if (!selectedMemberId || !selectedGroup) return;
    try {
      await api.groups.addMember(selectedGroup, selectedMemberId);
      setNewMemberName("");
      setSelectedMemberId(null);
      setMemberSearch("");
      setMemberResults([]);
      setShowAddMemberModal(false);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (err) {
      console.error("Failed to add member:", err);
    }
  };

  const openAddMemberModal = (groupId: string) => {
    setSelectedGroup(groupId);
    setNewMemberName("");
    setSelectedMemberId(null);
    setMemberSearch("");
    setMemberResults([]);
    setShowAddMemberModal(true);
  };

  const filteredGroups = groupSearch
    ? groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
    : groups;

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Мои группы</h1>
            <p className="text-gray-400 text-sm">{filteredGroups.length} групп</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Создать
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск групп..."
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-background-dark border border-white/10 rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <GroupCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="text-center py-8">
            <p className="text-red-400 mb-2">{error}</p>
            <Button variant="ghost" onClick={fetchGroups}>Повторить</Button>
          </Card>
        ) : filteredGroups.length > 0 ? (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <GroupCard
                key={group.id}
                id={group.id}
                name={group.name}
                memberCount={group.memberCount}
                isPublic={group.isPublic}
                ownerName=""
                members={group.members}
                onDelete={() => handleDeleteGroup(group.id)}
                onAddMember={() => openAddMemberModal(group.id)}
                showSettings={true}
              />
            ))}
          </div>
        ) : groupSearch ? (
          <Card className="text-center py-8">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Группы не найдены</p>
            <p className="text-gray-500 text-sm mt-1">Попробуйте изменить запрос</p>
          </Card>
        ) : (
          <Card className="text-center py-8">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">У вас пока нет групп</p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Создать первую группу
            </Button>
          </Card>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <h2 className="text-lg font-bold text-white mb-4">Создать группу</h2>
              
              <Input
                label="Название группы"
                placeholder="Введите название"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="mb-4"
              />
              
              <Toggle
                checked={newGroupPublic}
                onChange={setNewGroupPublic}
                label="Публичная группа"
              />
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                >
                  Создать
                </Button>
              </div>
            </Card>
          </div>
        )}

        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <h2 className="text-lg font-bold text-white mb-4">Добавить участника</h2>
              
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Поиск по никнейму..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background-dark border border-white/10 rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50"
                />
                {searchingMembers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {memberResults.length > 0 && (
                <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                  {memberResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setNewMemberName(user.username);
                        setSelectedMemberId(user.id);
                        setMemberSearch(user.username);
                        setMemberResults([]);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <Avatar
                        src={user.avatarUrl}
                        alt={user.username}
                        size="sm"
                        fallback={user.username[0]?.toUpperCase()}
                      />
                      <span className="text-white text-sm">{user.username}</span>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleAddMember}
                  disabled={!selectedMemberId}
                >
                  Добавить
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, Card, Input, Toggle, Avatar } from "@/components/ui";
import { X, Trash2, UserMinus } from "lucide-react";

interface GroupMember {
  id: string;
  username: string;
  avatarUrl?: string;
}

interface GroupSettingsModalProps {
  groupId: string;
  groupName: string;
  isPublic: boolean;
  members: GroupMember[];
  isOwner: boolean;
  onClose: () => void;
  onUpdate: (data: { name?: string; isPublic?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onAddMember: (username: string) => Promise<void>;
}

export function GroupSettingsModal({
  groupId,
  groupName,
  isPublic,
  members,
  isOwner,
  onClose,
  onUpdate,
  onDelete,
  onRemoveMember,
  onAddMember,
}: GroupSettingsModalProps) {
  const [name, setName] = useState(groupName);
  const [publicGroup, setPublicGroup] = useState(isPublic);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        name: name !== groupName ? name : undefined,
        isPublic: publicGroup !== isPublic ? publicGroup : undefined,
      });
      onClose();
    } catch (err) {
      setError("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError("Не удалось удалить группу");
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!searchQuery.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAddMember(searchQuery.trim());
      setSearchQuery("");
    } catch (err) {
      setError("Не удалось добавить участника");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await onRemoveMember(userId);
    } catch (err) {
      setError("Не удалось удалить участника");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Настройки группы</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <Input
            label="Название группы"
            placeholder="Введите название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <Toggle
            checked={publicGroup}
            onChange={setPublicGroup}
            label="Публичная группа"
          />
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Участники ({members.length})
          </h3>
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-background-dark rounded p-2"
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={member.avatarUrl}
                      alt={member.username}
                      size="sm"
                      fallback={member.username[0]?.toUpperCase()}
                    />
                    <span className="text-white text-sm">{member.username}</span>
                  </div>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <UserMinus className="w-4 h-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Нет участников</p>
          )}
        </div>

        {isOwner && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Добавить участника
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="Никнейм или ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="primary"
                onClick={handleAddMember}
                disabled={!searchQuery.trim() || saving}
              >
                Добавить
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        {isOwner && !showDeleteConfirm && (
          <Button
            variant="ghost"
            className="w-full text-red-400 hover:text-red-300"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Удалить группу
          </Button>
        )}

        {showDeleteConfirm && (
          <div className="border border-red-500/30 rounded p-3 bg-red-500/5">
            <p className="text-red-400 text-sm mb-2">
              Вы уверены, что хотите удалить группу? Это действие необратимо.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
              >
                Удалить
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

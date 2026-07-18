"use client";

import { useState } from "react";
import { Avatar, Button, StarRating, Textarea, Card } from "@/components/ui";
import { User, Send, AlertTriangle } from "lucide-react";

export interface RatingFormProps {
  userId: string;
  username: string;
  avatarUrl?: string;
  onSubmit: (rating: {
    to_user_id: string;
    friendliness: number;
    skill: number;
    adequacy: number;
    character_rating: number;
    activity_level: "ACTIVE" | "PASSIVE" | "AVERAGE";
    is_inadequate: boolean;
    comment?: string;
  }) => void;
  onSkip?: () => void;
}

export function RatingForm({
  userId,
  username,
  avatarUrl,
  onSubmit,
  onSkip,
}: RatingFormProps) {
  const [friendliness, setFriendliness] = useState(0);
  const [skill, setSkill] = useState(0);
  const [adequacy, setAdequacy] = useState(0);
  const [character, setCharacter] = useState(0);
  const [activityLevel, setActivityLevel] = useState<"ACTIVE" | "PASSIVE" | "AVERAGE" | null>(null);
  const [isInadequate, setIsInadequate] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    onSubmit({
      to_user_id: userId,
      friendliness,
      skill,
      adequacy,
      character_rating: character,
      activity_level: activityLevel || "AVERAGE",
      is_inadequate: isInadequate,
      comment: comment.trim() || undefined,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className="text-center py-6">
        <div className="text-green-400 text-lg mb-2">Оценка отправлена!</div>
        <p className="text-gray-400">Спасибо за отзыв</p>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
        <Avatar src={avatarUrl} alt={username} size="lg" fallback={username[0]?.toUpperCase()} />
        <div>
          <h3 className="font-medium text-white">{username}</h3>
          <p className="text-sm text-gray-400">Оцените игрока</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-2">Доброжелательность</label>
          <StarRating value={friendliness} onChange={setFriendliness} />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Скилл</label>
          <StarRating value={skill} onChange={setSkill} />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Адекватность</label>
          <StarRating value={adequacy} onChange={setAdequacy} />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Характер</label>
          <StarRating value={character} onChange={setCharacter} />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Активность</label>
          <div className="flex gap-2">
            {(["ACTIVE", "AVERAGE", "PASSIVE"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setActivityLevel(level)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activityLevel === level
                    ? "bg-primary text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {level === "ACTIVE" ? "Активный" : level === "AVERAGE" ? "Средний" : "Пассивный"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="inadequate"
            checked={isInadequate}
            onChange={(e) => setIsInadequate(e.target.checked)}
            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500"
          />
          <label htmlFor="inadequate" className="text-sm text-red-400 flex items-center gap-1 cursor-pointer">
            <AlertTriangle className="w-4 h-4" />
            Неадекватен
          </label>
        </div>

        <Textarea
          label="Комментарий (необязательно)"
          placeholder="Напишите комментарий об игроке..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1" onClick={onSkip}>
            Пропустить
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSubmit}>
            <Send className="w-4 h-4 mr-2" />
            Отправить
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function RatingFormSkeleton() {
  return (
    <div className="bg-background-darker rounded-lg p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
        <div className="w-12 h-12 bg-gray-700 rounded-full" />
        <div>
          <div className="h-4 bg-gray-700 rounded w-24 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-20" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="mb-4">
          <div className="h-3 bg-gray-700 rounded w-24 mb-2" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="w-6 h-6 bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      ))}
      <div className="h-10 bg-gray-700 rounded w-full" />
    </div>
  );
}
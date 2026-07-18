"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { RatingForm, RatingFormSkeleton } from "@/components/features";
import { Button, Card } from "@/components/ui";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import api from "@/services/api";

interface Participant {
  id: string;
  username: string;
  avatarUrl: string;
}

export default function RatingPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const fetchParticipants = async () => {
      setLoading(true);
      setError(null);
      try {
        const match = await api.matches.get(matchId);
        if (match.participants && match.participants.length > 0) {
          setParticipants(
            match.participants.map((p) => ({
              id: p.user_id,
              username: p.user?.username || "Unknown",
              avatarUrl: p.user?.avatar_url || "",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch match participants:", err);
        setError("Не удалось загрузить участников матча");
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
  }, [matchId]);

  const handleSubmit = async (rating: any) => {
    try {
      await api.ratings.create({
        matchId: matchId,
        fromUserId: "",
        toUserId: rating.to_user_id,
        friendliness: rating.friendliness,
        skill: rating.skill,
        adequacy: rating.adequacy,
        characterRating: rating.character_rating,
        activityLevel: rating.activity_level,
        isInadequate: rating.is_inadequate || false,
        comment: rating.comment,
      });
      setSubmittedCount((c) => c + 1);
      setParticipants((p) => p.filter((participant) => participant.id !== rating.to_user_id));
    } catch (err) {
      console.error("Failed to submit rating:", err);
    }
  };

  const handleSkip = (userId: string) => {
    setParticipants((p) => p.filter((p) => p.id !== userId));
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white mb-4">Оценка игроков</h1>
          <RatingFormSkeleton />
          <RatingFormSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <Link href="/matches">
              <Button variant="primary">К матчам</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="min-h-screen pt-14 pb-20">
        <div className="max-w-md mx-auto px-4 py-4">
          <Card className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Все оценки отправлены!</h2>
            <p className="text-gray-400 mb-4">
              Вы оценили {submittedCount} игроков
            </p>
            <Link href="/matches">
              <Button variant="primary">К матчам</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 pb-20">
      <div className="max-w-md mx-auto px-4 py-4">
        <h1 className="text-2xl font-bold text-white mb-2">Оценка игроков</h1>
        <p className="text-gray-400 text-sm mb-4">
          Оцените игроков из последнего матча (по желанию)
        </p>

        <div className="space-y-4">
          {participants.map((participant) => (
            <RatingForm
              key={participant.id}
              userId={participant.id}
              username={participant.username}
              avatarUrl={participant.avatarUrl}
              onSubmit={handleSubmit}
              onSkip={() => handleSkip(participant.id)}
            />
          ))}
        </div>

        <Link href="/matches" className="block mt-4">
          <Button variant="ghost" className="w-full">
            Пропустить все
          </Button>
        </Link>
      </div>
    </div>
  );
}

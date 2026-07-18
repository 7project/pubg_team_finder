"use client";

import { Button, Card } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { useRouter } from "next/navigation";
import { Sword, Users, Star, MessageCircle, Shield, Zap } from "lucide-react";

import { useState, useEffect } from "react";

const features = [
  {
    icon: Sword,
    title: "Подбор по рангу",
    description: "Находи игроков твоего уровня для командной игры",
  },
  {
    icon: Users,
    title: "Группы",
    description: "Создавай группы с друзьями и играй вместе",
  },
  {
    icon: Star,
    title: "Рейтинги",
    description: "Оценивай тиммейтов после игры",
  },
  {
    icon: MessageCircle,
    title: "Discord",
    description: "Автоматическое создание голосовых каналов",
  },
  {
    icon: Shield,
    title: "Приватность",
    description: "Настрой кто может приглашать тебя",
  },
  {
    icon: Zap,
    title: "Быстрый старт",
    description: "Начни играть за пару кликов",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();

  const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
  const REDIRECT_URI = encodeURIComponent(
    process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || "http://localhost:3000/api/auth/callback"
  );

  const handleDiscordLogin = () => {
    const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=identify%20email`;
    window.location.href = oauthUrl;
  };

  const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/discord");
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        handleDiscordLogin();
      }
    } catch {
      handleDiscordLogin();
    }
  };

  return (
    <div className="min-h-screen bg-background-dark">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-military/20" />
        <div className="absolute top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-military/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-lg mx-auto px-4 pt-16 pb-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/20 mb-4">
              <Sword className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              <span className="text-primary">PUBG</span> Finder
            </h1>
            <p className="text-gray-400 text-lg">
              Найди идеальных тиммейтов для победы
            </p>
          </div>

          <Card className="mb-8 bg-white/5 border-white/10">
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-[#5865F2] hover:bg-[#4752C4]"
              onClick={handleDiscordLogin}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Авторизация
            </Button>
          </Card>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              Возможности
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={index}
                    className="bg-white/5 border-white/10 hover:border-primary/30 transition-colors"
                  >
                    <Icon className="w-6 h-6 text-primary mb-2" />
                    <h3 className="text-sm font-medium text-white">{feature.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{feature.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm">
            Нажимая кнопку выше, вы соглашаетесь с правилами использования
          </p>
        </div>
      </div>
    </div>
  );
}
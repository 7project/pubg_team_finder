"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState("");
  const { setUser, setTokens } = useAppStore();

  useEffect(() => {
    let isRequestSent = false;

    const handleCallback = async () => {
      console.log("[CALLBACK] Page loaded");
      console.log("[CALLBACK] Redirect URI from env:", process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI);
      console.log("[CALLBACK] Full URL:", window.location.href);
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const error = urlParams.get("error");

      if (isRequestSent) {
        console.log("Callback already processed, skipping");
        return;
      }

      if (error) {
        setErrorDetail(`OAuth error: ${error}`);
        setStatus("error");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      if (!code) {
        setErrorDetail("No authorization code received");
        setStatus("error");
        setTimeout(() => router.push("/"), 2000);
        return;
      }

      console.log("Callback - code received:", code.substring(0, 10) + "...");
      isRequestSent = true;

      try {
        const response = await fetch(`/api/v1/auth/discord/callback?code=${code}`, {
          method: "GET",
        });

        console.log("Callback - response status:", response.status);
        
        let data;
        const text = await response.text();
        console.log("Callback - response text:", text);
        
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          console.error("Failed to parse JSON:", parseErr);
          setErrorDetail("Неверный ответ сервера");
          setStatus("error");
          setTimeout(() => router.push("/"), 3000);
          return;
        }
        
        console.log("Callback - response data:", data);

        if (response.ok && data.access_token) {
          setTokens(data.access_token, data.refresh_token);
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);

          if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
            setUser(data.user);
            console.log("User set:", data.user);
          }

          // Set server-side cookie for middleware (fixes race condition)
          await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              user: data.user
            })
          });

          setStatus("success");
          setTimeout(() => router.push("/dashboard"), 1500);
        } else if (data.error) {
          setErrorDetail(data.error || "Ошибка авторизации");
          setStatus("error");
          setTimeout(() => router.push("/"), 3000);
        } else if (data.code_used) {
          console.log("Code already used, checking localStorage for user...");
          const storedUser = localStorage.getItem("user");
          const storedToken = localStorage.getItem("access_token");
          const storedRefreshToken = localStorage.getItem("refresh_token");
          
          if (storedUser && storedToken) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
              if (storedRefreshToken) {
                setTokens(storedToken, storedRefreshToken);
              }
              console.log("Using stored user:", parsedUser);
              setStatus("success");
              setTimeout(() => router.push("/dashboard"), 1500);
            } catch (e) {
              setErrorDetail("Failed to parse stored user");
              setStatus("error");
              setTimeout(() => router.push("/"), 3000);
            }
          } else {
            setErrorDetail(data.error || "Код уже использован. Начните заново.");
            setStatus("error");
            setTimeout(() => router.push("/"), 3000);
          }
        } else {
          setErrorDetail("Неизвестная ошибка");
          setStatus("error");
          setTimeout(() => router.push("/"), 3000);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setErrorDetail(err instanceof Error ? err.message : "Ошибка сети");
        setStatus("error");
        setTimeout(() => router.push("/"), 3000);
      }
    };

    handleCallback();
  }, [router, setUser, setTokens]);

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Авторизация...</h2>
            <p className="text-gray-400">Пожалуйста, подождите</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Успешно!</h2>
            <p className="text-gray-400">Перенаправление в приложение...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">Ошибка</h2>
            <p className="text-gray-400">Не удалось авторизоваться. Попробуйте снова.</p>
            {errorDetail && <p className="text-red-400 text-sm mt-2">{errorDetail}</p>}
          </>
        )}
      </div>
    </div>
  );
}

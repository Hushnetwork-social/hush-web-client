"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { useAppStore } from "@/stores";

export default function SplashPage() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");

  useEffect(() => {
    const messages = [
      "Initializing...",
      "Connecting to HushNetwork...",
      "Loading cryptographic modules...",
      "Ready!",
    ];

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setLoadingProgress(Math.min(progress, 100));

      if (progress <= 30) setLoadingMessage(messages[0]);
      else if (progress <= 60) setLoadingMessage(messages[1]);
      else if (progress <= 90) setLoadingMessage(messages[2]);
      else setLoadingMessage(messages[3]);

      if (progress >= 100) {
        clearInterval(interval);
        // Navigate based on authentication status
        setTimeout(() => {
          if (isAuthenticated) {
            router.push("/dashboard");
          } else {
            router.push("/auth");
          }
        }, 300);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen bg-hush-bg-dark flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo placeholder - replace with actual logo */}
        <div className="w-32 h-32 rounded-full bg-hush-bg-element flex items-center justify-center border-2 border-hush-purple/30">
          <Lock className="w-16 h-16 text-hush-purple" />
        </div>

        {/* App name */}
        <h1 className="text-3xl font-bold text-hush-purple">
          Hush Feeds
        </h1>

        {/* Loading indicator */}
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 text-hush-text-accent animate-spin" />
          <span className="text-hush-text-accent text-sm">
            {loadingMessage}
          </span>
          <span className="text-hush-text-accent text-sm">
            {loadingProgress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-hush-bg-element rounded-full overflow-hidden">
          <div
            className="h-full bg-hush-purple transition-all duration-200 ease-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 flex flex-col items-center space-y-1">
        <div className="flex items-center space-x-2">
          <Lock className="w-3 h-3 text-hush-purple" />
          <span className="text-hush-text-accent text-xs">
            Secured by HushNetwork
          </span>
        </div>
      </div>
    </main>
  );
}

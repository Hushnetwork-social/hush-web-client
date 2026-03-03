"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useAppStore } from "@/stores";
import { getAppDisplayName } from "@/lib/navigation/appRoutes";

const SOCIAL_MENU_IDS = new Set([
  "feed-wall",
  "following",
  "my-posts",
  "my-replies",
  "mentions",
  "notifications",
  "users",
  "profile",
  "settings",
]);

type ViewState = "loading" | "empty" | "error" | "populated";

const DEMO_POSTS = [
  {
    id: "post-1",
    author: "Victor Resto",
    time: "1h",
    text: "Kaspa is reentering the GPU era and proving real utility with GPU workstations.",
  },
  {
    id: "post-2",
    author: "Falty",
    time: "2h",
    text: "Built a merchant flow on Kasmart for handmade products. Feedback welcome.",
  },
];

function resolveViewState(rawState: string | null): ViewState {
  if (rawState === "loading" || rawState === "empty" || rawState === "error") {
    return rawState;
  }
  return "populated";
}

export default function SocialPage() {
  const searchParams = useSearchParams();
  const selectedNav = useAppStore((state) => state.selectedNav);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);
  const [showSwitchIndicator, setShowSwitchIndicator] = useState(false);

  useEffect(() => {
    if (!SOCIAL_MENU_IDS.has(selectedNav)) {
      setSelectedNav("feed-wall");
    }
  }, [selectedNav, setSelectedNav]);

  useEffect(() => {
    const switchTarget = sessionStorage.getItem("hush_app_switch_to");
    if (switchTarget === "social") {
      setShowSwitchIndicator(true);
      sessionStorage.removeItem("hush_app_switch_to");

      const timer = window.setTimeout(() => {
        setShowSwitchIndicator(false);
      }, 1200);

      return () => window.clearTimeout(timer);
    }
  }, []);

  const viewState = useMemo(() => resolveViewState(searchParams.get("state")), [searchParams]);

  const renderFeedWallContent = () => {
    if (viewState === "loading") {
      return (
        <div data-testid="social-loading" className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-hush-purple mb-3" />
          <p className="text-hush-text-accent text-sm">Loading Feed Wall...</p>
        </div>
      );
    }

    if (viewState === "error") {
      return (
        <div data-testid="social-error" className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
          <p className="text-hush-text-primary font-semibold mb-1">Could not load Feed Wall</p>
          <p className="text-hush-text-accent text-sm">Please try again in a moment.</p>
        </div>
      );
    }

    if (viewState === "empty") {
      return (
        <div data-testid="social-empty" className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="w-8 h-8 text-hush-purple mb-3" />
          <p className="text-hush-text-primary font-semibold mb-1">Your Feed Wall is quiet</p>
          <p className="text-hush-text-accent text-sm">Follow people or create a post to start your wall.</p>
        </div>
      );
    }

    return (
      <div data-testid="social-populated" className="space-y-3">
        {DEMO_POSTS.map((post) => (
          <article key={post.id} className="bg-hush-bg-dark rounded-xl p-4 border border-hush-bg-hover">
            <div className="flex items-center justify-between mb-2">
              <p className="text-hush-text-primary font-semibold">{post.author}</p>
              <span className="text-xs text-hush-text-accent">{post.time}</span>
            </div>
            <p className="text-sm text-hush-text-accent">{post.text}</p>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-testid="social-shell">
      {showSwitchIndicator && (
        <div
          data-testid="app-switch-indicator"
          className="mx-4 mt-3 rounded-lg bg-hush-purple/20 border border-hush-purple/40 px-3 py-2 text-sm text-hush-purple"
        >
          Switched to {getAppDisplayName("social")}
        </div>
      )}

      <section className="flex-1 min-h-0 overflow-y-auto p-4" data-testid="feed-wall-region">
        <div className="max-w-3xl mx-auto">
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-hush-text-primary">Feed Wall</h2>
            <p className="text-xs text-hush-text-accent">Public posts from people you follow and nearby circles.</p>
          </div>

          {selectedNav === "feed-wall" ? (
            renderFeedWallContent()
          ) : (
            <div data-testid="social-subview-placeholder" className="py-16 text-center">
              <p className="text-hush-text-primary font-semibold mb-1">{selectedNav.replace(/-/g, " ")}</p>
              <p className="text-hush-text-accent text-sm">This section will be expanded in the next phases.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

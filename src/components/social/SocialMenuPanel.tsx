"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores";

const SOCIAL_MENU_ITEMS = [
  { id: "feed-wall", label: "Feed Wall" },
  { id: "following", label: "Following" },
  { id: "my-posts", label: "My Posts" },
  { id: "my-replies", label: "My Replies" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
  { id: "logout", label: "Logout" },
];

const SOCIAL_MENU_IDS = new Set(SOCIAL_MENU_ITEMS.map((item) => item.id));

export function SocialMenuPanel() {
  const selectedNav = useAppStore((state) => state.selectedNav);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);

  useEffect(() => {
    if (!SOCIAL_MENU_IDS.has(selectedNav)) {
      setSelectedNav("feed-wall");
    }
  }, [selectedNav, setSelectedNav]);

  return (
    <div className="p-2 space-y-2" data-testid="social-menu-panel">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
        HushSocial Menu
      </p>

      {SOCIAL_MENU_ITEMS.map((item) => {
        const isSelected = selectedNav === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`social-menu-${item.id}`}
            onClick={() => setSelectedNav(item.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              isSelected
                ? "bg-hush-purple text-hush-bg-dark font-semibold"
                : "text-hush-text-accent hover:bg-hush-bg-hover"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

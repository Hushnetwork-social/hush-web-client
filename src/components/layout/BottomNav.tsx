"use client";

import { Download, LogOut, Menu, MessageSquare, Search, UserCircle, Vote } from "lucide-react";
import { useState } from "react";
import type { AppId } from "@/stores/useAppStore";
import { DEFAULT_CROSS_APP_BADGES } from "@/stores/useAppStore";
import { getAppNavItems } from "./appNavConfig";

interface BottomNavProps {
  selectedNav: string;
  onNavSelect: (id: string) => void;
  activeApp?: AppId;
  crossAppBadges?: Record<AppId, number>;
  userInitials?: string;
  onDownloadKeys?: () => void;
  onAccountDetails?: () => void;
  onLogout?: () => void;
  guestMode?: boolean;
  onGuestAction?: () => void;
  guestActionLabel?: string;
  guestActionInitials?: string;
}

type RenderNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  hideLabel?: boolean;
  ariaLabel?: string;
  isActive?: boolean;
};

const SOCIAL_MOBILE_MENU_ITEMS = [
  { id: "feed-wall", label: "Feed Wall" },
  { id: "following", label: "Following" },
  { id: "my-posts", label: "My Posts" },
  { id: "my-replies", label: "My Replies" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
];

const SOCIAL_MOBILE_MENU_IDS = new Set(SOCIAL_MOBILE_MENU_ITEMS.map((item) => item.id));

export function BottomNav({
  selectedNav,
  onNavSelect,
  activeApp = "feeds",
  crossAppBadges = DEFAULT_CROSS_APP_BADGES,
  userInitials = "U",
  onDownloadKeys,
  onAccountDetails,
  onLogout,
  guestMode = false,
  onGuestAction,
  guestActionLabel = "Create User",
  guestActionInitials = "CU",
}: BottomNavProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const navItems: RenderNavItem[] =
    activeApp === "social"
      ? [
          {
            id: "social-menu",
            label: "Menu",
            ariaLabel: "HushSocial menu",
            icon: <Menu className="w-5 h-5" />,
            hideLabel: true,
            isActive: showSocialMenu || SOCIAL_MOBILE_MENU_IDS.has(selectedNav),
          },
          {
            id: "search",
            label: "Search",
            icon: <Search className="w-5 h-5" />,
            isActive: selectedNav === "search",
          },
          {
            id: "switch-feeds",
            label: "HushFeeds!",
            icon: <MessageSquare className="w-5 h-5" />,
            badgeCount: crossAppBadges.feeds,
            isActive: false,
          },
          {
            id: "open-voting",
            label: "HushVoting!",
            icon: <Vote className="w-5 h-5" />,
            isActive: selectedNav === "open-voting",
          },
        ]
      : getAppNavItems(activeApp, crossAppBadges);

  return (
    <nav className="bg-hush-bg-element border-t border-hush-bg-dark px-2 py-2 relative">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (guestMode) {
                onGuestAction?.();
                return;
              }
              setShowUserMenu(false);
              if (item.id === "social-menu") {
                setShowSocialMenu((current) => !current);
                return;
              }
              setShowSocialMenu(false);
              onNavSelect(item.id);
            }}
            className={`
              flex flex-col items-center space-y-0.5 px-3 py-2 rounded-lg
              transition-colors duration-150
              ${guestMode ? "cursor-pointer opacity-75" : "cursor-pointer"}
              ${
                (item.isActive ?? selectedNav === item.id) && !guestMode
                  ? "text-hush-purple"
                  : "text-hush-text-accent hover:bg-hush-bg-hover"
              }
            `}
            aria-disabled={guestMode}
            aria-label={item.ariaLabel ?? item.label}
            data-testid={`nav-${item.id}`}
          >
            {item.icon}
            {!item.hideLabel ? <span className="text-[10px]">{item.label}</span> : null}
            {!!item.badgeCount && item.badgeCount > 0 && (
              <span
                data-testid={`nav-badge-${item.id}`}
                className="text-[9px] font-semibold text-hush-purple"
              >
                {item.badgeCount}
              </span>
            )}
          </button>
        ))}

        {/* Profile Button */}
        <button
          onClick={() => {
            if (guestMode) {
              onGuestAction?.();
              return;
            }
            setShowSocialMenu(false);
            setShowUserMenu(!showUserMenu);
          }}
          className="flex flex-col items-center space-y-1 px-3 py-2 rounded-lg text-hush-text-accent hover:bg-hush-bg-hover transition-colors cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-hush-purple flex items-center justify-center">
            <span className="text-[10px] font-bold text-hush-bg-dark">
              {guestMode ? guestActionInitials : userInitials}
            </span>
          </div>
          <span className="text-[10px]">{guestMode ? guestActionLabel : "Profile"}</span>
        </button>
      </div>

      {showSocialMenu && activeApp === "social" && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSocialMenu(false)}
          />
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-hush-bg-dark rounded-xl border border-hush-bg-element shadow-lg z-50 p-1.5 space-y-1">
            {SOCIAL_MOBILE_MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`social-mobile-menu-${item.id}`}
                onClick={() => {
                  if (guestMode) {
                    onGuestAction?.();
                    return;
                  }
                  setShowSocialMenu(false);
                  onNavSelect(item.id);
                }}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedNav === item.id
                    ? "bg-hush-purple text-hush-bg-dark font-semibold"
                    : "text-hush-text-primary hover:bg-hush-bg-hover"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* User Menu Popup */}
      {showUserMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
          {/* Menu */}
          <div className="absolute bottom-full right-2 mb-2 bg-hush-bg-dark rounded-xl border border-hush-bg-element shadow-lg z-50 min-w-[200px] p-1.5 space-y-1">
            <button
              onClick={() => {
                onDownloadKeys?.();
                setShowUserMenu(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-hush-purple active:bg-hush-purple active:text-hush-bg-dark transition-colors text-hush-text-primary group"
            >
              <Download className="w-4 h-4 text-hush-text-accent group-active:text-hush-bg-dark" />
              <span className="text-sm">Download keys</span>
            </button>
            <button
              onClick={() => {
                onAccountDetails?.();
                setShowUserMenu(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-hush-purple active:bg-hush-purple active:text-hush-bg-dark transition-colors text-hush-text-primary group"
            >
              <UserCircle className="w-4 h-4 text-hush-text-accent group-active:text-hush-bg-dark" />
              <span className="text-sm">Account Details</span>
            </button>
            <button
              data-testid="logout-button"
              onClick={() => {
                onLogout?.();
                setShowUserMenu(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-hush-purple active:bg-hush-purple active:text-hush-bg-dark transition-colors text-hush-text-primary group"
            >
              <LogOut className="w-4 h-4 text-hush-text-accent group-active:text-hush-bg-dark" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </>
      )}
    </nav>
  );
}

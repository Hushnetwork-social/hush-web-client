"use client";

import { Download, LogOut, UserCircle } from "lucide-react";
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
  const navItems = getAppNavItems(activeApp, crossAppBadges);

  return (
    <nav className="bg-hush-bg-element border-t border-hush-bg-dark px-2 py-2 relative">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.comingSoon) {
                return;
              }
              if (guestMode) {
                onGuestAction?.();
                return;
              }
              onNavSelect(item.id);
            }}
            disabled={item.comingSoon}
            className={`
              flex flex-col items-center space-y-0.5 px-3 py-2 rounded-lg
              transition-colors duration-150
              ${item.comingSoon ? "cursor-not-allowed opacity-50" : guestMode ? "cursor-pointer opacity-75" : "cursor-pointer"}
              ${
                selectedNav === item.id && !item.comingSoon && !guestMode
                  ? "text-hush-purple"
                  : "text-hush-text-accent hover:bg-hush-bg-hover"
              }
            `}
            aria-disabled={guestMode || item.comingSoon}
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
            {!!item.badgeCount && item.badgeCount > 0 && (
              <span
                data-testid={`nav-badge-${item.id}`}
                className="text-[9px] font-semibold text-hush-purple"
              >
                {item.badgeCount}
              </span>
            )}
            {item.comingSoon && (
              <span className="text-[8px] text-hush-text-accent">(Soon)</span>
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

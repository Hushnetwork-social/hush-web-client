"use client";

import { Download, LogOut, UserCircle } from "lucide-react";
import { useState } from "react";
import type { AppId } from "@/stores/useAppStore";
import { DEFAULT_CROSS_APP_BADGES } from "@/stores/useAppStore";
import { getAppNavItems } from "./appNavConfig";

interface SidebarProps {
  selectedNav: string;
  onNavSelect: (id: string) => void;
  activeApp?: AppId;
  crossAppBadges?: Record<AppId, number>;
  userDisplayName?: string;
  userInitials?: string;
  children?: React.ReactNode;
  onDownloadKeys?: () => void;
  onAccountDetails?: () => void;
  onLogout?: () => void;
  guestMode?: boolean;
  onGuestAction?: () => void;
  guestActionLabel?: string;
  guestActionInitials?: string;
}

export function Sidebar({
  selectedNav,
  onNavSelect,
  activeApp = "feeds",
  crossAppBadges = DEFAULT_CROSS_APP_BADGES,
  userDisplayName = "User",
  userInitials = "U",
  children,
  onDownloadKeys,
  onAccountDetails,
  onLogout,
  guestMode = false,
  onGuestAction,
  guestActionLabel = "Create User",
  guestActionInitials = "CU",
}: SidebarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navItems = getAppNavItems(activeApp, crossAppBadges);

  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col min-h-0 max-h-full overflow-hidden">
      {/* Navigation Menu */}
      <nav className="flex-shrink-0 bg-hush-bg-element p-2 space-y-1 mb-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
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
            aria-disabled={guestMode || item.comingSoon}
            className={`
              w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl
              transition-colors duration-150
              ${item.comingSoon ? "cursor-not-allowed opacity-60" : guestMode ? "cursor-pointer opacity-75" : "cursor-pointer"}
              ${
                selectedNav === item.id && !item.comingSoon && !guestMode
                  ? "bg-hush-purple text-hush-bg-dark"
                  : "text-hush-text-accent hover:bg-hush-bg-hover"
              }
            `}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
            {!!item.badgeCount && item.badgeCount > 0 && (
              <span
                data-testid={`nav-badge-${item.id}`}
                className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-hush-purple text-hush-bg-dark"
              >
                {item.badgeCount}
              </span>
            )}
            {item.comingSoon && (
              <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold bg-hush-text-accent/20 text-hush-text-accent">
                Soon
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Feed List Area - scrollable, shrinks if needed but doesn't grow beyond content */}
      <div className="flex-shrink min-h-0 w-full bg-hush-bg-element overflow-y-auto overflow-x-hidden">
        <div className="p-2">
          {children}
        </div>
      </div>

      {/* Spacer - absorbs extra space so feed list doesn't have gap */}
      <div className="flex-1 min-h-0 bg-hush-bg-element"></div>

      {/* User Profile Section - fixed at bottom */}
      <div className="flex-shrink-0 bg-hush-bg-element rounded-bl-xl p-2">
        <div className="relative">
          <button
            data-testid="user-menu-trigger"
            onClick={() => {
              if (guestMode) {
                onGuestAction?.();
                return;
              }
              setShowUserMenu(!showUserMenu);
            }}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-hush-bg-hover transition-colors cursor-pointer"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-hush-bg-dark">
                {guestMode ? guestActionInitials : userInitials}
              </span>
            </div>
            {/* Name */}
            <span className="text-sm text-hush-text-primary truncate">
              {guestMode ? guestActionLabel : userDisplayName}
            </span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && !guestMode && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-hush-bg-dark rounded-xl border border-hush-bg-element shadow-lg p-1.5 space-y-1">
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
                data-testid="menu-account-details"
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
          )}
        </div>
      </div>
    </aside>
  );
}

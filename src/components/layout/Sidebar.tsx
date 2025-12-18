"use client";

import { MessageSquare, PlusCircle, Palette, Users, Download, LogOut } from "lucide-react";
import { useState } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  { id: "feeds", label: "Feeds", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "new-chat", label: "New Feed", icon: <PlusCircle className="w-5 h-5" /> },
  { id: "memes", label: "Memes", icon: <Palette className="w-5 h-5" />, comingSoon: true },
  { id: "community", label: "Community", icon: <Users className="w-5 h-5" />, comingSoon: true },
];

interface SidebarProps {
  selectedNav: string;
  onNavSelect: (id: string) => void;
  userDisplayName?: string;
  userInitials?: string;
  children?: React.ReactNode;
  onDownloadKeys?: () => void;
  onLogout?: () => void;
}

export function Sidebar({
  selectedNav,
  onNavSelect,
  userDisplayName = "User",
  userInitials = "U",
  children,
  onDownloadKeys,
  onLogout,
}: SidebarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <aside className="w-[280px] flex flex-col gap-1 min-h-0">
      {/* Navigation Menu */}
      <nav className="bg-hush-bg-element p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.comingSoon && onNavSelect(item.id)}
            disabled={item.comingSoon}
            className={`
              w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl
              transition-colors duration-150
              ${item.comingSoon ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
              ${
                selectedNav === item.id && !item.comingSoon
                  ? "bg-hush-purple text-hush-bg-dark"
                  : "text-hush-text-accent hover:bg-hush-bg-hover"
              }
            `}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
            {item.comingSoon && (
              <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold bg-hush-text-accent/20 text-hush-text-accent">
                Soon
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Feed List Area - takes all available space */}
      <div className="flex-1 min-h-0 bg-hush-bg-element overflow-y-auto px-2 py-2">
        {children}
      </div>

      {/* User Profile Section - separate box at bottom with outer corner */}
      <div className="bg-hush-bg-element rounded-bl-xl p-2 relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-hush-bg-hover transition-colors cursor-pointer"
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-hush-bg-dark">
              {userInitials}
            </span>
          </div>
          {/* Name */}
          <span className="text-sm text-hush-text-primary truncate">
            {userDisplayName}
          </span>
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-hush-bg-dark rounded-xl border border-hush-bg-element shadow-lg p-1.5 space-y-1">
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
    </aside>
  );
}

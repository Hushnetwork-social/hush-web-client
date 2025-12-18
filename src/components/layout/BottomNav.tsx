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

interface BottomNavProps {
  selectedNav: string;
  onNavSelect: (id: string) => void;
  userInitials?: string;
  onDownloadKeys?: () => void;
  onLogout?: () => void;
}

export function BottomNav({
  selectedNav,
  onNavSelect,
  userInitials = "U",
  onDownloadKeys,
  onLogout,
}: BottomNavProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="bg-hush-bg-element border-t border-hush-bg-dark px-2 py-2 relative">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.comingSoon && onNavSelect(item.id)}
            disabled={item.comingSoon}
            className={`
              flex flex-col items-center space-y-0.5 px-3 py-2 rounded-lg
              transition-colors duration-150
              ${item.comingSoon ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
              ${
                selectedNav === item.id && !item.comingSoon
                  ? "text-hush-purple"
                  : "text-hush-text-accent hover:bg-hush-bg-hover"
              }
            `}
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
            {item.comingSoon && (
              <span className="text-[8px] text-hush-text-accent">(Soon)</span>
            )}
          </button>
        ))}

        {/* Profile Button */}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex flex-col items-center space-y-1 px-3 py-2 rounded-lg text-hush-text-accent hover:bg-hush-bg-hover transition-colors cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-hush-purple flex items-center justify-center">
            <span className="text-[10px] font-bold text-hush-bg-dark">
              {userInitials}
            </span>
          </div>
          <span className="text-[10px]">Profile</span>
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

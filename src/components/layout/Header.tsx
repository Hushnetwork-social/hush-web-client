"use client";

import { Lock } from "lucide-react";

interface HeaderProps {
  title?: string;
  feedName?: string;
  balance?: number;
  blockHeight?: number;
}

export function Header({ title = "Hush Feeds", feedName, balance = 0, blockHeight = 0 }: HeaderProps) {
  return (
    <header className="bg-hush-bg-element rounded-t-xl px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Title and Feed Name */}
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-hush-purple">{title}</h1>
          {feedName && (
            <>
              <span className="mx-3 text-xl text-hush-text-accent">/</span>
              <span className="text-lg font-semibold text-hush-text-primary">
                {feedName}
              </span>
            </>
          )}
        </div>

        {/* Right: Balance */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-hush-text-accent">Balance</span>
          <span className="text-sm font-semibold text-hush-purple">
            {balance.toFixed(2)} HUSH
          </span>
        </div>
      </div>
    </header>
  );
}

interface FooterProps {
  blockHeight?: number;
}

export function Footer({ blockHeight = 0 }: FooterProps) {
  return (
    <footer className="py-2">
      <div className="flex flex-col items-center space-y-0.5">
        <div className="flex items-center space-x-1">
          <Lock className="w-3 h-3 text-hush-purple" />
          <span className="text-[10px] text-hush-text-accent">
            Secured by HushNetwork
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-hush-text-accent">Blocks:</span>
          <span className="text-[10px] font-semibold text-hush-purple">
            {blockHeight}
          </span>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useEffect, useRef } from "react";
import EmojiPickerReact, { EmojiClickData, Theme } from "emoji-picker-react";

interface EmojiPickerProps {
  isOpen: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ isOpen, onEmojiSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close when opening
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    // Don't close - let user select multiple emojis
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 z-50"
    >
      <EmojiPickerReact
        onEmojiClick={handleEmojiClick}
        theme={Theme.DARK}
        width={320}
        height={400}
        searchPlaceholder="Search emojis..."
        skinTonesDisabled={false}
        lazyLoadEmojis={true}
      />
    </div>
  );
}

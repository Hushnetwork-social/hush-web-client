"use client";

import { EMOJIS } from "@/lib/crypto/reactions/constants";

interface ReactionPickerProps {
  onSelect: (emojiIndex: number) => void;
  selectedEmoji: number | null;
  disabled?: boolean;
  onClose?: () => void;
}

/**
 * Emoji picker for reactions
 *
 * Displays the 6 available emoji options for anonymous reactions.
 * Selected emoji is highlighted, and clicking the same emoji removes the reaction.
 */
export function ReactionPicker({
  onSelect,
  selectedEmoji,
  disabled = false,
  onClose,
}: ReactionPickerProps) {
  const handleSelect = (index: number) => {
    console.log(`[E2E Reaction] ReactionPicker.handleSelect called: index=${index}, disabled=${disabled}, selectedEmoji=${selectedEmoji}`);
    if (disabled) {
      console.log('[E2E Reaction] ReactionPicker: disabled, returning early');
      return;
    }

    // If clicking the already selected emoji, remove the reaction
    if (selectedEmoji === index) {
      console.log('[E2E Reaction] ReactionPicker: Same emoji clicked, sending removal (6)');
      onSelect(6); // 6 = removal
    } else {
      console.log(`[E2E Reaction] ReactionPicker: Calling onSelect(${index})`);
      onSelect(index);
    }

    onClose?.();
  };

  return (
    <div
      className="flex gap-1 p-1.5 bg-hush-bg-dark rounded-lg shadow-xl border border-hush-border"
      role="listbox"
      aria-label="Select reaction"
      data-testid="reaction-picker"
    >
      {EMOJIS.map((emoji, index) => (
        <button
          key={emoji}
          onClick={() => handleSelect(index)}
          disabled={disabled}
          role="option"
          aria-selected={selectedEmoji === index}
          data-testid={`emoji-${emoji}`}
          className={`
            p-2 rounded-md transition-all duration-150
            text-xl leading-none
            ${
              selectedEmoji === index
                ? "bg-hush-purple/20 ring-2 ring-hush-purple scale-110"
                : "hover:bg-hush-bg-dark/50 hover:scale-105"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            active:scale-95
          `}
          title={selectedEmoji === index ? "Click to remove" : `React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

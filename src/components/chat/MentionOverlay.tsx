"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";

/**
 * Participant data for mention selection
 */
export interface MentionParticipant {
  identityId: string;
  displayName: string;
  publicAddress: string;
}

interface MentionOverlayProps {
  /** List of participants to display */
  participants: MentionParticipant[];
  /** Current filter text for filtering participants */
  filterText: string;
  /** Whether the overlay is visible */
  isOpen: boolean;
  /** Callback when a participant is selected */
  onSelect: (participant: MentionParticipant) => void;
  /** Callback when overlay should close without selection */
  onClose: () => void;
}

// Maximum visible items before scrolling
const MAX_VISIBLE_ITEMS = 5;
const ITEM_HEIGHT = 40;

/**
 * Get initials from a display name for avatar
 */
function getInitials(displayName: string): string {
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * MentionOverlay - Dropdown for selecting participants to mention
 *
 * Features:
 * - Displays participant list with avatars
 * - Case-insensitive filtering
 * - Keyboard navigation (Arrow Up/Down, Enter, Tab, Escape)
 * - Click outside to close
 * - Wrapping navigation at boundaries
 */
export const MentionOverlay = memo(function MentionOverlay({
  participants,
  filterText,
  isOpen,
  onSelect,
  onClose,
}: MentionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Filter participants by display name (case-insensitive)
  const filteredParticipants = participants.filter((p) =>
    p.displayName.toLowerCase().includes(filterText.toLowerCase())
  );

  // Reset highlighted index when filter changes or overlay opens
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filterText, isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || filteredParticipants.length === 0) return;

    const listContainer = containerRef.current?.querySelector('[role="listbox"]');
    const highlightedItem = listContainer?.children[highlightedIndex] as HTMLElement;

    if (highlightedItem) {
      highlightedItem.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen, filteredParticipants.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || filteredParticipants.length === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev >= filteredParticipants.length - 1 ? 0 : prev + 1
          );
          break;

        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev <= 0 ? filteredParticipants.length - 1 : prev - 1
          );
          break;

        case "Enter":
        case "Tab":
          event.preventDefault();
          if (filteredParticipants[highlightedIndex]) {
            onSelect(filteredParticipants[highlightedIndex]);
          }
          break;

        case "Escape":
          event.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredParticipants, highlightedIndex, onSelect, onClose]
  );

  // Register keyboard event listener
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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

  if (!isOpen) return null;

  const maxHeight = MAX_VISIBLE_ITEMS * ITEM_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 z-50 w-[250px]"
      role="dialog"
      aria-label="Select participant to mention"
    >
      <div
        className="bg-hush-bg-element border border-white/10 rounded-lg shadow-lg overflow-hidden"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {filteredParticipants.length === 0 ? (
          <div
            className="px-3 py-3 text-sm text-white/50 text-center"
            role="status"
            aria-live="polite"
          >
            No participants match
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="Participants"
            className="overflow-y-auto"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {filteredParticipants.map((participant, index) => (
              <div
                key={participant.identityId}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`
                  flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors
                  ${
                    index === highlightedIndex
                      ? "bg-hush-purple/20 border-l-2 border-hush-purple"
                      : "border-l-2 border-transparent hover:bg-white/5"
                  }
                `}
                onClick={() => onSelect(participant)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {/* Avatar with initials */}
                <div className="w-6 h-6 rounded-full bg-hush-purple/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-hush-purple">
                    {getInitials(participant.displayName)}
                  </span>
                </div>

                {/* Display name */}
                <span className="text-sm text-white truncate">
                  {participant.displayName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

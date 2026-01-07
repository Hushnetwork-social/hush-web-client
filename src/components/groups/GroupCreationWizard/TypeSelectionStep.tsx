"use client";

import { memo, useCallback, useRef } from "react";
import { TypeSelectionCard } from "./TypeSelectionCard";
import type { GroupType } from "./useCreateGroupFlow";

interface TypeSelectionStepProps {
  selectedType: GroupType;
  onTypeSelect: (type: "public" | "private") => void;
  onNext: () => void;
}

/** Content configuration for the type selection cards */
const PUBLIC_CARD_CONTENT = {
  icon: "globe" as const,
  title: "Public",
  description: "Anyone can find and join this group",
  bullets: ["Visible in search", "Open membership"],
};

const PRIVATE_CARD_CONTENT = {
  icon: "lock" as const,
  title: "Private",
  description: "Invite-only membership",
  bullets: ["Hidden from search", "Controlled access"],
};

/**
 * TypeSelectionStep - Step 1 of the Group Creation Wizard.
 *
 * Allows users to choose between Public and Private group types.
 * - Desktop: Cards displayed side by side
 * - Mobile: Cards stacked vertically
 */
export const TypeSelectionStep = memo(function TypeSelectionStep({
  selectedType,
  onTypeSelect,
  onNext,
}: TypeSelectionStepProps) {
  const publicCardRef = useRef<HTMLDivElement>(null);
  const privateCardRef = useRef<HTMLDivElement>(null);

  const canProceed = selectedType !== null;

  const handleSelectPublic = useCallback(() => {
    onTypeSelect("public");
  }, [onTypeSelect]);

  const handleSelectPrivate = useCallback(() => {
    onTypeSelect("private");
  }, [onTypeSelect]);

  // Handle arrow key navigation between cards
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (target.contains(publicCardRef.current)) {
        privateCardRef.current?.focus();
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (target.contains(privateCardRef.current)) {
        publicCardRef.current?.focus();
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {/* Question Text */}
        <h2 className="text-lg font-semibold text-hush-text-primary text-center mb-6">
          What kind of group do you want to create?
        </h2>

        {/* Card Container - uses listbox role for accessibility */}
        <div
          role="listbox"
          aria-label="Group type selection"
          aria-orientation="horizontal"
          onKeyDown={handleKeyDown}
          className="flex flex-col md:flex-row gap-4"
        >
          {/* Public Card */}
          <div className="flex-1" ref={publicCardRef}>
            <TypeSelectionCard
              {...PUBLIC_CARD_CONTENT}
              selected={selectedType === "public"}
              onSelect={handleSelectPublic}
            />
          </div>

          {/* Private Card */}
          <div className="flex-1" ref={privateCardRef}>
            <TypeSelectionCard
              {...PRIVATE_CARD_CONTENT}
              selected={selectedType === "private"}
              onSelect={handleSelectPrivate}
            />
          </div>
        </div>
      </div>

      {/* Footer with Next Button */}
      <div className="flex-shrink-0 p-4 border-t border-hush-bg-hover">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="w-full px-6 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Proceed to next step"
        >
          Next
        </button>
      </div>
    </div>
  );
});

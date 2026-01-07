"use client";

import { memo, useCallback } from "react";
import { Globe, Lock, Check } from "lucide-react";

export type CardIconType = "globe" | "lock";

export interface TypeSelectionCardProps {
  icon: CardIconType;
  title: string;
  description: string;
  bullets: string[];
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * TypeSelectionCard - A selectable card for choosing group type.
 *
 * Used in the TypeSelectionStep to present Public vs Private group options.
 * Follows radiogroup option pattern for accessibility.
 */
export const TypeSelectionCard = memo(function TypeSelectionCard({
  icon,
  title,
  description,
  bullets,
  selected,
  onSelect,
  disabled = false,
}: TypeSelectionCardProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    [disabled, onSelect]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    onSelect();
  }, [disabled, onSelect]);

  const IconComponent = icon === "globe" ? Globe : Lock;

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        relative flex flex-col items-center p-6 rounded-xl border-2 cursor-pointer h-full
        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark
        ${
          selected
            ? "border-hush-purple bg-hush-purple/10"
            : "border-hush-bg-hover bg-hush-bg-dark hover:bg-hush-bg-hover"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-hush-purple flex items-center justify-center">
          <Check className="w-4 h-4 text-hush-bg-dark" strokeWidth={3} />
        </div>
      )}

      {/* Icon */}
      <div className="w-12 h-12 rounded-full bg-hush-bg-hover flex items-center justify-center mb-4">
        <IconComponent
          className={`w-6 h-6 ${selected ? "text-hush-purple" : "text-hush-text-accent"}`}
        />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-hush-text-accent text-center mb-4">
        {description}
      </p>

      {/* Bullet Points */}
      <ul className="space-y-2 w-full">
        {bullets.map((bullet, index) => (
          <li
            key={index}
            className="flex items-center gap-2 text-sm text-hush-text-accent"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-hush-purple flex-shrink-0" />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
});

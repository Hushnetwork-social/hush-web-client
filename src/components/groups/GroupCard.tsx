"use client";

import { memo } from "react";
import { Users, Loader2, Check, AlertCircle } from "lucide-react";
import type { PublicGroupInfo } from "@/types";

interface GroupCardProps {
  /** Public group information to display */
  group: PublicGroupInfo;
  /** Callback when join button is clicked */
  onJoin: () => void;
  /** Whether a join request is in progress */
  isJoining: boolean;
  /** Whether the current user is already a member */
  isJoined: boolean;
  /** Cooldown error message if join is blocked */
  cooldownError: string | null;
}

/**
 * Card component for displaying public groups in search results.
 * Shows group info and provides join functionality.
 */
export const GroupCard = memo(function GroupCard({
  group,
  onJoin,
  isJoining,
  isJoined,
  cooldownError,
}: GroupCardProps) {
  return (
    <div
      className="flex items-start gap-4 p-4 bg-hush-bg-element rounded-lg border border-hush-bg-hover hover:border-hush-purple/30 transition-colors"
      data-testid="group-card"
    >
      {/* Group Icon */}
      <div className="w-12 h-12 rounded-full bg-hush-purple/20 flex items-center justify-center flex-shrink-0">
        <Users className="w-6 h-6 text-hush-purple" aria-hidden="true" />
      </div>

      {/* Group Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-hush-text-primary truncate">
          {group.name}
        </h3>
        <p className="text-sm text-hush-text-accent">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        </p>
        {group.description && (
          <p className="text-sm text-hush-text-accent mt-1 line-clamp-2">
            {group.description}
          </p>
        )}
        {/* Cooldown Error */}
        {cooldownError && (
          <div className="flex items-center gap-1.5 mt-2 text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="text-xs">{cooldownError}</span>
          </div>
        )}
      </div>

      {/* Join Button / Joined Badge */}
      <div className="flex-shrink-0">
        {isJoined ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium">
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>Joined</span>
          </div>
        ) : (
          <button
            onClick={onJoin}
            disabled={isJoining || !!cooldownError}
            className="flex items-center gap-1.5 px-4 py-2 bg-hush-purple text-white rounded-lg text-sm font-medium hover:bg-hush-purple/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Join ${group.name}`}
          >
            {isJoining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Joining...</span>
              </>
            ) : (
              <span>Join</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
});

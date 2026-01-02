"use client";

import { memo, useCallback } from "react";
import { Ban, ShieldOff, ShieldCheck, Crown } from "lucide-react";
import type { GroupMemberRole } from "@/types";

// Action types for admin operations
type AdminAction = "block" | "unblock" | "ban" | "promote";

interface AdminActionButtonsProps {
  /** Public address of the member */
  memberAddress: string;
  /** Display name of the member (for accessibility) */
  memberName: string;
  /** Current role of the member */
  memberRole: GroupMemberRole;
  /** Callback when an action is triggered */
  onAction: (action: AdminAction, memberAddress: string) => void;
  /** Whether an action is currently in progress */
  isLoading?: boolean;
}

/**
 * Action buttons for admin moderation operations.
 * Shows different buttons based on member's current role:
 * - Member: Block, Ban, Promote
 * - Blocked: Unblock, Ban
 * - Admin: No actions (handled by parent)
 */
export const AdminActionButtons = memo(function AdminActionButtons({
  memberAddress,
  memberName,
  memberRole,
  onAction,
  isLoading = false,
}: AdminActionButtonsProps) {
  const handleBlock = useCallback(() => {
    onAction("block", memberAddress);
  }, [onAction, memberAddress]);

  const handleUnblock = useCallback(() => {
    onAction("unblock", memberAddress);
  }, [onAction, memberAddress]);

  const handleBan = useCallback(() => {
    onAction("ban", memberAddress);
  }, [onAction, memberAddress]);

  const handlePromote = useCallback(() => {
    onAction("promote", memberAddress);
  }, [onAction, memberAddress]);

  // Don't show actions for admins (handled by parent component)
  if (memberRole === "Admin") {
    return null;
  }

  const isBlocked = memberRole === "Blocked";

  return (
    <div className="flex items-center gap-1">
      {/* Block/Unblock button */}
      {isBlocked ? (
        <button
          onClick={handleUnblock}
          disabled={isLoading}
          className="p-1.5 rounded-md text-hush-text-accent hover:bg-hush-bg-hover hover:text-green-400 transition-colors disabled:opacity-50"
          title={`Unblock ${memberName}`}
          aria-label={`Unblock ${memberName}`}
        >
          <ShieldCheck className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleBlock}
          disabled={isLoading}
          className="p-1.5 rounded-md text-hush-text-accent hover:bg-hush-bg-hover hover:text-yellow-400 transition-colors disabled:opacity-50"
          title={`Block ${memberName}`}
          aria-label={`Block ${memberName}`}
        >
          <ShieldOff className="w-4 h-4" />
        </button>
      )}

      {/* Ban button - always shown for non-admins */}
      <button
        onClick={handleBan}
        disabled={isLoading}
        className="p-1.5 rounded-md text-hush-text-accent hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
        title={`Ban ${memberName}`}
        aria-label={`Ban ${memberName}`}
      >
        <Ban className="w-4 h-4" />
      </button>

      {/* Promote button - only for regular members (not blocked) */}
      {!isBlocked && (
        <button
          onClick={handlePromote}
          disabled={isLoading}
          className="p-1.5 rounded-md text-hush-text-accent hover:bg-hush-purple/20 hover:text-hush-purple transition-colors disabled:opacity-50"
          title={`Promote ${memberName} to admin`}
          aria-label={`Promote ${memberName} to admin`}
        >
          <Crown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

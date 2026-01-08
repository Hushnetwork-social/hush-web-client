"use client";

import { memo } from "react";
import { Ban, ShieldOff, ShieldCheck, Crown } from "lucide-react";
import type { GroupMemberRole } from "@/types";

// Action types for admin operations
export type AdminAction = "block" | "unblock" | "ban" | "promote";

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

// Tooltip text for each action (coming soon features)
const TOOLTIPS = {
  block: `Block (Coming Soon)

Temporarily restricts this member from participating in the group.
Blocked members can still see messages but cannot send messages
or react for approximately 100 blocks (~16 minutes).`,

  unblock: `Unblock (Coming Soon)

Restore this member's ability to participate in the group.
They will be able to send messages and react again.`,

  ban: `Ban (Coming Soon)

Remove this member from the group entirely. For public groups,
they may rejoin after approximately 100 blocks (~16 minutes).
For private groups, they can only return if invited again
after the cooldown period.`,

  promote: `Promote to Admin (Coming Soon)

Grant this member administrative privileges. Admins can manage
group settings, moderate members, and help maintain the group.`,
};

/**
 * Action buttons for admin moderation operations.
 * Shows different buttons based on member's current role:
 * - Member: Block, Ban, Promote
 * - Blocked: Unblock, Ban
 * - Admin: No actions (handled by parent)
 *
 * NOTE: These features are not yet implemented. Buttons are visible
 * with tooltips explaining what they will do when available.
 */
export const AdminActionButtons = memo(function AdminActionButtons({
  memberRole,
}: AdminActionButtonsProps) {
  // Don't show actions for admins (handled by parent component)
  if (memberRole === "Admin") {
    return null;
  }

  const isBlocked = memberRole === "Blocked";

  // Common button style for "coming soon" features - slightly muted
  const comingSoonButtonClass =
    "p-1.5 rounded-md text-hush-text-accent/60 hover:text-hush-text-accent hover:bg-hush-bg-hover transition-colors cursor-help";

  return (
    <div className="flex items-center gap-1">
      {/* Block/Unblock button */}
      {isBlocked ? (
        <button
          type="button"
          className={comingSoonButtonClass}
          title={TOOLTIPS.unblock}
          aria-label="Unblock member (coming soon)"
        >
          <ShieldCheck className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          className={comingSoonButtonClass}
          title={TOOLTIPS.block}
          aria-label="Block member (coming soon)"
        >
          <ShieldOff className="w-4 h-4" />
        </button>
      )}

      {/* Ban button - always shown for non-admins */}
      <button
        type="button"
        className={comingSoonButtonClass}
        title={TOOLTIPS.ban}
        aria-label="Ban member (coming soon)"
      >
        <Ban className="w-4 h-4" />
      </button>

      {/* Promote button - only for regular members (not blocked) */}
      {!isBlocked && (
        <button
          type="button"
          className={comingSoonButtonClass}
          title={TOOLTIPS.promote}
          aria-label="Promote to admin (coming soon)"
        >
          <Crown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

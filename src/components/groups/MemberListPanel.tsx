"use client";

import { memo, useMemo, useCallback, useState } from "react";
import { X, Users, Loader2, UserPlus } from "lucide-react";
import { RoleBadge } from "./RoleBadge";
import { AdminActionButtons } from "./AdminActionButtons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AddMemberDialog } from "./AddMemberDialog";
import { groupService } from "@/lib/grpc/services/group";
import { useFeedsStore } from "@/modules/feeds";
import type { GroupFeedMember, GroupMemberRole } from "@/types";

// Constants for display
const TRUNCATED_KEY_LENGTH = 10;
const TRUNCATION_SUFFIX = "...";

// Action types for admin operations
type AdminAction = "block" | "unblock" | "ban" | "promote";

interface MemberListPanelProps {
  /** Controls panel visibility */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Feed ID for the group */
  feedId: string;
  /** Current user's public signing address */
  currentUserAddress: string;
  /** Current user's role in the group */
  currentUserRole: GroupMemberRole;
  /** List of group members */
  members: GroupFeedMember[];
}

interface PendingAction {
  action: AdminAction;
  memberAddress: string;
  memberName: string;
}

/**
 * Slide-in panel showing all group members with their roles.
 * Admins can perform moderation actions (block, unblock, ban, promote).
 */
export const MemberListPanel = memo(function MemberListPanel({
  isOpen,
  onClose,
  feedId,
  currentUserAddress,
  currentUserRole,
  members,
}: MemberListPanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  // Get store update function
  const updateGroupMember = useFeedsStore((state) => state.updateGroupMember);
  const removeGroupMember = useFeedsStore((state) => state.removeGroupMember);

  // Check if current user is admin
  const isAdmin = currentUserRole === "Admin";

  // Sort members: Admins first, then Members, then Blocked
  const sortedMembers = useMemo(() => {
    const roleOrder: Record<GroupMemberRole, number> = {
      Admin: 0,
      Member: 1,
      Blocked: 2,
    };
    return [...members].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  }, [members]);

  // Get display name with fallback
  const getDisplayName = useCallback((member: GroupFeedMember): string => {
    return member.displayName || member.publicAddress.substring(0, TRUNCATED_KEY_LENGTH) + TRUNCATION_SUFFIX;
  }, []);

  // Get initials for avatar
  const getInitials = useCallback((member: GroupFeedMember): string => {
    const name = member.displayName || member.publicAddress;
    if (member.displayName) {
      return member.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return name.substring(0, 2).toUpperCase();
  }, []);

  // Check if actions should be shown for a member
  const canShowActionsFor = useCallback(
    (member: GroupFeedMember): boolean => {
      // Only admins can see action buttons
      if (!isAdmin) return false;
      // Can't take action on self
      if (member.publicAddress === currentUserAddress) return false;
      // Can't take action on other admins
      if (member.role === "Admin") return false;
      return true;
    },
    [isAdmin, currentUserAddress]
  );

  // Execute the action (called directly or after confirmation)
  const executeAction = useCallback(
    async (action: AdminAction, memberAddress: string) => {
      setLoadingAction(memberAddress);
      setError(null);

      try {
        let result;
        switch (action) {
          case "block":
            result = await groupService.blockMember(feedId, currentUserAddress, memberAddress);
            if (result.success) {
              updateGroupMember(feedId, memberAddress, { role: "Blocked" });
            }
            break;
          case "unblock":
            result = await groupService.unblockMember(feedId, currentUserAddress, memberAddress);
            if (result.success) {
              updateGroupMember(feedId, memberAddress, { role: "Member" });
            }
            break;
          case "ban":
            result = await groupService.banMember(feedId, currentUserAddress, memberAddress);
            if (result.success) {
              removeGroupMember(feedId, memberAddress);
            }
            break;
          case "promote":
            result = await groupService.promoteToAdmin(feedId, currentUserAddress, memberAddress);
            if (result.success) {
              updateGroupMember(feedId, memberAddress, { role: "Admin" });
            }
            break;
        }

        if (!result?.success) {
          setError(result?.error || `Failed to ${action} member`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action} member`);
      } finally {
        setLoadingAction(null);
        setPendingAction(null);
      }
    },
    [feedId, currentUserAddress, updateGroupMember, removeGroupMember]
  );

  // Handle admin action
  const handleAction = useCallback(
    async (action: AdminAction, memberAddress: string) => {
      // For destructive actions, show confirmation dialog
      if (action === "ban" || action === "promote") {
        const member = members.find((m) => m.publicAddress === memberAddress);
        if (member) {
          setPendingAction({
            action,
            memberAddress,
            memberName: getDisplayName(member),
          });
        }
        return;
      }

      // Execute action directly for block/unblock
      await executeAction(action, memberAddress);
    },
    [members, getDisplayName, executeAction]
  );

  // Handle confirmation dialog confirm
  const handleConfirm = useCallback(() => {
    if (pendingAction) {
      executeAction(pendingAction.action, pendingAction.memberAddress);
    }
  }, [pendingAction, executeAction]);

  // Handle confirmation dialog cancel
  const handleCancelConfirm = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Get confirmation dialog content based on action
  const getConfirmationContent = useCallback(() => {
    if (!pendingAction) return { title: "", message: "" };

    switch (pendingAction.action) {
      case "ban":
        return {
          title: "Ban Member",
          message: `Are you sure you want to ban ${pendingAction.memberName} from this group? They will be permanently removed and cannot rejoin.`,
        };
      case "promote":
        return {
          title: "Promote to Admin",
          message: `Are you sure you want to promote ${pendingAction.memberName} to admin? They will have full moderation powers.`,
        };
      default:
        return { title: "", message: "" };
    }
  }, [pendingAction]);

  if (!isOpen) return null;

  const confirmContent = getConfirmationContent();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-hush-bg-dark border-l border-hush-bg-element shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hush-bg-element">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-hush-purple" aria-hidden="true" />
            <h2 id="member-panel-title" className="text-lg font-semibold text-hush-text-primary">
              Members ({members.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Add Member button - admin only */}
            {isAdmin && (
              <button
                onClick={() => setShowAddMemberDialog(true)}
                className="p-2 rounded-lg text-hush-purple hover:bg-hush-bg-hover transition-colors"
                aria-label="Add member"
                title="Add member"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
              aria-label="Close member panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 overflow-y-auto">
          {sortedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Users className="w-12 h-12 text-hush-text-accent/50 mb-2" />
              <p className="text-hush-text-accent">No members found</p>
            </div>
          ) : (
            <ul className="divide-y divide-hush-bg-element">
              {sortedMembers.map((member) => {
                const isSelf = member.publicAddress === currentUserAddress;
                const isLoading = loadingAction === member.publicAddress;

                return (
                  <li
                    key={member.publicAddress}
                    className="px-4 py-3 hover:bg-hush-bg-hover/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-hush-bg-element flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-hush-text-accent">
                          {getInitials(member)}
                        </span>
                      </div>

                      {/* Name and role */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-hush-text-primary truncate">
                            {getDisplayName(member)}
                          </span>
                          {isSelf && (
                            <span className="text-xs text-hush-text-accent">(you)</span>
                          )}
                          <RoleBadge role={member.role} size="sm" />
                        </div>
                        <p className="text-xs text-hush-text-accent truncate">
                          {member.publicAddress.substring(0, 20)}...
                        </p>
                      </div>

                      {/* Action buttons (admin only, not for self or other admins) */}
                      {canShowActionsFor(member) && (
                        <div className="flex-shrink-0">
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 text-hush-purple animate-spin" />
                          ) : (
                            <AdminActionButtons
                              memberAddress={member.publicAddress}
                              memberName={getDisplayName(member)}
                              memberRole={member.role}
                              onAction={handleAction}
                              isLoading={isLoading}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={confirmContent.title}
        message={confirmContent.message}
        confirmLabel={pendingAction?.action === "ban" ? "Ban Member" : "Promote"}
        variant={pendingAction?.action === "ban" ? "danger" : "default"}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        isOpen={showAddMemberDialog}
        onClose={() => setShowAddMemberDialog(false)}
        feedId={feedId}
        adminAddress={currentUserAddress}
        currentMembers={members}
      />
    </>
  );
});

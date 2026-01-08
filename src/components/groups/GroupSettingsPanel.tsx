"use client";

import { memo, useState, useCallback, useMemo, useEffect } from "react";
import { X, Settings, Globe, Lock, LogOut, Trash2, Loader2, Link, Copy, Check } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { groupService } from "@/lib/grpc/services/group";
import { useFeedsStore } from "@/modules/feeds";
import type { GroupMemberRole } from "@/types";

interface GroupSettingsPanelProps {
  /** Controls panel visibility */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Feed ID for the group */
  feedId: string;
  /** Current group name */
  groupName: string;
  /** Current group description */
  groupDescription: string;
  /** Whether the group is public */
  isPublic: boolean;
  /** Invite code for public groups */
  inviteCode?: string;
  /** Current user's role in the group */
  currentUserRole: GroupMemberRole;
  /** Current user's public address */
  currentUserAddress: string;
  /** Whether current user is the last admin */
  isLastAdmin: boolean;
  /** Callback when user leaves the group */
  onLeave: () => void;
  /** Callback when group is deleted */
  onDelete: () => void;
  /** Callback when group info is updated */
  onUpdate?: (name: string, description: string, isPublic: boolean) => void;
}

/**
 * Slide-in panel for group settings.
 * Admins can edit name/description, all users can leave.
 * Any admin can delete the group.
 */
export const GroupSettingsPanel = memo(function GroupSettingsPanel({
  isOpen,
  onClose,
  feedId,
  groupName,
  groupDescription,
  isPublic,
  inviteCode,
  currentUserRole,
  currentUserAddress,
  isLastAdmin: _isLastAdmin,
  onLeave,
  onDelete,
  onUpdate,
}: GroupSettingsPanelProps) {
  // Form state
  const [name, setName] = useState(groupName);
  const [description, setDescription] = useState(groupDescription);
  const [visibility, setVisibility] = useState(isPublic);

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Copy state for invite link
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Confirmation dialog states
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Check if current user is admin
  const isAdmin = currentUserRole === "Admin";

  // Generate invite URL based on current window location
  const inviteUrl = useMemo(() => {
    if (!inviteCode || typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/join/${inviteCode}`;
  }, [inviteCode]);

  // Handle copy invite link
  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [inviteUrl]);

  // Handle copy invite code
  const handleCopyCode = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [inviteCode]);

  // Get store functions for leave and delete operations
  const removeGroupMember = useFeedsStore((state) => state.removeGroupMember);
  const removeFeed = useFeedsStore((state) => state.removeFeed);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return name !== groupName || description !== groupDescription || visibility !== isPublic;
  }, [name, description, visibility, groupName, groupDescription, isPublic]);

  // Reset form when panel opens/closes or group data changes
  useEffect(() => {
    if (isOpen) {
      setName(groupName);
      setDescription(groupDescription);
      setVisibility(isPublic);
      setError(null);
    }
  }, [isOpen, groupName, groupDescription, isPublic]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isAdmin || !hasChanges) return;

    setIsSaving(true);
    setError(null);

    try {
      // Build settings object with only changed fields
      const settings: { newTitle?: string; newDescription?: string; isPublic?: boolean } = {};

      if (name !== groupName) {
        settings.newTitle = name;
      }

      if (description !== groupDescription) {
        settings.newDescription = description;
      }

      if (visibility !== isPublic) {
        settings.isPublic = visibility;
      }

      // Single API call to update all changed settings
      console.log('[GroupSettingsPanel] Calling updateSettings with:', { feedId, settings });
      const result = await groupService.updateSettings(feedId, currentUserAddress, settings);
      console.log('[GroupSettingsPanel] updateSettings result:', result);
      if (!result.success) {
        setError(result.error || "Failed to update settings");
        setIsSaving(false);
        return;
      }

      // Notify parent of update
      console.log('[GroupSettingsPanel] Settings updated successfully, notifying parent');
      onUpdate?.(name, description, visibility);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [isAdmin, hasChanges, name, description, visibility, groupName, groupDescription, isPublic, feedId, currentUserAddress, onUpdate, onClose]);

  // Handle leave group
  const handleLeave = useCallback(async () => {
    setIsLeaving(true);
    setError(null);

    try {
      const result = await groupService.leaveGroup(feedId, currentUserAddress);
      if (result.success) {
        // Remove the current user from the group members in the store
        // This ensures the UI immediately reflects that the user left
        removeGroupMember(feedId, currentUserAddress);
        setShowLeaveConfirm(false);
        onLeave();
        onClose();
      } else {
        setError(result.error || "Failed to leave group");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
    } finally {
      setIsLeaving(false);
    }
  }, [feedId, currentUserAddress, removeGroupMember, onLeave, onClose]);

  // Handle delete group
  const handleDelete = useCallback(async () => {
    if (deleteConfirmText !== groupName) {
      setError("Please type the group name to confirm deletion");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await groupService.deleteGroup(feedId, currentUserAddress);
      if (result.success) {
        // Remove the feed from the store immediately
        removeFeed(feedId);
        setShowDeleteConfirm(false);
        onDelete();
        onClose();
      } else {
        setError(result.error || "Failed to delete group");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmText, groupName, feedId, currentUserAddress, removeFeed, onDelete, onClose]);

  // Open leave confirmation
  const handleLeaveClick = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  // Open delete confirmation
  const handleDeleteClick = useCallback(() => {
    setDeleteConfirmText("");
    setShowDeleteConfirm(true);
  }, []);

  // Close leave confirmation
  const handleCancelLeave = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  // Close delete confirmation
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
  }, []);

  if (!isOpen) return null;

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
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-hush-bg-dark border-l border-hush-bg-element shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hush-bg-element">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-hush-purple" aria-hidden="true" />
            <h2 id="settings-panel-title" className="text-lg font-semibold text-hush-text-primary">
              Group Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
            aria-label="Close settings panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Group Info Section */}
          <section>
            <h3 className="text-sm font-medium text-hush-text-accent mb-3">Group Information</h3>
            <div className="space-y-4">
              {/* Name field */}
              <div>
                <label
                  htmlFor="group-name"
                  className="block text-sm font-medium text-hush-text-primary mb-1"
                >
                  Name
                </label>
                <input
                  id="group-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin}
                  maxLength={100}
                  className="w-full px-3 py-2 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-primary placeholder-hush-text-accent/50 focus:outline-none focus:ring-2 focus:ring-hush-purple/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Description field */}
              <div>
                <label
                  htmlFor="group-description"
                  className="block text-sm font-medium text-hush-text-primary mb-1"
                >
                  Description
                </label>
                <textarea
                  id="group-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isAdmin}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-primary placeholder-hush-text-accent/50 focus:outline-none focus:ring-2 focus:ring-hush-purple/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                />
              </div>
            </div>
          </section>

          {/* Visibility Section */}
          <section>
            <h3 className="text-sm font-medium text-hush-text-accent mb-3">Visibility</h3>
            {isAdmin ? (
              <div className="space-y-2">
                {/* Public option */}
                <button
                  type="button"
                  onClick={() => setVisibility(true)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    visibility
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-hush-bg-element border-hush-bg-hover hover:bg-hush-bg-hover"
                  }`}
                >
                  <Globe className={`w-5 h-5 ${visibility ? "text-green-400" : "text-hush-text-accent"}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${visibility ? "text-green-400" : "text-hush-text-primary"}`}>Public Group</p>
                    <p className="text-xs text-hush-text-accent">Anyone can find and join this group</p>
                  </div>
                  {visibility && (
                    <div className="ml-auto w-4 h-4 rounded-full bg-green-400 flex items-center justify-center">
                      <span className="text-hush-bg-dark text-xs">✓</span>
                    </div>
                  )}
                </button>
                {/* Private option */}
                <button
                  type="button"
                  onClick={() => setVisibility(false)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    !visibility
                      ? "bg-hush-purple/10 border-hush-purple/30"
                      : "bg-hush-bg-element border-hush-bg-hover hover:bg-hush-bg-hover"
                  }`}
                >
                  <Lock className={`w-5 h-5 ${!visibility ? "text-hush-purple" : "text-hush-text-accent"}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${!visibility ? "text-hush-purple" : "text-hush-text-primary"}`}>Private Group</p>
                    <p className="text-xs text-hush-text-accent">Only invited members can join</p>
                  </div>
                  {!visibility && (
                    <div className="ml-auto w-4 h-4 rounded-full bg-hush-purple flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-hush-bg-element rounded-lg">
                {isPublic ? (
                  <>
                    <Globe className="w-5 h-5 text-green-400" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-hush-text-primary">Public Group</p>
                      <p className="text-xs text-hush-text-accent">Anyone can find and join this group</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 text-hush-text-accent" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-hush-text-primary">Private Group</p>
                      <p className="text-xs text-hush-text-accent">Only invited members can join</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Invite Link Section (only for public groups) */}
          {(isPublic || visibility) && inviteCode && (
            <section>
              <h3 className="text-sm font-medium text-hush-text-accent mb-3 flex items-center gap-2">
                <Link className="w-4 h-4" aria-hidden="true" />
                Invite Link
              </h3>
              <div className="space-y-3">
                {/* Invite URL */}
                <div>
                  <label className="block text-xs text-hush-text-accent mb-1">Shareable Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-primary text-sm font-mono truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-hush-purple/20 border border-hush-purple/30 rounded-lg text-hush-purple hover:bg-hush-purple/30 transition-colors flex items-center gap-1.5"
                      title="Copy link"
                    >
                      {copiedLink ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span className="text-sm">{copiedLink ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Invite Code */}
                <div>
                  <label className="block text-xs text-hush-text-accent mb-1">Invite Code (for manual entry)</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-primary text-lg font-mono tracking-widest text-center">
                      {inviteCode}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-2 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors flex items-center gap-1.5"
                      title="Copy code"
                    >
                      {copiedCode ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-hush-text-accent">
                  Share this link or code with others to invite them to join this group.
                </p>
              </div>
            </section>
          )}

          {/* Danger Zone */}
          <section>
            <h3 className="text-sm font-medium text-red-400 mb-3">Danger Zone</h3>
            <div className="space-y-3">
              {/* Leave Group */}
              <button
                onClick={handleLeaveClick}
                disabled={isLeaving}
                className="w-full flex items-center gap-3 px-4 py-3 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-primary hover:bg-hush-bg-hover transition-colors disabled:opacity-50"
              >
                <LogOut className="w-5 h-5 text-hush-text-accent" aria-hidden="true" />
                <div className="text-left">
                  <p className="text-sm font-medium">Leave Group</p>
                  <p className="text-xs text-hush-text-accent">
                    You will no longer receive messages from this group.
                    {isPublic
                      ? " You can rejoin after ~100 blocks (~16 minutes)."
                      : " You can only be re-invited after ~100 blocks (~16 minutes)."}
                  </p>
                </div>
              </button>

              {/* Delete Group (any admin can delete) */}
              {isAdmin && (
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" aria-hidden="true" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Delete Group</p>
                    <p className="text-xs text-red-400/70">This action cannot be undone</p>
                  </div>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Footer with Save button (admin only, when changes made) */}
        {isAdmin && hasChanges && (
          <div className="px-4 py-3 border-t border-hush-bg-element">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-hush-purple text-white font-medium rounded-lg hover:bg-hush-purple/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Leave Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        title="Leave Group"
        message={`Are you sure you want to leave "${groupName}"? You will no longer receive messages from this group.${
          isPublic
            ? " You can rejoin after approximately 100 blocks (~16 minutes)."
            : " You can only be re-invited after approximately 100 blocks (~16 minutes)."
        }`}
        confirmLabel={isLeaving ? "Leaving..." : "Leave Group"}
        variant="danger"
        onConfirm={handleLeave}
        onCancel={handleCancelLeave}
      />

      {/* Delete Confirmation Dialog (custom with text input) */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={handleCancelDelete}
            aria-hidden="true"
          />
          <div
            className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-hush-bg-dark border border-hush-bg-element rounded-xl shadow-2xl p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-hush-text-primary mb-2">
              Delete Group
            </h2>
            <p id="delete-dialog-description" className="text-sm text-hush-text-accent mb-4">
              This action cannot be undone. All messages and members will be permanently removed.
            </p>
            <p className="text-sm text-hush-text-primary mb-2">
              Type <strong className="text-red-400">{groupName}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-hush-bg-element border border-hush-bg-hover rounded-lg text-hush-text-primary placeholder-hush-text-accent/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 mb-4"
              placeholder="Type group name here"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-4 py-2 bg-hush-bg-element text-hush-text-primary rounded-lg hover:bg-hush-bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting || deleteConfirmText !== groupName}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Group</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});

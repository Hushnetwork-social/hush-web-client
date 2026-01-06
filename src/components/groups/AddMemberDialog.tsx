"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { X, Search, Loader2, UserPlus, Check, AlertCircle } from "lucide-react";
import { searchByDisplayName } from "@/modules/identity";
import { addMemberToGroup } from "@/lib/crypto/group-transactions";
import { syncGroupMembers, syncKeyGenerations } from "@/lib/sync/group-sync";
import { useAppStore } from "@/stores";
import type { ProfileSearchResult, GroupFeedMember } from "@/types";
import { debugLog, debugError } from "@/lib/debug-logger";

// Constants for display
const TRUNCATED_KEY_LENGTH = 10;
const TRUNCATION_SUFFIX = "...";

interface AddMemberDialogProps {
  /** Controls dialog visibility */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Feed ID for the group */
  feedId: string;
  /** Admin's public signing address */
  adminAddress: string;
  /** Current members to exclude from search results */
  currentMembers: GroupFeedMember[];
  /** Callback when member is successfully added */
  onMemberAdded?: (member: GroupFeedMember) => void;
}

type DialogState = "search" | "confirm" | "adding" | "success" | "error";

/**
 * Dialog for admins to add new members to a group.
 * Provides member search and confirmation flow.
 */
export const AddMemberDialog = memo(function AddMemberDialog({
  isOpen,
  onClose,
  feedId,
  adminAddress,
  currentMembers,
  onMemberAdded,
}: AddMemberDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProfileSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);


  // Get current ACTIVE member addresses for filtering (exclude members who have left)
  // Members who left (have leftAtBlock set) should be searchable for re-adding
  const currentMemberAddresses = useMemo(
    () => new Set(currentMembers.filter((m) => !m.leftAtBlock).map((m) => m.publicAddress)),
    [currentMembers]
  );

  // Truncate address for display
  const truncateAddress = (address: string): string => {
    if (address.length <= 20) return address;
    return `${address.slice(0, TRUNCATED_KEY_LENGTH)}${TRUNCATION_SUFFIX}`;
  };

  // Get initials from display name
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a name to search");
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      debugLog("[AddMemberDialog] Searching for:", searchQuery);
      const results = await searchByDisplayName(searchQuery);

      // Filter out current members and self
      const filteredResults = results.filter(
        (profile) =>
          !currentMemberAddresses.has(profile.publicSigningAddress) &&
          profile.publicSigningAddress !== adminAddress
      );

      setSearchResults(filteredResults);
      debugLog("[AddMemberDialog] Found", filteredResults.length, "results");
    } catch (err) {
      debugError("[AddMemberDialog] Search failed:", err);
      setError("Failed to search. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, currentMemberAddresses, adminAddress]);

  // Handle Enter key in search input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Handle member selection
  const handleSelectMember = useCallback((profile: ProfileSearchResult) => {
    setSelectedMember(profile);
    setDialogState("confirm");
  }, []);

  // Handle back to search
  const handleBackToSearch = useCallback(() => {
    setSelectedMember(null);
    setDialogState("search");
    setError(null);
  }, []);

  // Handle close and reset
  const handleClose = useCallback(() => {
    setDialogState("search");
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setSelectedMember(null);
    setError(null);
    onClose();
  }, [onClose]);

  // Handle confirm add member
  const handleConfirmAdd = useCallback(async () => {
    if (!selectedMember) return;

    setDialogState("adding");
    setError(null);

    try {
      debugLog("[AddMemberDialog] Adding member:", selectedMember.publicSigningAddress);

      const result = await addMemberToGroup(
        feedId,
        adminAddress,
        selectedMember.publicSigningAddress
      );

      if (!result.success) {
        setError(result.error || "Failed to add member");
        setDialogState("error");
        return;
      }

      // Refresh members and KeyGenerations from server to get complete data
      // This ensures the system message "X joined the group" appears immediately
      debugLog("[AddMemberDialog] Syncing group data from server...");

      // Get credentials for KeyGeneration sync
      const credentials = useAppStore.getState().credentials;

      // Sync both members and KeyGenerations in parallel
      const [membersResult, keysResult] = await Promise.all([
        syncGroupMembers(feedId, adminAddress),
        credentials?.encryptionPrivateKey
          ? syncKeyGenerations(feedId, adminAddress, credentials.encryptionPrivateKey)
          : Promise.resolve({ success: false, error: 'No encryption key' }),
      ]);

      debugLog("[AddMemberDialog] Sync results:", {
        membersSuccess: membersResult.success,
        keysSuccess: keysResult.success,
      });

      if (membersResult.success && membersResult.members) {
        // Find the newly added member from the synced data
        const newMember = membersResult.members.find(
          m => m.publicAddress === selectedMember.publicSigningAddress
        );
        if (newMember) {
          onMemberAdded?.(newMember);
        }
      }

      setDialogState("success");

      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      debugError("[AddMemberDialog] Add member failed:", err);
      setError(err instanceof Error ? err.message : "Failed to add member");
      setDialogState("error");
    }
  }, [selectedMember, feedId, adminAddress, onMemberAdded, handleClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
      >
        <div
          className="w-full max-w-md bg-hush-bg-dark border border-hush-bg-element rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hush-bg-element">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-hush-purple" aria-hidden="true" />
              <h2 id="add-member-title" className="text-lg font-semibold text-hush-text-primary">
                Add Member
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content based on state */}
          {dialogState === "search" && (
            <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
              {/* Search Input */}
              <div className="flex-shrink-0 p-4 border-b border-hush-bg-element">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Search by name..."
                      className="w-full bg-hush-bg-element border border-hush-bg-hover rounded-xl px-4 py-2.5 pl-10 text-sm text-hush-text-primary placeholder-hush-text-accent focus:outline-none focus:border-hush-purple"
                      disabled={isSearching}
                      aria-label="Search for members"
                      autoFocus
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hush-text-accent" />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Search"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Search"
                    )}
                  </button>
                </div>

                {error && (
                  <p className="mt-2 text-sm text-red-400" role="alert">
                    {error}
                  </p>
                )}
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "300px" }}>
                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-hush-purple mr-2" />
                    <span className="text-sm text-hush-text-accent">Searching...</span>
                  </div>
                )}

                {!isSearching && !hasSearched && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="w-12 h-12 text-hush-text-accent/50 mb-4" />
                    <p className="text-sm text-hush-text-accent">
                      Search for users by their display name
                    </p>
                  </div>
                )}

                {!isSearching && hasSearched && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <UserPlus className="w-12 h-12 text-hush-text-accent/50 mb-4" />
                    <h3 className="text-base font-semibold text-hush-text-primary mb-2">
                      No users found
                    </h3>
                    <p className="text-sm text-hush-text-accent max-w-[280px]">
                      Try a different search term. Users already in the group are excluded.
                    </p>
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((profile) => (
                      <button
                        key={profile.publicSigningAddress}
                        onClick={() => handleSelectMember(profile)}
                        className="w-full flex items-center p-3 rounded-xl border border-hush-bg-hover bg-hush-bg-element hover:bg-hush-bg-hover hover:border-hush-purple transition-colors text-left"
                        aria-label={`Add ${profile.displayName} to group`}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-hush-bg-dark">
                            {getInitials(profile.displayName)}
                          </span>
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 min-w-0 ml-3">
                          <span className="text-sm font-semibold text-hush-text-primary truncate block">
                            {profile.displayName}
                          </span>
                          <span className="text-xs text-hush-text-accent truncate block">
                            {truncateAddress(profile.publicSigningAddress)}
                          </span>
                        </div>

                        {/* Add icon */}
                        <UserPlus className="w-5 h-5 text-hush-purple ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {dialogState === "confirm" && selectedMember && (
            <div className="p-6">
              <div className="flex flex-col items-center text-center mb-6">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full bg-hush-purple flex items-center justify-center mb-4">
                  <span className="text-xl font-bold text-hush-bg-dark">
                    {getInitials(selectedMember.displayName)}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-hush-text-primary mb-1">
                  {selectedMember.displayName}
                </h3>
                <p className="text-sm text-hush-text-accent">
                  {truncateAddress(selectedMember.publicSigningAddress)}
                </p>
              </div>

              <p className="text-sm text-hush-text-accent text-center mb-6">
                Are you sure you want to add this user to the group? They will be able to see messages and participate immediately.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleBackToSearch}
                  className="flex-1 px-4 py-2.5 border border-hush-bg-hover text-hush-text-primary rounded-xl font-medium text-sm hover:bg-hush-bg-hover transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmAdd}
                  className="flex-1 px-4 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover transition-colors"
                >
                  Add Member
                </button>
              </div>
            </div>
          )}

          {dialogState === "adding" && (
            <div className="p-6 flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-hush-purple animate-spin mb-4" />
              <p className="text-sm text-hush-text-accent">Adding member...</p>
            </div>
          )}

          {dialogState === "success" && (
            <div className="p-6 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-hush-text-primary mb-1">
                Member Added
              </h3>
              <p className="text-sm text-hush-text-accent">
                {selectedMember?.displayName} is now a member of this group.
              </p>
            </div>
          )}

          {dialogState === "error" && (
            <div className="p-6 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-hush-text-primary mb-1">
                Failed to Add Member
              </h3>
              <p className="text-sm text-red-400 text-center mb-4">
                {error || "An error occurred while adding the member."}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleBackToSearch}
                  className="flex-1 px-4 py-2.5 border border-hush-bg-hover text-hush-text-primary rounded-xl font-medium text-sm hover:bg-hush-bg-hover transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-hush-bg-element text-hush-text-primary rounded-xl font-medium text-sm hover:bg-hush-bg-hover transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

"use client";

import { useState, useCallback, memo } from "react";
import { Search, Loader2, Check, Users } from "lucide-react";
import { searchByDisplayName } from "@/modules/identity";
import { useAppStore } from "@/stores";
import type { ProfileSearchResult } from "@/types";
import { debugLog, debugError } from "@/lib/debug-logger";

export interface SelectedMember {
  publicSigningAddress: string;
  publicEncryptAddress: string;
  displayName: string;
}

interface MemberSelectorProps {
  selectedMembers: SelectedMember[];
  onMembersChange: (members: SelectedMember[]) => void;
  onNext: () => void;
  onBack?: () => void;
}

/**
 * Member Selection Step of Group Creation Wizard
 *
 * Allows users to search for and select members to add to their new group.
 * Members are optional - groups can be created with 0 initial members.
 */
export const MemberSelector = memo(function MemberSelector({
  selectedMembers,
  onMembersChange,
  onNext,
  onBack,
}: MemberSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current user's address to exclude from results
  const credentials = useAppStore((state) => state.credentials);
  const ownAddress = credentials?.signingPublicKey;

  // Get initials from display name
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Truncate public address for display
  const truncateAddress = (address: string): string => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  // Check if a member is selected
  const isMemberSelected = useCallback(
    (address: string): boolean => {
      return selectedMembers.some((m) => m.publicSigningAddress === address);
    },
    [selectedMembers]
  );

  // Toggle member selection
  const toggleMember = useCallback(
    (profile: ProfileSearchResult) => {
      const isSelected = isMemberSelected(profile.publicSigningAddress);

      if (isSelected) {
        // Remove member
        onMembersChange(
          selectedMembers.filter(
            (m) => m.publicSigningAddress !== profile.publicSigningAddress
          )
        );
      } else {
        // Add member
        onMembersChange([
          ...selectedMembers,
          {
            publicSigningAddress: profile.publicSigningAddress,
            publicEncryptAddress: profile.publicEncryptAddress,
            displayName: profile.displayName,
          },
        ]);
      }
    },
    [selectedMembers, onMembersChange, isMemberSelected]
  );

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
      debugLog("[MemberSelector] Searching for:", searchQuery);
      const results = await searchByDisplayName(searchQuery);

      // Filter out current user from results
      const filteredResults = results.filter(
        (profile) => profile.publicSigningAddress !== ownAddress
      );

      setSearchResults(filteredResults);
      debugLog("[MemberSelector] Found", filteredResults.length, "results");
    } catch (err) {
      debugError("[MemberSelector] Search failed:", err);
      setError("Failed to search. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, ownAddress]);

  // Handle Enter key in search input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Members are optional - can proceed with 0 members
  const canProceed = true;

  return (
    <div className="flex flex-col h-full">
      {/* Header with Back Button */}
      {onBack && (
        <div className="flex-shrink-0 p-4 border-b border-hush-bg-hover">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-hush-text-accent hover:text-hush-text-primary transition-colors"
            aria-label="Go back to type selection"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="text-sm">Back to Type Selection</span>
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="flex-shrink-0 p-4 border-b border-hush-bg-hover">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name..."
              data-testid="member-search-input"
              className="w-full bg-hush-bg-dark border border-hush-bg-hover rounded-xl px-4 py-2.5 pl-10 text-sm text-hush-text-primary placeholder-hush-text-accent focus:outline-none focus:border-hush-purple"
              disabled={isSearching}
              aria-label="Search for members"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hush-text-accent" />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            data-testid="member-search-button"
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
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-hush-purple mr-2" />
            <span className="text-sm text-hush-text-accent">Searching...</span>
          </div>
        )}

        {!isSearching && hasSearched && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-hush-purple" />
            </div>
            <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
              No users found
            </h3>
            <p className="text-sm text-hush-text-accent max-w-[280px]">
              Try a different search term or check the spelling.
            </p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((profile) => {
              const isSelected = isMemberSelected(profile.publicSigningAddress);
              return (
                <button
                  key={profile.publicSigningAddress}
                  onClick={() => toggleMember(profile)}
                  data-testid={`member-result:${profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className={`w-full flex items-center p-3 rounded-xl border transition-colors text-left ${
                    isSelected
                      ? "border-hush-purple bg-hush-purple/10"
                      : "border-hush-bg-hover bg-hush-bg-dark hover:bg-hush-bg-hover"
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${profile.displayName}`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 flex-shrink-0 ${
                      isSelected
                        ? "border-hush-purple bg-hush-purple"
                        : "border-hush-text-accent"
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-hush-bg-dark" />
                    )}
                  </div>

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
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with Selected Count and Next Button */}
      <div className="flex-shrink-0 p-4 border-t border-hush-bg-hover">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-hush-text-accent block">
              Selected: {selectedMembers.length} member
              {selectedMembers.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-hush-text-accent">
              (optional - you can add members later)
            </span>
          </div>
          <button
            onClick={onNext}
            disabled={!canProceed}
            data-testid="member-next-button"
            className="px-6 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Proceed to next step"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
});

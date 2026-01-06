"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, MessageSquare, UserCheck, User, ArrowLeft, Users } from "lucide-react";
import { searchByDisplayName } from "@/modules/identity";
import { findExistingChatFeed, createChatFeed, useFeedsStore } from "@/modules/feeds";
import { groupService } from "@/lib/grpc/services/group";
import { useAppStore } from "@/stores";
import { GroupCard } from "@/components/groups/GroupCard";
import type { ProfileSearchResult, PublicGroupInfo } from "@/types";
import { debugLog, debugError } from "@/lib/debug-logger";

interface SearchResultWithFeed extends ProfileSearchResult {
  hasExistingFeed: boolean;
  existingFeedId?: string;
  isPersonalFeed: boolean;
  personalFeedId?: string;
}

// Tab types
type TabType = "users" | "publicGroups";

interface NewChatViewProps {
  onFeedCreated?: (feedId: string) => void;
  onFeedSelected?: (feedId: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function NewChatView({ onFeedCreated, onFeedSelected, onBack, showBackButton = false }: NewChatViewProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("users");

  // User search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultWithFeed[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Public groups search state
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [groupSearchResults, setGroupSearchResults] = useState<PublicGroupInfo[]>([]);
  const [hasSearchedGroups, setHasSearchedGroups] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Group join state
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [cooldownErrors, setCooldownErrors] = useState<Record<string, string>>({});

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

  // Handle user search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a profile name to search");
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const results = await searchByDisplayName(searchQuery);
      const credentials = useAppStore.getState().credentials;
      const feeds = useFeedsStore.getState().feeds;
      const ownAddress = credentials?.signingPublicKey;

      // Enrich results with existing feed info
      const enrichedResults: SearchResultWithFeed[] = results.map((profile) => {
        // Check if this is the current user's personal feed
        const isOwnProfile = profile.publicSigningAddress === ownAddress;

        if (isOwnProfile) {
          // Find personal feed
          const personalFeed = feeds.find((f) => f.type === 'personal');
          return {
            ...profile,
            hasExistingFeed: false,
            isPersonalFeed: true,
            personalFeedId: personalFeed?.id,
          };
        }

        // Check for existing chat feed with this user
        const existingFeed = findExistingChatFeed(profile.publicSigningAddress);
        return {
          ...profile,
          hasExistingFeed: !!existingFeed,
          existingFeedId: existingFeed?.id,
          isPersonalFeed: false,
        };
      });

      setSearchResults(enrichedResults);
    } catch (err) {
      debugError("[NewChatView] Search failed:", err);
      setError("Failed to search. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Check if a string looks like an invite code (6-12 alphanumeric chars)
  const looksLikeInviteCode = (query: string): boolean => {
    const normalized = query.trim().toUpperCase();
    return /^[A-Z0-9]{6,12}$/.test(normalized);
  };

  // Handle public group search
  const handleGroupSearch = useCallback(async () => {
    if (!groupSearchQuery.trim()) {
      setGroupError("Please enter a group name or invite code to search");
      return;
    }

    setIsSearchingGroups(true);
    setGroupError(null);
    setHasSearchedGroups(true);

    try {
      debugLog("[NewChatView] Searching public groups:", groupSearchQuery);
      const trimmedQuery = groupSearchQuery.trim();

      // If it looks like an invite code, try searching by code first
      let inviteCodeResult: PublicGroupInfo | null = null;
      if (looksLikeInviteCode(trimmedQuery)) {
        debugLog("[NewChatView] Query looks like invite code, searching by code...");
        inviteCodeResult = await groupService.getGroupByInviteCode(trimmedQuery);
        if (inviteCodeResult) {
          debugLog("[NewChatView] Found group by invite code:", inviteCodeResult.name);
        }
      }

      // Also search by name/description
      const results = await groupService.searchPublicGroups(trimmedQuery);
      debugLog("[NewChatView] Group search results:", results.length);

      // Combine results, putting invite code match first if found
      let combinedResults = results;
      if (inviteCodeResult) {
        // Check if the invite code result is already in the search results
        const alreadyInResults = results.some(r => r.feedId === inviteCodeResult!.feedId);
        if (!alreadyInResults) {
          // Add invite code result at the beginning
          combinedResults = [inviteCodeResult, ...results];
        } else {
          // Move the matching result to the front
          combinedResults = [
            inviteCodeResult,
            ...results.filter(r => r.feedId !== inviteCodeResult!.feedId),
          ];
        }
      }

      setGroupSearchResults(combinedResults);
    } catch (err) {
      debugError("[NewChatView] Group search failed:", err);
      setGroupError("Failed to search groups. Please try again.");
      setGroupSearchResults([]);
    } finally {
      setIsSearchingGroups(false);
    }
  }, [groupSearchQuery]);

  // Handle joining a group
  const handleJoinGroup = useCallback(async (group: PublicGroupInfo) => {
    const credentials = useAppStore.getState().credentials;
    if (!credentials?.signingPublicKey) {
      setGroupError("Please log in to join groups");
      return;
    }

    setJoiningGroupId(group.feedId);
    setCooldownErrors((prev) => ({ ...prev, [group.feedId]: "" }));

    try {
      const result = await groupService.joinGroup(
        group.feedId,
        credentials.signingPublicKey,
        credentials.encryptionPublicKey  // Pass encrypt key to avoid identity lookup timing issue
      );

      if (result.success) {
        setJoinedGroupIds((prev) => new Set([...prev, group.feedId]));
        // Navigate to the joined group
        onFeedSelected?.(group.feedId);
      } else {
        // Check if it's a cooldown error
        if (result.error?.includes("cooldown") || result.error?.includes("block")) {
          setCooldownErrors((prev) => ({ ...prev, [group.feedId]: result.error || "" }));
        } else {
          setGroupError(result.error || "Failed to join group");
        }
      }
    } catch (err) {
      debugError("[NewChatView] Join group failed:", err);
      setGroupError("Failed to join group. Please try again.");
    } finally {
      setJoiningGroupId(null);
    }
  }, [onFeedSelected]);

  // Handle selecting a profile
  const handleSelectProfile = useCallback(
    async (profile: SearchResultWithFeed) => {
      // If this is the user's personal feed, navigate to it
      if (profile.isPersonalFeed && profile.personalFeedId) {
        debugLog("[NewChatView] Opening personal feed:", profile.personalFeedId);
        onFeedSelected?.(profile.personalFeedId);
        return;
      }

      // If chat feed already exists, just navigate to it
      if (profile.hasExistingFeed && profile.existingFeedId) {
        debugLog("[NewChatView] Opening existing feed:", profile.existingFeedId);
        onFeedSelected?.(profile.existingFeedId);
        return;
      }

      // Create new feed
      setIsCreating(true);
      setError(null);

      try {
        const result = await createChatFeed({
          displayName: profile.displayName,
          publicSigningAddress: profile.publicSigningAddress,
          publicEncryptAddress: profile.publicEncryptAddress,
        });

        if (!result.success) {
          setError(result.error || "Failed to create feed");
          return;
        }

        if (result.feedId) {
          if (result.isExisting) {
            debugLog("[NewChatView] Feed already existed:", result.feedId);
            onFeedSelected?.(result.feedId);
          } else {
            debugLog("[NewChatView] New feed created:", result.feedId);
            onFeedCreated?.(result.feedId);
          }
        }
      } catch (err) {
        debugError("[NewChatView] Create feed failed:", err);
        setError("Failed to create feed. Please try again.");
      } finally {
        setIsCreating(false);
      }
    },
    [onFeedCreated, onFeedSelected]
  );

  // Handle Enter key in search input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (activeTab === "users") {
        handleSearch();
      } else {
        handleGroupSearch();
      }
    }
  };

  // Handle tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    // Clear errors when switching tabs
    setError(null);
    setGroupError(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-hush-bg-hover">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-hush-bg-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-hush-text-primary" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-hush-text-primary">New Feed</h2>
            <p className="text-xs text-hush-text-accent mt-0.5">
              {activeTab === "users"
                ? "Search for a profile to start a conversation"
                : "Find and join public groups"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 px-4 pt-3">
        <div className="flex gap-1 p-1 bg-hush-bg-dark rounded-lg" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "users"}
            onClick={() => handleTabChange("users")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "users"
                ? "bg-hush-bg-element text-hush-text-primary"
                : "text-hush-text-accent hover:text-hush-text-primary hover:bg-hush-bg-hover"
            }`}
          >
            <User className="w-4 h-4" aria-hidden="true" />
            <span>Users</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "publicGroups"}
            onClick={() => handleTabChange("publicGroups")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "publicGroups"
                ? "bg-hush-bg-element text-hush-text-primary"
                : "text-hush-text-accent hover:text-hush-text-primary hover:bg-hush-bg-hover"
            }`}
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Public Groups</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex-shrink-0 p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={activeTab === "users" ? searchQuery : groupSearchQuery}
              onChange={(e) =>
                activeTab === "users"
                  ? setSearchQuery(e.target.value)
                  : setGroupSearchQuery(e.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={
                activeTab === "users" ? "Search by Profile Name" : "Search by name or invite code"
              }
              className="w-full bg-hush-bg-dark border border-hush-bg-hover rounded-xl px-4 py-2.5 pl-10 text-sm text-hush-text-primary placeholder-hush-text-accent focus:outline-none focus:border-hush-purple"
              disabled={isSearching || isCreating || isSearchingGroups}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hush-text-accent" />
          </div>
          <button
            onClick={activeTab === "users" ? handleSearch : handleGroupSearch}
            disabled={
              (activeTab === "users" && (isSearching || isCreating || !searchQuery.trim())) ||
              (activeTab === "publicGroups" && (isSearchingGroups || !groupSearchQuery.trim()))
            }
            className="px-4 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {(activeTab === "users" && isSearching) || (activeTab === "publicGroups" && isSearchingGroups) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {groupError && <p className="mt-2 text-sm text-red-400">{groupError}</p>}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {/* Users Tab Content */}
        {activeTab === "users" && (
          <>
            {isCreating && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-hush-purple mr-2" />
                <span className="text-sm text-hush-text-accent">Creating feed...</span>
              </div>
            )}

            {!isCreating && hasSearched && searchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-hush-purple" />
                </div>
                <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
                  No profiles found
                </h3>
                <p className="text-sm text-hush-text-accent max-w-[280px]">
                  Try a different search term or check the spelling.
                </p>
              </div>
            )}

            {!isCreating && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((profile) => (
                  <button
                    key={profile.publicSigningAddress}
                    onClick={() => handleSelectProfile(profile)}
                    disabled={isCreating}
                    className="w-full flex items-center p-3 rounded-xl border border-hush-bg-hover bg-hush-bg-dark hover:bg-hush-bg-hover transition-colors text-left disabled:opacity-50"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-hush-bg-dark">
                        {getInitials(profile.displayName)}
                      </span>
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-hush-text-primary truncate">
                          {profile.displayName}
                        </span>
                        {/* Badge for personal feed */}
                        {profile.isPersonalFeed && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium flex-shrink-0">
                            <User className="w-3 h-3" />
                            Personal Feed
                          </span>
                        )}
                        {/* Badge for existing feed */}
                        {!profile.isPersonalFeed && profile.hasExistingFeed && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-hush-purple/20 text-hush-purple text-[10px] font-medium flex-shrink-0">
                            <UserCheck className="w-3 h-3" />
                            Feed exists
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-hush-text-accent truncate block">
                        {truncateAddress(profile.publicSigningAddress)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Public Groups Tab Content */}
        {activeTab === "publicGroups" && (
          <>
            {!hasSearchedGroups && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-hush-purple" />
                </div>
                <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
                  Discover Public Groups
                </h3>
                <p className="text-sm text-hush-text-accent max-w-[280px]">
                  Search for public groups to find communities and join conversations.
                </p>
              </div>
            )}

            {hasSearchedGroups && groupSearchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-hush-purple" />
                </div>
                <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
                  No groups found
                </h3>
                <p className="text-sm text-hush-text-accent max-w-[280px]">
                  No public groups match your search. Try a different search term.
                </p>
              </div>
            )}

            {groupSearchResults.length > 0 && (
              <div className="space-y-3">
                {groupSearchResults.map((group) => (
                  <GroupCard
                    key={group.feedId}
                    group={group}
                    onJoin={() => handleJoinGroup(group)}
                    isJoining={joiningGroupId === group.feedId}
                    isJoined={joinedGroupIds.has(group.feedId)}
                    cooldownError={cooldownErrors[group.feedId] || null}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

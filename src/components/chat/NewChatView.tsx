"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, MessageSquare, UserCheck, User, ArrowLeft } from "lucide-react";
import { searchByDisplayName } from "@/modules/identity";
import { findExistingChatFeed, createChatFeed, useFeedsStore } from "@/modules/feeds";
import { useAppStore } from "@/stores";
import type { ProfileSearchResult } from "@/types";

interface SearchResultWithFeed extends ProfileSearchResult {
  hasExistingFeed: boolean;
  existingFeedId?: string;
  isPersonalFeed: boolean;
  personalFeedId?: string;
}

interface NewChatViewProps {
  onFeedCreated?: (feedId: string) => void;
  onFeedSelected?: (feedId: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function NewChatView({ onFeedCreated, onFeedSelected, onBack, showBackButton = false }: NewChatViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultWithFeed[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Handle search
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
      console.error("[NewChatView] Search failed:", err);
      setError("Failed to search. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle selecting a profile
  const handleSelectProfile = useCallback(
    async (profile: SearchResultWithFeed) => {
      // If this is the user's personal feed, navigate to it
      if (profile.isPersonalFeed && profile.personalFeedId) {
        console.log("[NewChatView] Opening personal feed:", profile.personalFeedId);
        onFeedSelected?.(profile.personalFeedId);
        return;
      }

      // If chat feed already exists, just navigate to it
      if (profile.hasExistingFeed && profile.existingFeedId) {
        console.log("[NewChatView] Opening existing feed:", profile.existingFeedId);
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
            console.log("[NewChatView] Feed already existed:", result.feedId);
            onFeedSelected?.(result.feedId);
          } else {
            console.log("[NewChatView] New feed created:", result.feedId);
            onFeedCreated?.(result.feedId);
          }
        }
      } catch (err) {
        console.error("[NewChatView] Create feed failed:", err);
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
      handleSearch();
    }
  };

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
              Search for a profile to start a conversation
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex-shrink-0 p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by Profile Name"
              className="w-full bg-hush-bg-dark border border-hush-bg-hover rounded-xl px-4 py-2.5 pl-10 text-sm text-hush-text-primary placeholder-hush-text-accent focus:outline-none focus:border-hush-purple"
              disabled={isSearching || isCreating}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hush-text-accent" />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || isCreating || !searchQuery.trim()}
            className="px-4 py-2.5 bg-hush-purple text-hush-bg-dark rounded-xl font-medium text-sm hover:bg-hush-purple-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
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
      </div>
    </div>
  );
}

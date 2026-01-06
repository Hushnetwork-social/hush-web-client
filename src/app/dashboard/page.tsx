"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MessageSquare, Loader2 } from "lucide-react";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds";
import { groupService } from "@/lib/grpc/services/group";
import { debugLog, debugError } from "@/lib/debug-logger";
import { ensureCommitmentRegistered, isReactionsInitialized } from "@/modules/reactions/initializeReactions";

// Storage key for pending invite code (used when user needs to authenticate first)
const PENDING_INVITE_CODE_KEY = "hush_pending_invite_code";

// Dynamic imports to prevent dev mode race condition
const FeedList = dynamic(
  () => import("@/components/feed/FeedList").then((mod) => mod.FeedList),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-hush-purple" />
      </div>
    )
  }
);

const ChatView = dynamic(
  () => import("@/components/chat/ChatView").then((mod) => mod.ChatView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-hush-purple" />
      </div>
    )
  }
);

const NewChatView = dynamic(
  () => import("@/components/chat/NewChatView").then((mod) => mod.NewChatView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-hush-purple" />
      </div>
    )
  }
);

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedFeedId, selectFeed, selectedNav, setSelectedNav, credentials } = useAppStore();
  const feeds = useFeedsStore((state) => state.feeds);
  const isPendingGroupJoin = useFeedsStore((state) => state.isPendingGroupJoin);
  const pendingGroupJoinFeedId = useFeedsStore((state) => state.getPendingGroupJoinFeedId);

  // Guard to prevent duplicate invite code processing (React Strict Mode double-invokes effects)
  const isProcessingInviteRef = useRef(false);

  // Find the selected feed
  const selectedFeed = selectedFeedId
    ? feeds.find((f) => f.id === selectedFeedId)
    : null;

  // Check if we're waiting for a pending group join to sync
  const isWaitingForPendingGroup = isPendingGroupJoin() && selectedFeedId === pendingGroupJoinFeedId();

  // Handle pending invite code from authentication redirect
  const handlePendingInviteCode = useCallback(async () => {
    if (!credentials?.signingPublicKey) return;

    // Prevent duplicate processing
    if (isProcessingInviteRef.current) {
      debugLog("[DashboardPage] Already processing invite code, skipping");
      return;
    }

    const pendingCode = localStorage.getItem(PENDING_INVITE_CODE_KEY);
    if (!pendingCode) return;

    // Mark as processing and clear immediately to prevent race conditions
    isProcessingInviteRef.current = true;
    localStorage.removeItem(PENDING_INVITE_CODE_KEY);

    debugLog("[DashboardPage] Found pending invite code:", pendingCode);

    try {
      // Look up the group by code
      const groupInfo = await groupService.getGroupByInviteCode(pendingCode);
      if (!groupInfo) {
        debugLog("[DashboardPage] Pending invite code not found");
        return;
      }

      // Join the group
      debugLog("[DashboardPage] Joining group from pending invite:", groupInfo.name);
      const result = await groupService.joinGroup(
        groupInfo.feedId,
        credentials.signingPublicKey,
        credentials.encryptionPublicKey  // Pass encrypt key to avoid identity lookup timing issue
      );

      if (result.success) {
        debugLog("[DashboardPage] Successfully joined group from pending invite");
        // Set pending group join to trigger full feed resync until feed appears
        useFeedsStore.getState().setPendingGroupJoin(groupInfo.feedId);
        // Register reaction commitment for the new group feed
        // This ensures the user can decrypt reactions from other members
        if (isReactionsInitialized()) {
          debugLog("[DashboardPage] Registering reaction commitment for group feed:", groupInfo.feedId);
          ensureCommitmentRegistered(groupInfo.feedId).then((success) => {
            if (success) {
              debugLog("[DashboardPage] Reaction commitment registered for group feed");
            } else {
              debugLog("[DashboardPage] Failed to register reaction commitment for group feed (will retry on sync)");
            }
          });
        }
        // Select the feed (will show loading until it appears)
        selectFeed(groupInfo.feedId);
      } else {
        // Check if user is already a member (not really an error)
        if (result.error?.includes("already") || result.error?.includes("member")) {
          debugLog("[DashboardPage] User already a member, selecting feed");
          selectFeed(groupInfo.feedId);
        } else {
          debugError("[DashboardPage] Failed to join from pending invite:", result.error);
        }
      }
    } catch (err) {
      debugError("[DashboardPage] Error handling pending invite:", err);
    } finally {
      isProcessingInviteRef.current = false;
    }
  }, [credentials, selectFeed]);

  // Handle feed query parameter (from join redirect)
  useEffect(() => {
    const feedId = searchParams.get("feed");
    if (feedId) {
      debugLog("[DashboardPage] Selecting feed from URL param:", feedId);
      selectFeed(feedId);
      // Clear the query param from URL
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, selectFeed, router]);

  // Handle pending invite code on mount
  useEffect(() => {
    handlePendingInviteCode();
  }, [handlePendingInviteCode]);

  const handleSendMessage = (message: string) => {
    // TODO: Implement message sending to blockchain
    debugLog("[DashboardPage] Sending message:", message);
  };

  const handleBack = () => {
    // Clear selected feed to go back to feed list on mobile
    selectFeed(null);
  };

  // Handle feed created from NewChatView
  const handleFeedCreated = (feedId: string) => {
    selectFeed(feedId);
    setSelectedNav("feeds"); // Switch back to feeds view
  };

  // Handle feed selected from NewChatView (existing feed)
  const handleFeedSelected = (feedId: string) => {
    selectFeed(feedId);
    setSelectedNav("feeds"); // Switch back to feeds view
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Mobile: Show feed list, chat view, or new chat based on selection */}
      <div className="flex-1 flex flex-col md:hidden min-h-0 overflow-hidden">
        {selectedNav === "new-chat" ? (
          <NewChatView
            onFeedCreated={handleFeedCreated}
            onFeedSelected={handleFeedSelected}
            showBackButton={true}
            onBack={() => setSelectedNav("feeds")}
          />
        ) : isWaitingForPendingGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-10 h-10 animate-spin text-hush-purple mb-4" />
            <h2 className="text-xl font-semibold text-hush-text-primary mb-2">
              Joining Group...
            </h2>
            <p className="text-hush-text-accent text-sm max-w-md">
              Please wait while we set up your group membership and encryption keys.
            </p>
          </div>
        ) : selectedFeed ? (
          <div className="flex-1 flex flex-col min-h-0">
            <ChatView
              key={selectedFeed.id}
              feed={selectedFeed}
              onSendMessage={handleSendMessage}
              showBackButton={true}
              onBack={handleBack}
              onCloseFeed={handleBack}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <FeedList />
          </div>
        )}
      </div>

      {/* Desktop: Chat view, New Chat view, or empty state */}
      <div className="hidden md:flex flex-1 min-h-0 flex-col overflow-hidden">
        {selectedNav === "new-chat" ? (
          <NewChatView
            onFeedCreated={handleFeedCreated}
            onFeedSelected={handleFeedSelected}
          />
        ) : isWaitingForPendingGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-10 h-10 animate-spin text-hush-purple mb-4" />
            <h2 className="text-xl font-semibold text-hush-text-primary mb-2">
              Joining Group...
            </h2>
            <p className="text-hush-text-accent text-sm max-w-md">
              Please wait while we set up your group membership and encryption keys.
            </p>
          </div>
        ) : selectedFeed ? (
          <ChatView key={selectedFeed.id} feed={selectedFeed} onSendMessage={handleSendMessage} onCloseFeed={handleBack} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-hush-purple" />
            </div>
            <h2 className="text-xl font-semibold text-hush-text-primary mb-2">
              Welcome to Hush Feeds
            </h2>
            <p className="text-hush-text-accent text-sm max-w-md">
              Select a conversation from the sidebar or start a new chat to begin
              messaging securely on the HushNetwork blockchain.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

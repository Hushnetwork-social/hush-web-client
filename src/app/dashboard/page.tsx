"use client";

import dynamic from "next/dynamic";
import { MessageSquare, Loader2 } from "lucide-react";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds";
import { debugLog } from "@/lib/debug-logger";

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
  const { selectedFeedId, selectFeed, selectedNav, setSelectedNav } = useAppStore();
  const feeds = useFeedsStore((state) => state.feeds);

  // Find the selected feed
  const selectedFeed = selectedFeedId
    ? feeds.find((f) => f.id === selectedFeedId)
    : null;

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
        ) : selectedFeed ? (
          <div className="flex-1 flex flex-col min-h-0">
            <ChatView
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
        ) : selectedFeed ? (
          <ChatView feed={selectedFeed} onSendMessage={handleSendMessage} onCloseFeed={handleBack} />
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

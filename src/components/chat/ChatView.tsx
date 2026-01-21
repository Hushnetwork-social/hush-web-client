"use client";

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { MessageSquare, Lock, ArrowLeft, Users, Settings, LogOut, Ban, Globe } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { SystemMessage } from "./SystemMessage";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { ReplyContextBar } from "./ReplyContextBar";
import type { MentionParticipant } from "./MentionOverlay";
import { MemberListPanel } from "@/components/groups/MemberListPanel";
import { GroupSettingsPanel } from "@/components/groups/GroupSettingsPanel";
import { MentionNavButton, getUnreadCount, getUnreadMentions, markMentionRead, useMessageHighlight } from "@/lib/mentions";
import { useAppStore } from "@/stores";
import { useFeedsStore, sendMessage, markFeedAsRead } from "@/modules/feeds";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import { useVirtualKeyboard } from "@/hooks/useVirtualKeyboard";
import type { Feed, FeedMessage, GroupFeedMember, SettingsChangeRecord } from "@/types";
import { onVisibilityChange, type SettingsChange } from "@/lib/events";
import { debugLog } from "@/lib/debug-logger";
import { announceMentionNavigation } from "@/lib/a11y";

// Empty array constants to avoid creating new references
const EMPTY_MESSAGES: FeedMessage[] = [];
const EMPTY_MEMBERS: GroupFeedMember[] = [];

// Type for system events displayed in the chat
interface SystemEvent {
  id: string;
  type: 'system';
  eventType: 'member_joined' | 'member_left' | 'key_rotated' | 'visibility_changed' | 'settings_changed';
  memberName?: string;
  /** For visibility_changed events: the new visibility state */
  isPublic?: boolean;
  /** For settings_changed events: all the changes that occurred */
  settingsChange?: SettingsChange;
  timestamp: number;
}

// Combined chat item type (regular message or system event)
type ChatItem = (FeedMessage & { type: 'message' }) | SystemEvent;

// Constants for display name truncation
const TRUNCATED_KEY_LENGTH = 10;
const TRUNCATION_SUFFIX = "...";

interface ChatViewProps {
  feed: Feed;
  onSendMessage?: (message: string) => void;
  onBack?: () => void;
  onCloseFeed?: () => void;
  showBackButton?: boolean;
}

export function ChatView({ feed, onSendMessage, onBack, onCloseFeed, showBackButton = false }: ChatViewProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const { credentials, currentUser } = useAppStore();

  // Android virtual keyboard detection for compact header mode
  const { isKeyboardVisible } = useVirtualKeyboard();
  // Subscribe to just this feed's messages for efficient updates
  const feedMessages = useFeedsStore(
    (state) => state.messages[feed.id] ?? EMPTY_MESSAGES
  );
  const groupMembersMap = useFeedsStore((state) => state.groupMembers);

  const regularMessages = useMemo(
    () => feedMessages.filter(m => !m.decryptionFailed),
    [feedMessages]
  );

  const groupMembers = useMemo(
    () => (feed.type === 'group' ? groupMembersMap[feed.id] ?? EMPTY_MEMBERS : EMPTY_MEMBERS),
    [groupMembersMap, feed.id, feed.type]
  );

  // Track group key state for system messages and reactions
  const groupKeyStates = useFeedsStore((state) => state.groupKeyStates);
  const keyState = groupKeyStates[feed.id];
  const currentKeyGeneration = keyState?.currentKeyGeneration ?? 0;
  const previousKeyGenRef = useRef<number>(currentKeyGeneration);

  // Get the effective AES key for reactions:
  // - For group feeds: use the current KeyGeneration's AES key from groupKeyStates
  // - For other feeds: use the feed's aesKey directly
  const effectiveAesKey = useMemo(() => {
    if (feed.type === 'group' && keyState) {
      const currentKey = keyState.keyGenerations.find(
        (kg) => kg.keyGeneration === keyState.currentKeyGeneration
      );
      debugLog(`[ChatView] effectiveAesKey calculated: feedId=${feed.id.substring(0, 8)}..., currentKeyGen=${keyState.currentKeyGeneration}, aesKey=${currentKey?.aesKey?.substring(0, 16) ?? 'NOT FOUND'}...`);
      return currentKey?.aesKey;
    }
    return feed.aesKey;
  }, [feed.type, feed.aesKey, keyState, feed.id]);

  // Generate system events for all member joins in the group
  // Shows "X joined the group" for each member based on their joinedAtBlock
  // Also includes historical settings changes from settingsChangeHistory
  const historicalSystemEvents = useMemo((): SystemEvent[] => {
    if (feed.type !== 'group') return [];

    const events: SystemEvent[] = [];
    const keyGenerations = keyState?.keyGenerations ?? [];

    // Sort members by joinedAtBlock to show joins in chronological order
    const sortedMembers = [...groupMembers]
      .filter(m => m.joinedAtBlock && m.joinedAtBlock > 0)
      .sort((a, b) => (a.joinedAtBlock ?? 0) - (b.joinedAtBlock ?? 0));

    // Find the earliest message timestamp to use as reference for block-to-time conversion
    const sortedMessages = [...regularMessages].sort((a, b) => a.timestamp - b.timestamp);

    // Build a map of block -> approximate timestamp using messages
    const blockTimestampMap = new Map<number, number>();
    for (const msg of sortedMessages) {
      if (msg.blockHeight && !blockTimestampMap.has(msg.blockHeight)) {
        blockTimestampMap.set(msg.blockHeight, msg.timestamp);
      }
    }

    // For each member, create a "joined" event
    for (const member of sortedMembers) {
      const joinBlock = member.joinedAtBlock ?? 0;

      // Find KeyGeneration that corresponds to this join (if any)
      // KeyGeneration 0 is the initial group creation
      const correspondingKeyGen = keyGenerations.find(kg => {
        // Check if this member's join block matches this KeyGeneration's validFromBlock
        return Math.abs(kg.validFromBlock - joinBlock) <= 5;
      });

      // Estimate timestamp for this join event
      let estimatedTimestamp: number;

      // Try to find a message close to this block for timestamp reference
      const closestBlockEntry = [...blockTimestampMap.entries()]
        .sort((a, b) => Math.abs(a[0] - joinBlock) - Math.abs(b[0] - joinBlock))[0];

      if (closestBlockEntry) {
        const [refBlock, refTimestamp] = closestBlockEntry;
        // Estimate ~10 seconds per block
        const blockDiff = joinBlock - refBlock;
        estimatedTimestamp = refTimestamp + (blockDiff * 10000);
      } else {
        // Fallback: use KeyGeneration number * some offset if no messages
        const keyGenNum = correspondingKeyGen?.keyGeneration ?? 0;
        estimatedTimestamp = feed.createdAt ? feed.createdAt + (keyGenNum * 60000) : Date.now() - (sortedMembers.length - sortedMembers.indexOf(member)) * 60000;
      }

      events.push({
        id: `system-member-join-${member.publicAddress.substring(0, 16)}`,
        type: 'system' as const,
        eventType: 'member_joined' as const,
        memberName: member.displayName,
        timestamp: estimatedTimestamp,
      });

      // If the member has left, also create a "left" event
      if (member.leftAtBlock) {
        const leftBlock = member.leftAtBlock;

        // Try to find a message close to the leave block for timestamp reference
        const closestLeftBlockEntry = [...blockTimestampMap.entries()]
          .sort((a, b) => Math.abs(a[0] - leftBlock) - Math.abs(b[0] - leftBlock))[0];

        let leftTimestamp: number;
        if (closestLeftBlockEntry) {
          const [refBlock, refTimestamp] = closestLeftBlockEntry;
          const blockDiff = leftBlock - refBlock;
          leftTimestamp = refTimestamp + (blockDiff * 10000);
        } else {
          // Fallback: estimate based on join timestamp + some offset
          leftTimestamp = estimatedTimestamp + 60000; // 1 minute after join as fallback
        }

        events.push({
          id: `system-member-left-${member.publicAddress.substring(0, 16)}`,
          type: 'system' as const,
          eventType: 'member_left' as const,
          memberName: member.displayName,
          timestamp: leftTimestamp,
        });
      }
    }

    // Add historical settings change events from persisted history
    // Deduplicate by ID to handle any legacy duplicates in persisted storage
    const settingsHistory = feed.settingsChangeHistory ?? [];
    const seenSettingsIds = new Set<string>();
    for (const record of settingsHistory) {
      // Skip duplicates (can occur from legacy data before uniqueness fix)
      if (seenSettingsIds.has(record.id)) continue;
      seenSettingsIds.add(record.id);
      // Convert SettingsChangeRecord to SettingsChange format for the event
      const settingsChange: SettingsChange = {};
      if (record.nameChange) {
        settingsChange.previousName = record.nameChange.previous;
        settingsChange.newName = record.nameChange.new;
      }
      if (record.descriptionChange) {
        settingsChange.previousDescription = record.descriptionChange.previous;
        settingsChange.newDescription = record.descriptionChange.new;
      }
      if (record.visibilityChange) {
        settingsChange.previousIsPublic = record.visibilityChange.previous;
        settingsChange.newIsPublic = record.visibilityChange.new;
      }

      events.push({
        id: record.id,
        type: 'system' as const,
        eventType: 'settings_changed' as const,
        settingsChange,
        timestamp: record.timestamp,
      });
    }

    return events;
  }, [feed.type, feed.createdAt, feed.settingsChangeHistory, regularMessages, keyState?.keyGenerations, groupMembers]);

  // Live system events state for real-time notifications (key rotation, member left)
  const [liveSystemEvents, setLiveSystemEvents] = useState<SystemEvent[]>([]);

  // Track previous members (with display names) to detect when someone leaves
  const previousMembersRef = useRef<Map<string, string>>(new Map());

  // Detect live key rotation (new member joined while viewing chat)
  useEffect(() => {
    if (feed.type !== 'group') return;

    const prevKeyGen = previousKeyGenRef.current;
    if (currentKeyGeneration > prevKeyGen && prevKeyGen > 0) {
      // Key rotation happened - add a live system event
      // Note: This may duplicate a historical event, but we dedupe by ID
      setLiveSystemEvents(prev => [...prev, {
        id: `system-live-${Date.now()}`,
        type: 'system',
        eventType: 'key_rotated',
        timestamp: Date.now(),
      }]);
    }
    previousKeyGenRef.current = currentKeyGeneration;
  }, [currentKeyGeneration, feed.type]);

  // Detect when members leave the group (real-time notification)
  useEffect(() => {
    if (feed.type !== 'group') return;

    const currentMemberAddresses = new Set(groupMembers.map(m => m.publicAddress));
    const prevMembersMap = previousMembersRef.current;

    // Skip first render (no previous data to compare)
    if (prevMembersMap.size > 0) {
      // Find members who left (were in previous map but not in current set)
      for (const [prevAddress, prevDisplayName] of prevMembersMap) {
        if (!currentMemberAddresses.has(prevAddress)) {
          // Member left - use the display name from previous render
          setLiveSystemEvents(prev => [...prev, {
            id: `system-member-left-${prevAddress.substring(0, 16)}-${Date.now()}`,
            type: 'system',
            eventType: 'member_left',
            memberName: prevDisplayName,
            timestamp: Date.now(),
          }]);
        }
      }
    }

    // Update ref for next comparison (store address -> displayName map)
    const newMembersMap = new Map<string, string>();
    for (const member of groupMembers) {
      newMembersMap.set(member.publicAddress, member.displayName);
    }
    previousMembersRef.current = newMembersMap;
  }, [feed.type, groupMembers]);

  // Listen for visibility change events while viewing this group
  // NOTE: This is kept for backwards compatibility. The new settings_changed event
  // includes visibility changes and provides a more comprehensive notification.
  useEffect(() => {
    if (feed.type !== 'group') return;

    const unsubscribe = onVisibilityChange((event) => {
      // Only handle events for the current feed
      if (event.feedId === feed.id) {
        setLiveSystemEvents(prev => [...prev, {
          id: `system-visibility-${event.timestamp}`,
          type: 'system',
          eventType: 'visibility_changed',
          isPublic: event.isPublic,
          timestamp: event.timestamp,
        }]);
      }
    });

    return unsubscribe;
  }, [feed.type, feed.id]);

  // NOTE: Settings change events are now handled via persisted settingsChangeHistory
  // The historicalSystemEvents useMemo reads from feed.settingsChangeHistory and generates
  // system events reactively. We no longer need to listen for real-time events since:
  // 1. Local changes: handleUpdateSettings persists to history immediately
  // 2. Remote changes: FeedsSyncable persists to history on sync
  // Both cases update the store, triggering a re-render with updated historicalSystemEvents.

  // Combine messages and system events into a single sorted array
  // Pending (unconfirmed) messages are always placed at the end for optimistic UI
  const chatItems = useMemo((): ChatItem[] => {
    const messageItems: ChatItem[] = regularMessages.map(m => ({ ...m, type: 'message' as const }));
    // Combine historical and live system events
    const allSystemEvents = [...historicalSystemEvents, ...liveSystemEvents];
    const allItems = [...messageItems, ...allSystemEvents];

    // Custom sort: sort by timestamp, but unconfirmed messages go to the end
    const sorted = allItems.sort((a, b) => {
      const aIsUnconfirmed = a.type === 'message' && a.isConfirmed === false;
      const bIsUnconfirmed = b.type === 'message' && b.isConfirmed === false;

      // Unconfirmed messages always go last
      if (aIsUnconfirmed && !bIsUnconfirmed) return 1;
      if (!aIsUnconfirmed && bIsUnconfirmed) return -1;

      // Otherwise sort by timestamp
      return a.timestamp - b.timestamp;
    });

    return sorted;
  }, [regularMessages, historicalSystemEvents, liveSystemEvents]);

  // Track previous chatItems length to detect new pending messages
  // Use -1 as sentinel value to indicate first render hasn't happened yet
  const prevChatItemsCountRef = useRef(-1);

  // Auto-scroll to bottom when a new pending message is added (optimistic UI)
  // This ensures the message appears immediately in the viewport
  useEffect(() => {
    const currentCount = chatItems.length;
    const prevCount = prevChatItemsCountRef.current;

    // Skip the first effect call (initialization)
    if (prevCount === -1) {
      prevChatItemsCountRef.current = currentCount;
      return;
    }

    // Check if new items were added
    if (currentCount > prevCount) {
      // Find any unconfirmed message in the chatItems (not just the last item,
      // since system events might have timestamps that sort them after the new message)
      const unconfirmedMsgIndex = chatItems.findIndex(
        item => item.type === 'message' && item.isConfirmed === false
      );

      if (unconfirmedMsgIndex !== -1) {
        // Scroll to the unconfirmed message immediately
        // Use a small delay to ensure Virtuoso has processed the new data
        setTimeout(() => {
          if (virtuosoRef.current) {
            virtuosoRef.current.scrollToIndex({
              index: unconfirmedMsgIndex,
              behavior: 'auto',
              align: 'center',
            });
          }
        }, 100);
      }
    }

    prevChatItemsCountRef.current = currentCount;
  }, [chatItems]);

  // For backward compatibility, keep messages reference (used elsewhere)
  const messages = regularMessages;

  // Check if current user is admin of the group
  const isGroupFeed = feed.type === 'group';

  // State for member panel visibility
  const [showMemberPanel, setShowMemberPanel] = useState(false);

  // State for settings panel visibility
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // State for unread mentions count (for MentionNavButton)
  const [unreadMentionCount, setUnreadMentionCount] = useState(() => getUnreadCount(feed.id));

  // Message highlight hook for mention navigation
  const { highlightMessage } = useMessageHighlight();

  // Update unread mention count when feed changes or messages change
  // This allows the button to react to new mentions being tracked or marked as read
  useEffect(() => {
    const count = getUnreadCount(feed.id);
    setUnreadMentionCount(count);
  }, [feed.id, feedMessages]);

  // Get current user's membership info in the group
  const currentUserMember = useMemo(() => {
    if (!isGroupFeed || !credentials?.signingPublicKey) return null;
    return groupMembers.find(m => m.publicAddress === credentials.signingPublicKey) ?? null;
  }, [isGroupFeed, credentials?.signingPublicKey, groupMembers]);

  // Check if current user is still an active member of the group
  // User is NOT a member if: they left (leftAtBlock set), were banned, or are not in the members list
  const isCurrentUserMember = currentUserMember !== null && !currentUserMember.leftAtBlock;

  // Get current user's role in the group
  const currentUserRole = useMemo(() => {
    if (!currentUserMember) return 'Member' as const;
    return currentUserMember.role ?? 'Member' as const;
  }, [currentUserMember]);

  // Check if current user can send messages
  // For group feeds: only Admin and Member can send, Blocked users cannot
  // For non-group feeds: always allowed (personal, chat, broadcast)
  const canSendMessages = !isGroupFeed || (isCurrentUserMember && currentUserRole !== 'Blocked');

  // Check if current user is the last admin (for delete button visibility)
  const isLastAdmin = useMemo(() => {
    if (!isGroupFeed || currentUserRole !== 'Admin') return false;
    const adminCount = groupMembers.filter(m => m.role === 'Admin').length;
    return adminCount === 1;
  }, [isGroupFeed, currentUserRole, groupMembers]);

  // Create a lookup Map for O(1) member resolution (optimization for groups with many messages)
  const memberLookup = useMemo(() => {
    if (!isGroupFeed || groupMembers.length === 0) return new Map<string, GroupFeedMember>();
    return new Map(groupMembers.map(m => [m.publicAddress, m]));
  }, [isGroupFeed, groupMembers]);

  // Get sender role for group messages (O(1) lookup)
  const getSenderRole = useCallback((publicKey: string) => {
    return memberLookup.get(publicKey)?.role;
  }, [memberLookup]);

  // Get sender display name for group messages (O(1) lookup)
  // Falls back to message.senderName (from server) for users who have left
  const getSenderDisplayName = useCallback((publicKey: string, messageSenderName?: string): string | undefined => {
    if (!isGroupFeed) return undefined;
    // Don't show sender name for own messages
    if (publicKey === credentials?.signingPublicKey) return undefined;
    const member = memberLookup.get(publicKey);
    // Priority: active member name > server-provided name > truncated key
    return member?.displayName ?? messageSenderName ?? publicKey.substring(0, TRUNCATED_KEY_LENGTH) + TRUNCATION_SUFFIX;
  }, [isGroupFeed, memberLookup, credentials?.signingPublicKey]);

  // Build participant list for @mentions
  // For group feeds: all active members
  // For chat feeds: self and the other participant
  const mentionParticipants: MentionParticipant[] = useMemo(() => {
    if (feed.type === 'group') {
      // Group feed: use all active members (not left)
      return groupMembers
        .filter(m => !m.leftAtBlock)
        .map(m => ({
          identityId: m.publicAddress,
          displayName: m.displayName,
          publicAddress: m.publicAddress,
        }));
    } else if (feed.type === 'chat' && credentials?.signingPublicKey) {
      // Chat feed: include self and other participant
      const participants: MentionParticipant[] = [];

      // Add current user
      const userDisplayName = currentUser?.displayName ?? 'You';
      participants.push({
        identityId: credentials.signingPublicKey,
        displayName: userDisplayName,
        publicAddress: credentials.signingPublicKey,
      });

      // Add other participant (from feed)
      if (feed.otherParticipantPublicSigningAddress) {
        participants.push({
          identityId: feed.otherParticipantPublicSigningAddress,
          displayName: feed.name, // The feed name is the other participant's name
          publicAddress: feed.otherParticipantPublicSigningAddress,
        });
      }

      return participants;
    }

    return [];
  }, [feed.type, feed.name, feed.otherParticipantPublicSigningAddress, groupMembers, credentials?.signingPublicKey, currentUser?.displayName]);

  // Use the feed reactions hook for optimistic updates
  const {
    getReactionCounts,
    getMyReaction,
    isPending,
    handleReactionSelect,
  } = useFeedReactions({
    feedId: feed.id,
    feedAesKey: effectiveAesKey,
  });

  // Create stable callback for reactions using ref pattern to avoid re-renders
  const handleReactionSelectRef = useRef(handleReactionSelect);
  handleReactionSelectRef.current = handleReactionSelect;

  const stableHandleReactionSelect = useCallback(
    (messageId: string, emojiIndex: number) => {
      handleReactionSelectRef.current(messageId, emojiIndex);
    },
    []
  );

  // Reply to Message: State for tracking which message is being replied to
  const [replyingTo, setReplyingTo] = useState<FeedMessage | null>(null);

  // Reply to Message: Handler for reply button click
  const handleReplyClick = useCallback((message: FeedMessage) => {
    setReplyingTo(message);
    // Focus the message input when starting a reply
    // Use setTimeout to ensure state update completes first
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 0);
  }, []);

  // Reply to Message: Handler for cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Member Panel: Handler for opening/closing
  const handleOpenMemberPanel = useCallback(() => {
    setShowMemberPanel(true);
  }, []);

  const handleCloseMemberPanel = useCallback(() => {
    setShowMemberPanel(false);
  }, []);

  // Settings Panel: Handler for opening/closing
  const handleOpenSettingsPanel = useCallback(() => {
    setShowSettingsPanel(true);
  }, []);

  const handleCloseSettingsPanel = useCallback(() => {
    setShowSettingsPanel(false);
  }, []);

  // Settings Panel: Handler for leave group action
  const handleLeaveGroup = useCallback(() => {
    // Navigate away from the group (back to feed list)
    if (onBack) {
      onBack();
    }
  }, [onBack]);

  // Settings Panel: Handler for delete group action
  const handleDeleteGroup = useCallback(() => {
    // Navigate away from the deleted group (back to feed list)
    if (onBack) {
      onBack();
    }
  }, [onBack]);

  // Mention Navigation: Handler for navigating to unread mentions
  // Cycles through unread mentions in order, scrolling to each and marking as read
  const mentionNavIndexRef = useRef(0);

  const handleNavigateToMention = useCallback(() => {
    const unreadMentionIds = getUnreadMentions(feed.id);

    if (unreadMentionIds.length === 0) {
      return;
    }

    // Get the current index (wrap around if needed)
    const currentIndex = mentionNavIndexRef.current % unreadMentionIds.length;
    const targetMessageId = unreadMentionIds[currentIndex];

    // Find the message index in chatItems
    const messageIndex = chatItems.findIndex(
      (item) => item.type === 'message' && item.id === targetMessageId
    );

    if (messageIndex !== -1 && virtuosoRef.current) {
      // Get sender name for screen reader announcement
      const targetItem = chatItems[messageIndex];
      let senderName: string | undefined;
      if (targetItem.type === 'message') {
        // Resolve sender name using memberLookup (for groups) or feed name (for chats)
        const senderKey = targetItem.senderPublicKey;
        if (senderKey === credentials?.signingPublicKey) {
          senderName = 'You';
        } else if (feed.type === 'chat' && senderKey === feed.otherParticipantPublicSigningAddress) {
          senderName = feed.name;
        } else if (feed.type === 'group') {
          const member = memberLookup.get(senderKey);
          senderName = member?.displayName ?? targetItem.senderName;
        }
      }

      // Scroll to the message
      virtuosoRef.current.scrollToIndex({
        index: messageIndex,
        behavior: 'smooth',
        align: 'center',
      });

      // After scroll completes, highlight the message element
      // Use a delay to allow Virtuoso to render the element
      setTimeout(() => {
        const element = document.querySelector(`[data-message-id="${targetMessageId}"]`);
        if (element instanceof HTMLElement) {
          highlightMessage(element);
        }
      }, 500);

      // Announce to screen reader
      announceMentionNavigation(currentIndex, unreadMentionIds.length, senderName);

      // Mark this mention as read
      markMentionRead(feed.id, targetMessageId);

      // Update the count
      setUnreadMentionCount(getUnreadCount(feed.id));

      // Move to next mention for next click
      mentionNavIndexRef.current = currentIndex + 1;
    }
  }, [feed.id, feed.type, feed.name, feed.otherParticipantPublicSigningAddress, chatItems, highlightMessage, credentials?.signingPublicKey, memberLookup]);

  // Reset mention navigation index when feed changes
  useEffect(() => {
    mentionNavIndexRef.current = 0;
  }, [feed.id]);

  // FEAT-051: Mark feed as read when viewing
  // This effect runs when the feed is opened and when new messages arrive while viewing
  const lastMarkedBlockIndexRef = useRef<number>(0);

  useEffect(() => {
    // Skip if no credentials
    if (!credentials?.signingPublicKey) return;

    // Get max block index from messages in this feed
    const maxBlockIndex = useFeedsStore.getState().getMaxMessageBlockIndex(feed.id);

    // Skip if no messages or blockIndex is 0
    if (maxBlockIndex <= 0) return;

    // Skip if we already marked this blockIndex (avoid redundant calls)
    if (maxBlockIndex <= lastMarkedBlockIndexRef.current) return;

    // Skip if feed's lastReadBlockIndex already covers this (already read on another device)
    if (feed.lastReadBlockIndex && maxBlockIndex <= feed.lastReadBlockIndex) {
      lastMarkedBlockIndexRef.current = maxBlockIndex;
      return;
    }

    // Mark as read
    debugLog(`[ChatView] Marking feed ${feed.id.substring(0, 8)}... as read up to block ${maxBlockIndex}`);

    markFeedAsRead(feed.id, maxBlockIndex, credentials.signingPublicKey).then((success) => {
      if (success) {
        // Update local store immediately
        useFeedsStore.getState().updateLastReadBlockIndex(feed.id, maxBlockIndex);
        lastMarkedBlockIndexRef.current = maxBlockIndex;
        debugLog(`[ChatView] Successfully marked feed as read`);
      }
    });
  }, [feed.id, feed.lastReadBlockIndex, feedMessages.length, credentials?.signingPublicKey]);

  // Reset lastMarkedBlockIndexRef when feed changes
  useEffect(() => {
    lastMarkedBlockIndexRef.current = 0;
  }, [feed.id]);

  // Settings Panel: Handler for settings update (name, description, visibility)
  const handleUpdateSettings = useCallback((name: string, description: string, isPublic: boolean) => {
    // Capture previous values BEFORE updating the store
    const previousName = feed.name;
    const previousDescription = feed.description;
    const previousIsPublic = feed.isPublic;

    // Update the feed in the store immediately for optimistic UI
    useFeedsStore.getState().updateFeedInfo(feed.id, {
      name,
      description,
      isPublic,
    });

    // Detect changes and persist to history (this is local user's change)
    const nameChanged = previousName !== name;
    const descriptionChanged = previousDescription !== description;
    const visibilityChanged = previousIsPublic !== isPublic;

    if (nameChanged || descriptionChanged || visibilityChanged) {
      // Use the timestamp of the last message + 1ms to ensure the settings change
      // appears AFTER the last message. This handles timezone differences between
      // local time and server timestamps.
      const lastMessageTimestamp = regularMessages.length > 0
        ? Math.max(...regularMessages.map(m => m.timestamp))
        : Date.now();
      // Also factor in any existing settings change records to avoid duplicate timestamps
      const lastSettingsTimestamp = (feed.settingsChangeHistory ?? []).length > 0
        ? Math.max(...(feed.settingsChangeHistory ?? []).map(r => r.timestamp))
        : 0;
      const timestamp = Math.max(lastMessageTimestamp + 1, lastSettingsTimestamp + 1, Date.now());
      const blockIndex = feed.blockIndex ?? 0;
      // Add random suffix to ensure uniqueness even if timestamp somehow collides
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);

      // Create and persist the settings change record
      const record: SettingsChangeRecord = {
        id: `settings-${feed.id}-${blockIndex}-${timestamp}-${uniqueSuffix}`,
        blockIndex,
        timestamp,
        ...(nameChanged && {
          nameChange: { previous: previousName!, new: name },
        }),
        ...(descriptionChanged && {
          descriptionChange: { previous: previousDescription ?? '', new: description },
        }),
        ...(visibilityChanged && {
          visibilityChange: { previous: previousIsPublic ?? false, new: isPublic },
        }),
      };

      // Persist to feed history - this will be included in historicalSystemEvents
      useFeedsStore.getState().addSettingsChangeRecord(feed.id, record);
    }
  }, [feed.id, feed.name, feed.description, feed.isPublic, feed.blockIndex, feed.settingsChangeHistory, regularMessages]);

  // Reply to Message: ESC key handler to cancel reply mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && replyingTo) {
        e.preventDefault();
        setReplyingTo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [replyingTo]);

  // Reply to Message: Scroll to a specific message when clicking reply preview
  const handleScrollToMessage = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: messageIndex,
        behavior: "smooth",
        align: "center",
      });
    }
  }, [messages]);

  // Reply to Message: Resolve display name from public key
  // For chat feeds: if it's the other participant, use feed.name; if it's me, use "You"
  // For group feeds: look up member in memberLookup Map (O(1))
  // Falls back to messageSenderName (from server) for users who have left
  const resolveDisplayName = useCallback((publicKey: string, messageSenderName?: string): string => {
    if (publicKey === credentials?.signingPublicKey) {
      return "You";
    }
    // For chat feeds, the other participant's name is the feed name
    if (feed.type === "chat" && publicKey === feed.otherParticipantPublicSigningAddress) {
      return feed.name;
    }
    // For group feeds, look up member display name (O(1) via Map)
    if (feed.type === "group") {
      const member = memberLookup.get(publicKey);
      if (member) {
        return member.displayName;
      }
      // Fallback to server-provided name for users who left
      if (messageSenderName) {
        return messageSenderName;
      }
    }
    // Fallback: truncated public key
    return publicKey.substring(0, TRUNCATED_KEY_LENGTH) + TRUNCATION_SUFFIX;
  }, [credentials?.signingPublicKey, feed.type, feed.name, feed.otherParticipantPublicSigningAddress, memberLookup]);

  // Format timestamp for display
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if message is from current user
  const isOwnMessage = (message: FeedMessage): boolean => {
    return message.senderPublicKey === credentials?.signingPublicKey;
  };

  // Get feed type label
  const getFeedTypeLabel = (type: Feed["type"]): string => {
    switch (type) {
      case "personal":
        return "Personal Feed";
      case "chat":
        return "Direct Message";
      case "group":
        return "Group Chat";
      case "broadcast":
        return "Broadcast";
      default:
        return "Feed";
    }
  };

  const handleSend = useCallback(async (message: string) => {
    // Send to blockchain (include reply reference if replying)
    const result = await sendMessage(feed.id, message, replyingTo?.id);

    if (!result.success) {
      console.error("[ChatView] Failed to send message:", result.error);
      // TODO: Show error toast to user
    } else {
      // Clear reply state after successful send
      setReplyingTo(null);
    }

    // Also call optional callback
    if (onSendMessage) {
      onSendMessage(message);
    }
  }, [feed.id, onSendMessage, replyingTo?.id]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Chat Header - compact mode when virtual keyboard visible on Android */}
      <div className={`flex-shrink-0 border-b border-hush-bg-hover bg-hush-bg-secondary transition-all duration-200 ease-in-out ${
        isKeyboardVisible ? 'px-2 py-1' : 'px-4 py-3'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Back Button - shown on mobile, smaller in compact mode */}
            {showBackButton && (
              <button
                onClick={onBack}
                className={`-ml-2 rounded-lg hover:bg-hush-bg-hover transition-all duration-200 ease-in-out ${
                  isKeyboardVisible ? 'p-1' : 'p-2'
                }`}
              >
                <ArrowLeft className={`text-hush-text-primary transition-all duration-200 ease-in-out ${
                  isKeyboardVisible ? 'w-4 h-4' : 'w-5 h-5'
                }`} />
              </button>
            )}
            {/* Group icon for group feeds - shows globe for public, users for private. Hidden in compact mode. */}
            {isGroupFeed && !isKeyboardVisible && (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                feed.isPublic ? 'bg-green-500/20' : 'bg-hush-purple/20'
              }`}>
                {feed.isPublic ? (
                  <Globe className="w-5 h-5 text-green-400" aria-hidden="true" />
                ) : (
                  <Users className="w-5 h-5 text-hush-purple" aria-hidden="true" />
                )}
              </div>
            )}
            <div>
              <h2 className={`font-semibold text-hush-text-primary transition-all duration-200 ease-in-out ${
                isKeyboardVisible ? 'text-sm max-w-[200px] truncate' : 'text-lg'
              }`}>
                {feed.name}
              </h2>
              {/* Meta row - hidden in compact mode */}
              <div className={`flex items-center space-x-2 text-xs text-hush-text-accent transition-all duration-200 ease-in-out ${
                isKeyboardVisible ? 'hidden' : ''
              }`}>
                {/* Show lock for private, globe for public */}
                {isGroupFeed && feed.isPublic ? (
                  <Globe className="w-3 h-3 text-green-400" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                <span>{getFeedTypeLabel(feed.type)}</span>
                {isGroupFeed && groupMembers.length > 0 ? (
                  <span>• {groupMembers.length} members</span>
                ) : feed.type !== "personal" && feed.participants.length > 0 ? (
                  <span>• {feed.participants.length} participants</span>
                ) : null}
              </div>
            </div>
          </div>
          {/* Action buttons for group feeds - hidden in compact mode */}
          {isGroupFeed && !isKeyboardVisible && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenMemberPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
                aria-label="View group members"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Members</span>
              </button>
              <button
                onClick={handleOpenSettingsPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
                aria-label="Group settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {/* Floating Mention Navigation Button - bottom-left, overlapping input area */}
        <div className="absolute -bottom-4 left-2 z-10">
          <MentionNavButton
            count={unreadMentionCount}
            onNavigate={handleNavigateToMention}
          />
        </div>

        {chatItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-hush-purple" />
            </div>
            <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
              No messages yet
            </h3>
            <p className="text-sm text-hush-text-accent max-w-[280px]">
              {feed.type === "personal"
                ? "This is your personal feed. Post your first message to start journaling on the blockchain."
                : "Send a message to start the conversation."}
            </p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={chatItems}
            followOutput="smooth"
            initialTopMostItemIndex={chatItems.length - 1}
            className="flex-1"
            computeItemKey={(index, item) => item.id}
            itemContent={(index, item) => (
              <div className="px-4 py-1">
                {item.type === 'system' ? (
                  <SystemMessage
                    type={item.eventType}
                    memberName={item.memberName}
                    isPublic={item.isPublic}
                    settingsChange={item.settingsChange}
                    timestamp={formatTime(item.timestamp)}
                  />
                ) : (
                  <MessageBubble
                    content={item.content}
                    timestamp={formatTime(item.timestamp)}
                    isOwn={isOwnMessage(item)}
                    isConfirmed={item.isConfirmed}
                    messageId={item.id}
                    reactionCounts={getReactionCounts(item.id)}
                    myReaction={getMyReaction(item.id)}
                    isPendingReaction={isPending(item.id)}
                    onReactionSelect={stableHandleReactionSelect}
                    replyToMessageId={item.replyToMessageId}
                    onReplyClick={handleReplyClick}
                    onScrollToMessage={handleScrollToMessage}
                    message={item}
                    resolveDisplayName={resolveDisplayName}
                    showSender={isGroupFeed}
                    senderName={getSenderDisplayName(item.senderPublicKey, item.senderName)}
                    senderRole={getSenderRole(item.senderPublicKey)}
                  />
                )}
              </div>
            )}
          />
        )}
      </div>

      {/* Reply Context Bar - shows when replying to a message */}
      {replyingTo && canSendMessages && (
        <ReplyContextBar
          replyingTo={replyingTo}
          senderDisplayName={resolveDisplayName(replyingTo.senderPublicKey, replyingTo.senderName)}
          onCancel={handleCancelReply}
        />
      )}

      {/* Message Input or "Not a member" notice for group feeds */}
      {isGroupFeed && !canSendMessages ? (
        <div className="flex-shrink-0 px-4 py-3 border-t border-hush-bg-hover bg-hush-bg-dark/50">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-hush-bg-element text-hush-text-accent">
            {currentUserRole === 'Blocked' ? (
              <>
                <Ban className="w-5 h-5 text-orange-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">You are blocked and cannot send messages in this group.</span>
              </>
            ) : (
              <>
                <LogOut className="w-5 h-5 text-hush-text-accent flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">You are no longer a member of this group.</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <MessageInput ref={messageInputRef} onSend={handleSend} onEscapeEmpty={onCloseFeed} participants={mentionParticipants} />
      )}

      {/* Member List Panel (Group feeds only) */}
      {isGroupFeed && credentials?.signingPublicKey && (
        <MemberListPanel
          isOpen={showMemberPanel}
          onClose={handleCloseMemberPanel}
          feedId={feed.id}
          currentUserAddress={credentials.signingPublicKey}
          currentUserRole={currentUserRole}
          members={groupMembers}
        />
      )}

      {/* Group Settings Panel (Group feeds only) */}
      {isGroupFeed && credentials?.signingPublicKey && (
        <GroupSettingsPanel
          isOpen={showSettingsPanel}
          onClose={handleCloseSettingsPanel}
          feedId={feed.id}
          groupName={feed.name}
          groupDescription={feed.description ?? ""}
          isPublic={feed.isPublic ?? false}
          inviteCode={feed.inviteCode}
          currentUserRole={currentUserRole}
          currentUserAddress={credentials.signingPublicKey}
          isLastAdmin={isLastAdmin}
          onLeave={handleLeaveGroup}
          onDelete={handleDeleteGroup}
          onUpdate={handleUpdateSettings}
        />
      )}
    </div>
  );
}

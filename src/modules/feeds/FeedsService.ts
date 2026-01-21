/**
 * Feeds Service
 *
 * Handles API calls for feeds and messages.
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { Feed, FeedMessage, ProfileSearchResult } from '@/types';
import { createFeedMessageTransaction, createChatFeedTransaction, hexToBytes } from '@/lib/crypto';
import { FEED_TYPE_MAP, useFeedsStore } from './useFeedsStore';
import { useAppStore } from '@/stores';
import { buildApiUrl } from '@/lib/api-config';
import { debugLog, debugError } from '@/lib/debug-logger';

// Server feed response type
interface ServerFeed {
  feedId: string;
  feedTitle: string;
  feedOwner: string;
  feedType: number;
  blockIndex: number;
  participants: { participantPublicAddress: string; encryptedFeedKey?: string }[];
  lastReadBlockIndex: number;  // FEAT-051: User's last read position in this feed
}

// Server message response type
interface ServerMessage {
  feedId: string;
  feedMessageId: string;
  messageContent: string;
  issuerPublicAddress: string;
  issuerName: string;
  timestamp: string;
  blockIndex: number;
  replyToMessageId?: string;  // Reply to Message: parent message reference
  keyGeneration?: number;     // Group Feeds: Key generation used to encrypt this message
}

// Server reaction tally response type (Protocol Omega)
interface ServerReactionTally {
  messageId: string;
  tallyC1: { x: string; y: string }[];  // Base64 encoded EC points
  tallyC2: { x: string; y: string }[];  // Base64 encoded EC points
  tallyVersion: number;
  reactionCount: number;
}

// Extended response type including reaction tallies
export interface FetchMessagesResponse {
  messages: FeedMessage[];
  maxBlockIndex: number;
  reactionTallies: ServerReactionTally[];
  maxReactionTallyVersion: number;
}

/**
 * Fetches feeds for an address since a specific block index.
 * Used for incremental sync.
 */
export async function fetchFeeds(
  address: string,
  blockIndex: number
): Promise<{ feeds: Feed[]; maxBlockIndex: number }> {
  const url = buildApiUrl(`/api/feeds/list?address=${encodeURIComponent(address)}&blockIndex=${blockIndex}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch feeds: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.feeds || !Array.isArray(data.feeds)) {
    return { feeds: [], maxBlockIndex: blockIndex };
  }

  // Convert server feeds to app feed format
  const feeds: Feed[] = data.feeds.map((feed: ServerFeed) => {
    // Find the encrypted feed key for the current user
    const userParticipant = feed.participants?.find(
      (p) => p.participantPublicAddress === address
    );

    // Find the other participant (for chat feeds)
    const otherParticipant = feed.participants?.find(
      (p) => p.participantPublicAddress !== address
    );

    return {
      id: feed.feedId,
      type: FEED_TYPE_MAP[feed.feedType] || 'chat',
      name: feed.feedTitle || (feed.feedType === 0 ? 'Personal Feed' : 'Chat'),
      participants: feed.participants?.map((p) => p.participantPublicAddress) || [],
      unreadCount: 0,
      createdAt: feed.blockIndex,
      updatedAt: feed.blockIndex,
      blockIndex: feed.blockIndex,
      // Store encrypted feed key for current user (will be decrypted later)
      encryptedFeedKey: userParticipant?.encryptedFeedKey || undefined,
      // Store other participant's address for detecting existing feeds
      otherParticipantPublicSigningAddress: otherParticipant?.participantPublicAddress,
      // FEAT-051: Last read block index from server (default to 0 if not present for backward compatibility)
      lastReadBlockIndex: feed.lastReadBlockIndex || 0,
    };
  });

  // Calculate max block index from response
  const maxBlockIndex = feeds.length > 0
    ? Math.max(...feeds.map((f) => f.createdAt), blockIndex)
    : blockIndex;

  return { feeds, maxBlockIndex };
}

/**
 * Fetches messages for an address since a specific block index.
 * Also fetches reaction tallies for incremental sync (Protocol Omega).
 * Used for incremental sync.
 */
export async function fetchMessages(
  address: string,
  blockIndex: number,
  lastReactionTallyVersion: number = 0
): Promise<FetchMessagesResponse> {
  const params = new URLSearchParams({
    address,
    blockIndex: blockIndex.toString(),
    lastReactionTallyVersion: lastReactionTallyVersion.toString(),
  });

  const response = await fetch(buildApiUrl(`/api/feeds/messages?${params}`));

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.messages || !Array.isArray(data.messages)) {
    return {
      messages: [],
      maxBlockIndex: blockIndex,
      reactionTallies: [],
      maxReactionTallyVersion: lastReactionTallyVersion,
    };
  }

  // Convert server messages to app message format
  const messages: FeedMessage[] = data.messages.map((msg: ServerMessage) => {
    return {
      id: msg.feedMessageId,
      feedId: msg.feedId,
      content: msg.messageContent,
      senderPublicKey: msg.issuerPublicAddress,
      senderName: msg.issuerName || undefined,  // Display name from server (current name at sync time)
      timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
      blockHeight: msg.blockIndex,
      isConfirmed: true,
      replyToMessageId: msg.replyToMessageId || undefined,  // Reply to Message: pass through parent reference
      keyGeneration: msg.keyGeneration,  // Group Feeds: key generation used for encryption
    };
  });

  // Calculate max block index from response
  const maxBlockIndex = messages.length > 0
    ? Math.max(...messages.map((m) => m.blockHeight || 0), blockIndex)
    : blockIndex;

  return {
    messages,
    maxBlockIndex,
    reactionTallies: data.reactionTallies || [],
    maxReactionTallyVersion: data.maxReactionTallyVersion ?? lastReactionTallyVersion,
  };
}

/**
 * Checks if a personal feed exists for an address.
 */
export async function checkHasPersonalFeed(address: string): Promise<boolean> {
  const response = await fetch(
    buildApiUrl(`/api/feeds/has-personal?address=${encodeURIComponent(address)}`)
  );

  if (!response.ok) {
    throw new Error(`Failed to check personal feed: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.hasPersonalFeed === true;
}

/**
 * Submits a transaction to the blockchain.
 */
export async function submitTransaction(signedTransaction: string): Promise<{
  successful: boolean;
  message: string;
}> {
  const response = await fetch(buildApiUrl('/api/blockchain/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit transaction: HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    successful: data.successful ?? false,
    message: data.message ?? data.error ?? '',
  };
}

/**
 * Sends a message to a feed.
 * Implements optimistic UI - message appears immediately, then gets confirmed on sync.
 *
 * @param feedId The feed to send the message to
 * @param messageContent The message text (will be encrypted)
 * @param replyToMessageId Optional: ID of the message being replied to
 * @returns The message ID (GUID) for tracking
 */
export async function sendMessage(
  feedId: string,
  messageContent: string,
  replyToMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const credentials = useAppStore.getState().credentials;
  const feed = useFeedsStore.getState().getFeed(feedId);

  // Validate credentials
  if (!credentials?.signingPrivateKey || !credentials?.signingPublicKey) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate feed
  if (!feed) {
    return { success: false, error: 'Feed not found' };
  }

  // Determine the AES key to use for encryption
  // For group feeds, use the current KeyGeneration's key from groupKeyStates
  // For other feeds (personal, chat), use the feed's direct aesKey
  let aesKey: string | undefined;

  if (feed.type === 'group') {
    // Group feeds: use the current KeyGeneration's key
    aesKey = useFeedsStore.getState().getCurrentGroupKey(feedId);
    if (!aesKey) {
      const keyState = useFeedsStore.getState().getGroupKeyState(feedId);
      debugError(`[FeedsService] No current group key for feed ${feedId}. KeyState:`, {
        hasKeyState: !!keyState,
        currentKeyGen: keyState?.currentKeyGeneration,
        keyCount: keyState?.keyGenerations.length,
      });
      return { success: false, error: 'Group encryption key not available. You may need to wait for key sync.' };
    }
  } else {
    // Non-group feeds: use the feed's direct AES key
    aesKey = feed.aesKey;
    if (!aesKey) {
      return { success: false, error: 'Feed encryption key not available' };
    }
  }

  try {
    // Convert private key from hex to bytes
    const privateKeyBytes = hexToBytes(credentials.signingPrivateKey);

    // Create and sign the transaction
    const { signedTransaction, messageId } = await createFeedMessageTransaction(
      feedId,
      messageContent,
      aesKey,
      privateKeyBytes,
      credentials.signingPublicKey,
      replyToMessageId
    );

    // Create optimistic message for immediate UI display
    const optimisticMessage: FeedMessage = {
      id: messageId,
      feedId,
      content: messageContent, // Already decrypted for display
      senderPublicKey: credentials.signingPublicKey,
      timestamp: Date.now(),
      isConfirmed: false, // Not yet confirmed - will show single checkmark
      replyToMessageId: replyToMessageId || undefined,  // Reply to Message: pass through parent reference
    };

    // Add to store immediately (optimistic UI)
    useFeedsStore.getState().addPendingMessage(feedId, optimisticMessage);

    debugLog(`[FeedsService] Sending message ${messageId} to feed ${feedId}`);

    // Submit to blockchain
    const result = await submitTransaction(signedTransaction);

    if (!result.successful) {
      debugError(`[FeedsService] Message submission failed: ${result.message}`);
      // Note: We could remove the optimistic message here, but keeping it
      // allows the user to see what failed and potentially retry
      return { success: false, messageId, error: result.message };
    }

    debugLog(`[FeedsService] Message ${messageId} submitted successfully`);
    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debugError(`[FeedsService] Send message failed:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Finds an existing chat feed with a given participant.
 * Returns the feed if found, null otherwise.
 */
export function findExistingChatFeed(participantPublicSigningAddress: string): Feed | null {
  const feeds = useFeedsStore.getState().feeds;
  const credentials = useAppStore.getState().credentials;
  const ownAddress = credentials?.signingPublicKey;

  // Find a chat feed where the other participant matches
  const existingFeed = feeds.find((feed) => {
    if (feed.type !== 'chat') return false;

    // Check otherParticipantPublicSigningAddress first (new field)
    if (feed.otherParticipantPublicSigningAddress === participantPublicSigningAddress) {
      return true;
    }

    // Fallback: check participants array (for feeds loaded before this field was added)
    if (feed.participants && feed.participants.length > 0) {
      // Find the other participant (not the current user)
      const otherParticipant = feed.participants.find((p) => p !== ownAddress);
      if (otherParticipant === participantPublicSigningAddress) {
        return true;
      }
    }

    return false;
  });

  return existingFeed || null;
}

/**
 * Creates a new chat feed with another user.
 * If a feed already exists with this user, returns the existing feed ID instead.
 *
 * @param profile The profile of the user to chat with
 * @returns Result with feedId (existing or newly created)
 */
export async function createChatFeed(
  profile: ProfileSearchResult
): Promise<{ success: boolean; feedId?: string; isExisting?: boolean; error?: string }> {
  const credentials = useAppStore.getState().credentials;

  // Validate credentials
  if (
    !credentials?.signingPrivateKey ||
    !credentials?.signingPublicKey ||
    !credentials?.encryptionPublicKey
  ) {
    return { success: false, error: 'Not authenticated' };
  }

  // Check if we already have a feed with this user
  const existingFeed = findExistingChatFeed(profile.publicSigningAddress);
  if (existingFeed) {
    debugLog(`[FeedsService] Found existing feed ${existingFeed.id} with ${profile.displayName}`);
    return { success: true, feedId: existingFeed.id, isExisting: true };
  }

  try {
    // Convert private key from hex to bytes
    const privateKeyBytes = hexToBytes(credentials.signingPrivateKey);

    // Create and sign the transaction
    const { signedTransaction, feedId, feedAesKey } = await createChatFeedTransaction(
      credentials.signingPublicKey,
      credentials.encryptionPublicKey,
      profile.publicSigningAddress,
      profile.publicEncryptAddress,
      privateKeyBytes
    );

    debugLog(`[FeedsService] Creating new chat feed ${feedId} with ${profile.displayName}`);

    // Submit to blockchain
    const result = await submitTransaction(signedTransaction);

    if (!result.successful) {
      debugError(`[FeedsService] Feed creation failed: ${result.message}`);
      return { success: false, error: result.message };
    }

    // Add optimistic feed to store immediately
    const optimisticFeed: Feed = {
      id: feedId,
      type: 'chat',
      name: profile.displayName,
      participants: [credentials.signingPublicKey, profile.publicSigningAddress],
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      aesKey: feedAesKey,
      otherParticipantPublicSigningAddress: profile.publicSigningAddress,
    };

    useFeedsStore.getState().addFeeds([optimisticFeed]);

    debugLog(`[FeedsService] Feed ${feedId} created successfully`);
    return { success: true, feedId, isExisting: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debugError(`[FeedsService] Create chat feed failed:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * FEAT-051: Marks a feed as read up to a specific block index.
 * This is a fire-and-forget operation - errors are logged but not thrown.
 *
 * @param feedId The feed to mark as read
 * @param upToBlockIndex The block index up to which the user has read
 * @param userPublicAddress The user's public signing address
 * @returns true if successful, false otherwise
 */
export async function markFeedAsRead(
  feedId: string,
  upToBlockIndex: number,
  userPublicAddress: string
): Promise<boolean> {
  // Skip if block index is 0 or negative (nothing to mark)
  if (upToBlockIndex <= 0) {
    return true;
  }

  try {
    const response = await fetch(buildApiUrl('/api/feeds/mark-read'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedId,
        upToBlockIndex,
        userPublicAddress,
      }),
    });

    if (!response.ok) {
      debugError(`[FeedsService] markFeedAsRead failed: HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();

    if (!data.success) {
      debugError(`[FeedsService] markFeedAsRead failed: ${data.message || 'Unknown error'}`);
      return false;
    }

    debugLog(`[FeedsService] Marked feed ${feedId} as read up to block ${upToBlockIndex}`);
    return true;
  } catch (error) {
    // Log but don't throw - this is non-critical functionality
    debugError(`[FeedsService] markFeedAsRead error:`, error);
    return false;
  }
}

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

// Server feed response type
interface ServerFeed {
  feedId: string;
  feedTitle: string;
  feedOwner: string;
  feedType: number;
  blockIndex: number;
  participants: { participantPublicAddress: string; encryptedFeedKey?: string }[];
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
}

/**
 * Fetches feeds for an address since a specific block index.
 * Used for incremental sync.
 */
export async function fetchFeeds(
  address: string,
  blockIndex: number
): Promise<{ feeds: Feed[]; maxBlockIndex: number }> {
  const url = `/api/feeds/list?address=${encodeURIComponent(address)}&blockIndex=${blockIndex}`;

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
      // Store encrypted feed key for current user (will be decrypted later)
      encryptedFeedKey: userParticipant?.encryptedFeedKey || undefined,
      // Store other participant's address for detecting existing feeds
      otherParticipantPublicSigningAddress: otherParticipant?.participantPublicAddress,
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
 * Used for incremental sync.
 */
export async function fetchMessages(
  address: string,
  blockIndex: number
): Promise<{ messages: FeedMessage[]; maxBlockIndex: number }> {
  const response = await fetch(
    `/api/feeds/messages?address=${encodeURIComponent(address)}&blockIndex=${blockIndex}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.messages || !Array.isArray(data.messages)) {
    return { messages: [], maxBlockIndex: blockIndex };
  }

  // Convert server messages to app message format
  const messages: FeedMessage[] = data.messages.map((msg: ServerMessage) => ({
    id: msg.feedMessageId,
    feedId: msg.feedId,
    content: msg.messageContent,
    senderPublicKey: msg.issuerPublicAddress,
    timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
    blockHeight: msg.blockIndex,
    isConfirmed: true,
  }));

  // Calculate max block index from response
  const maxBlockIndex = messages.length > 0
    ? Math.max(...messages.map((m) => m.blockHeight || 0), blockIndex)
    : blockIndex;

  return { messages, maxBlockIndex };
}

/**
 * Checks if a personal feed exists for an address.
 */
export async function checkHasPersonalFeed(address: string): Promise<boolean> {
  const response = await fetch(
    `/api/feeds/has-personal?address=${encodeURIComponent(address)}`
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
  const response = await fetch('/api/blockchain/submit', {
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
 * @returns The message ID (GUID) for tracking
 */
export async function sendMessage(
  feedId: string,
  messageContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const credentials = useAppStore.getState().credentials;
  const feed = useFeedsStore.getState().getFeed(feedId);

  // Validate credentials
  if (!credentials?.signingPrivateKey || !credentials?.signingPublicKey) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate feed and AES key
  if (!feed) {
    return { success: false, error: 'Feed not found' };
  }

  if (!feed.aesKey) {
    return { success: false, error: 'Feed encryption key not available' };
  }

  try {
    // Convert private key from hex to bytes
    const privateKeyBytes = hexToBytes(credentials.signingPrivateKey);

    // Create and sign the transaction
    const { signedTransaction, messageId } = await createFeedMessageTransaction(
      feedId,
      messageContent,
      feed.aesKey,
      privateKeyBytes,
      credentials.signingPublicKey
    );

    // Create optimistic message for immediate UI display
    const optimisticMessage: FeedMessage = {
      id: messageId,
      feedId,
      content: messageContent, // Already decrypted for display
      senderPublicKey: credentials.signingPublicKey,
      timestamp: Date.now(),
      isConfirmed: false, // Not yet confirmed - will show single checkmark
    };

    // Add to store immediately (optimistic UI)
    useFeedsStore.getState().addPendingMessage(feedId, optimisticMessage);

    console.log(`[FeedsService] Sending message ${messageId} to feed ${feedId}`);

    // Submit to blockchain
    const result = await submitTransaction(signedTransaction);

    if (!result.successful) {
      console.error(`[FeedsService] Message submission failed: ${result.message}`);
      // Note: We could remove the optimistic message here, but keeping it
      // allows the user to see what failed and potentially retry
      return { success: false, messageId, error: result.message };
    }

    console.log(`[FeedsService] Message ${messageId} submitted successfully`);
    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[FeedsService] Send message failed:`, error);
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
    console.log(`[FeedsService] Found existing feed ${existingFeed.id} with ${profile.displayName}`);
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

    console.log(`[FeedsService] Creating new chat feed ${feedId} with ${profile.displayName}`);

    // Submit to blockchain
    const result = await submitTransaction(signedTransaction);

    if (!result.successful) {
      console.error(`[FeedsService] Feed creation failed: ${result.message}`);
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

    console.log(`[FeedsService] Feed ${feedId} created successfully`);
    return { success: true, feedId, isExisting: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[FeedsService] Create chat feed failed:`, error);
    return { success: false, error: errorMessage };
  }
}

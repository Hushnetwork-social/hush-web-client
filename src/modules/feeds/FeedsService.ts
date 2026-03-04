/**
 * Feeds Service
 *
 * Handles API calls for feeds and messages.
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { Feed, FeedMessage, ProfileSearchResult, AttachmentRefMeta } from '@/types';
import {
  createFeedMessageTransaction,
  createChatFeedTransaction,
  createCreateInnerCircleTransaction,
  createAddMembersToInnerCircleTransaction,
  createCreateCustomCircleTransaction,
  createAddMembersToCustomCircleTransaction,
  generateGuid,
  hexToBytes,
  type AttachmentRefPayload,
  type CustomCircleMemberPayload,
} from '@/lib/crypto';
import { FEED_TYPE_MAP, useFeedsStore } from './useFeedsStore';
import { useAppStore } from '@/stores';
import { buildApiUrl } from '@/lib/api-config';
import { debugLog, debugError } from '@/lib/debug-logger';
import { checkIdentityExists } from '../identity/IdentityService';
import { groupService } from '@/lib/grpc/services/group';

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

// FEAT-066: Server attachment reference in message response
interface ServerAttachmentRef {
  id: string;
  hash: string;
  mimeType: string;
  size: number;
  fileName: string;
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
  attachments?: ServerAttachmentRef[];  // FEAT-066: Attachment metadata
}

interface InnerCircleResponse {
  success: boolean;
  message?: string;
  exists: boolean;
  feedId?: string;
}

export enum CircleOperationErrorCode {
  NONE = 'NONE',
  DUPLICATE = 'DUPLICATE',
  ELIGIBILITY = 'ELIGIBILITY',
  OWNERSHIP = 'OWNERSHIP',
  NAME = 'NAME',
  LIMIT = 'LIMIT',
  REJECTED = 'REJECTED',
  UNKNOWN = 'UNKNOWN',
}

export interface CircleOperationResult {
  success: boolean;
  message: string;
  errorCode: CircleOperationErrorCode;
  retryable: boolean;
  status: TransactionStatus;
  feedId?: string;
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
  // FEAT-062: Use blockIndex (not createdAt) since createdAt is now preserved from first creation
  const maxBlockIndex = feeds.length > 0
    ? Math.max(...feeds.map((f) => f.blockIndex ?? 0), blockIndex)
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
      attachments: parseAttachments(msg.attachments),  // FEAT-066
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

export async function getInnerCircle(ownerAddress: string): Promise<InnerCircleResponse> {
  const response = await fetch(
    buildApiUrl(`/api/feeds/inner-circle?ownerAddress=${encodeURIComponent(ownerAddress)}`)
  );

  if (!response.ok) {
    throw new Error(`Failed to get inner circle: HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    success: data.success === true,
    message: data.message,
    exists: data.exists === true,
    feedId: data.feedId,
  };
}

export async function ensureInnerCircleForOwner(
  ownerAddress: string,
  signingPrivateKeyHex: string
): Promise<{ success: boolean; retryable: boolean; message: string }> {
  const signingPrivateKey = hexToBytes(signingPrivateKeyHex);

  let innerCircle = await getInnerCircle(ownerAddress);
  if (!innerCircle.exists) {
    debugLog('[FeedsService] Inner circle not found, submitting create transaction');
    const { signedTransaction } = await createCreateInnerCircleTransaction(ownerAddress, signingPrivateKey);
    const createResult = await submitTransaction(signedTransaction);

    if (!createResult.successful && createResult.status !== TransactionStatus.ALREADY_EXISTS) {
      return {
        success: false,
        retryable: true,
        message: createResult.message || 'Failed to create inner circle',
      };
    }

    innerCircle = await getInnerCircle(ownerAddress);
    if (!innerCircle.exists || !innerCircle.feedId) {
      return {
        success: false,
        retryable: true,
        message: 'Inner circle creation pending confirmation',
      };
    }
  }

  if (!innerCircle.feedId) {
    return {
      success: false,
      retryable: true,
      message: 'Inner circle feed id is unavailable',
    };
  }

  const existingMembers = new Set(
    (await groupService.getGroupMembers(innerCircle.feedId)).map((member) => member.publicAddress)
  );

  const chatFeeds = useFeedsStore
    .getState()
    .feeds.filter((feed) => feed.type === 'chat');

  const targetAddresses = Array.from(
    new Set(
      chatFeeds
        .map((feed) => feed.otherParticipantPublicSigningAddress || feed.participants.find((p) => p !== ownerAddress))
        .filter((address): address is string => typeof address === 'string' && address.length > 0)
    )
  )
    .filter((address) => address !== ownerAddress)
    .filter((address) => !existingMembers.has(address))
    .slice(0, 100);

  if (targetAddresses.length === 0) {
    return {
      success: true,
      retryable: false,
      message: 'Inner circle is up to date',
    };
  }

  const resolvedMembers = await Promise.all(
    targetAddresses.map(async (address) => {
      const identity = await checkIdentityExists(address);
      if (!identity.exists || !identity.publicEncryptAddress) {
        return null;
      }
      return {
        PublicAddress: address,
        PublicEncryptAddress: identity.publicEncryptAddress,
      };
    })
  );

  const validMembers = resolvedMembers.filter((member): member is { PublicAddress: string; PublicEncryptAddress: string } => member !== null);
  if (validMembers.length === 0) {
    return {
      success: true,
      retryable: false,
      message: 'No valid members to add to inner circle',
    };
  }

  const { signedTransaction } = await createAddMembersToInnerCircleTransaction(
    ownerAddress,
    validMembers,
    signingPrivateKey
  );
  const addResult = await submitTransaction(signedTransaction);

  if (!addResult.successful && addResult.status !== TransactionStatus.ALREADY_EXISTS && addResult.status !== TransactionStatus.PENDING) {
    const unauthorized = (addResult.message || '').includes('UNAUTHORIZED');
    return {
      success: false,
      retryable: !unauthorized,
      message: addResult.message || 'Failed to add members to inner circle',
    };
  }

  return {
    success: true,
    retryable: false,
    message: `Inner circle synced (${validMembers.length} member(s) processed)`,
  };
}

function normalizeCircleError(
  status: TransactionStatus,
  message: string | undefined
): CircleOperationErrorCode {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('duplicate') || normalized.includes('already exists')) {
    return CircleOperationErrorCode.DUPLICATE;
  }
  if (normalized.includes('follow') || normalized.includes('eligible') || normalized.includes('chat feed')) {
    return CircleOperationErrorCode.ELIGIBILITY;
  }
  if (normalized.includes('owner') || normalized.includes('unauthorized')) {
    return CircleOperationErrorCode.OWNERSHIP;
  }
  if (normalized.includes('name') || normalized.includes('circle')) {
    return CircleOperationErrorCode.NAME;
  }
  if (normalized.includes('limit') || normalized.includes('max') || normalized.includes('between 1 and 100')) {
    return CircleOperationErrorCode.LIMIT;
  }
  if (status === TransactionStatus.REJECTED) {
    return CircleOperationErrorCode.REJECTED;
  }
  return CircleOperationErrorCode.UNKNOWN;
}

function validateCustomCircleName(circleName: string): CircleOperationResult | null {
  const trimmed = circleName.trim();
  if (trimmed.length < 3 || trimmed.length > 40 || !/^[A-Za-z0-9 _-]+$/.test(trimmed)) {
    return {
      success: false,
      message: 'Circle name must be 3-40 chars and use letters, numbers, spaces, hyphen, underscore',
      errorCode: CircleOperationErrorCode.NAME,
      retryable: false,
      status: TransactionStatus.REJECTED,
    };
  }

  return null;
}

export async function createCustomCircle(
  ownerPublicAddress: string,
  circleName: string,
  signingPrivateKeyHex: string,
  feedId: string = generateGuid()
): Promise<CircleOperationResult> {
  const nameValidation = validateCustomCircleName(circleName);
  if (nameValidation) {
    return nameValidation;
  }

  const signingPrivateKey = hexToBytes(signingPrivateKeyHex);
  const { signedTransaction } = await createCreateCustomCircleTransaction(
    feedId,
    ownerPublicAddress,
    circleName.trim(),
    signingPrivateKey
  );
  const result = await submitTransaction(signedTransaction);

  if (result.successful || result.status === TransactionStatus.ALREADY_EXISTS) {
    return {
      success: true,
      message: result.message || 'Custom circle transaction accepted',
      errorCode: CircleOperationErrorCode.NONE,
      retryable: false,
      status: result.status,
      feedId,
    };
  }

  const errorCode = normalizeCircleError(result.status, result.message);
  const retryable = result.status === TransactionStatus.PENDING || errorCode === CircleOperationErrorCode.UNKNOWN;
  return {
    success: false,
    message: result.message || 'Failed to create custom circle',
    errorCode,
    retryable,
    status: result.status,
  };
}

function validateCustomCircleMembers(members: CustomCircleMemberPayload[]): CircleOperationResult | null {
  if (members.length === 0 || members.length > 100) {
    return {
      success: false,
      message: 'Members must contain between 1 and 100 users',
      errorCode: CircleOperationErrorCode.LIMIT,
      retryable: false,
      status: TransactionStatus.REJECTED,
    };
  }

  const addresses = members.map((member) => member.PublicAddress.trim());
  if (addresses.some((address) => address.length === 0)) {
    return {
      success: false,
      message: 'All members must include a valid address',
      errorCode: CircleOperationErrorCode.ELIGIBILITY,
      retryable: false,
      status: TransactionStatus.REJECTED,
    };
  }

  const uniqueCount = new Set(addresses).size;
  if (uniqueCount !== addresses.length) {
    return {
      success: false,
      message: 'Duplicate members are not allowed in the same request',
      errorCode: CircleOperationErrorCode.DUPLICATE,
      retryable: false,
      status: TransactionStatus.REJECTED,
    };
  }

  return null;
}

export async function addMembersToCustomCircle(
  feedId: string,
  ownerPublicAddress: string,
  members: CustomCircleMemberPayload[],
  signingPrivateKeyHex: string
): Promise<CircleOperationResult> {
  const membersValidation = validateCustomCircleMembers(members);
  if (membersValidation) {
    return membersValidation;
  }

  const signingPrivateKey = hexToBytes(signingPrivateKeyHex);
  const { signedTransaction } = await createAddMembersToCustomCircleTransaction(
    feedId,
    ownerPublicAddress,
    members,
    signingPrivateKey
  );
  const result = await submitTransaction(signedTransaction);

  if (result.successful || result.status === TransactionStatus.ALREADY_EXISTS) {
    return {
      success: true,
      message: result.message || 'Custom circle add-members transaction accepted',
      errorCode: CircleOperationErrorCode.NONE,
      retryable: false,
      status: result.status,
      feedId,
    };
  }

  const errorCode = normalizeCircleError(result.status, result.message);
  const retryable = result.status === TransactionStatus.PENDING || errorCode === CircleOperationErrorCode.UNKNOWN;
  return {
    success: false,
    message: result.message || 'Failed to add members to custom circle',
    errorCode,
    retryable,
    status: result.status,
    feedId,
  };
}

/**
 * FEAT-057: Transaction status for idempotency responses
 */
export enum TransactionStatus {
  UNSPECIFIED = 0,      // Default for backward compatibility
  ACCEPTED = 1,         // New transaction accepted
  ALREADY_EXISTS = 2,   // Duplicate found in database (already confirmed)
  PENDING = 3,          // Duplicate found in MemPool (still pending)
  REJECTED = 4,         // Transaction validation failed
}

/** FEAT-067: Base64-encoded attachment blob for JSON transport to the API route. */
export interface AttachmentBlobPayload {
  attachmentId: string;
  encryptedOriginal: string; // base64
  encryptedThumbnail?: string; // base64
}

/**
 * Submits a transaction to the blockchain.
 * Returns transaction status for idempotency handling (FEAT-057/FEAT-058).
 * @param signedTransaction The signed transaction JSON string
 * @param attachments FEAT-067: Optional base64-encoded attachment blobs
 */
export async function submitTransaction(
  signedTransaction: string,
  attachments?: AttachmentBlobPayload[],
): Promise<{
  successful: boolean;
  message: string;
  status: TransactionStatus;
}> {
  const response = await fetch(buildApiUrl('/api/blockchain/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedTransaction,
      ...(attachments && attachments.length > 0 && { attachments }),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit transaction: HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    successful: data.successful ?? false,
    message: data.message ?? data.error ?? '',
    status: data.status ?? TransactionStatus.UNSPECIFIED,
  };
}

/** FEAT-067: Pre-processed attachment data ready for submission. */
export interface ProcessedAttachment {
  ref: AttachmentRefPayload;
  blobPayload: AttachmentBlobPayload;
  /** Attachment metadata for optimistic message display */
  meta: AttachmentRefMeta;
}

/**
 * Sends a message to a feed.
 * Implements optimistic UI - message appears immediately, then gets confirmed on sync.
 *
 * @param feedId The feed to send the message to
 * @param messageContent The message text (will be encrypted)
 * @param replyToMessageId Optional: ID of the message being replied to
 * @param processedAttachments Optional: FEAT-067 pre-processed attachment data
 * @returns The message ID (GUID) for tracking
 */
export async function sendMessage(
  feedId: string,
  messageContent: string,
  replyToMessageId?: string,
  processedAttachments?: ProcessedAttachment[],
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
  let keyGeneration: number | undefined;

  if (feed.type === 'group') {
    // Group feeds: use the current KeyGeneration's key
    aesKey = useFeedsStore.getState().getCurrentGroupKey(feedId);
    const keyState = useFeedsStore.getState().getGroupKeyState(feedId);
    keyGeneration = keyState?.currentKeyGeneration;

    debugLog(`[FeedsService] Group message - feedId=${feedId.substring(0, 8)}..., keyGeneration=${keyGeneration}, hasAesKey=${!!aesKey}, keyCount=${keyState?.keyGenerations.length ?? 0}`);

    if (!aesKey) {
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

    // FEAT-067: Extract attachment refs for the signed payload
    const attachmentRefs = processedAttachments?.map(a => a.ref);

    // Create and sign the transaction
    const { signedTransaction, messageId } = await createFeedMessageTransaction(
      feedId,
      messageContent,
      aesKey,
      privateKeyBytes,
      credentials.signingPublicKey,
      replyToMessageId,
      keyGeneration,
      undefined, // existingMessageId
      attachmentRefs,
    );

    // FEAT-058: Create optimistic message with retry tracking fields
    const now = Date.now();
    const optimisticMessage: FeedMessage = {
      id: messageId,
      feedId,
      content: messageContent, // Already decrypted for display
      senderPublicKey: credentials.signingPublicKey,
      timestamp: now,
      isConfirmed: false, // Not yet confirmed - will show single checkmark
      replyToMessageId: replyToMessageId || undefined,  // Reply to Message: pass through parent reference
      // FEAT-067: Include attachment metadata for immediate thumbnail display
      ...(processedAttachments && processedAttachments.length > 0 && {
        attachments: processedAttachments.map(a => a.meta),
      }),
      // FEAT-058: Retry tracking fields
      status: 'pending',
      retryCount: 0,
      lastAttemptTime: now,
      contentPlaintext: messageContent,  // Store for re-encryption on retry
      keyGeneration,  // Store for group feed retry re-encryption check
    };

    // Add to store immediately (optimistic UI)
    useFeedsStore.getState().addPendingMessage(feedId, optimisticMessage);

    debugLog(`[FeedsService] Sending message ${messageId} to feed ${feedId}`);

    // FEAT-067: Extract blob payloads for submission
    const attachmentBlobs = processedAttachments?.map(a => a.blobPayload);

    // Submit to blockchain (with attachment blobs if present)
    const result = await submitTransaction(signedTransaction, attachmentBlobs);

    // FEAT-058: Update message status based on transaction result
    if (!result.successful) {
      debugError(`[FeedsService] Message submission failed: ${result.message}`);
      // Keep message in pending state for automatic retry
      // The FeedsSyncable will retry these messages
      return { success: false, messageId, error: result.message };
    }

    // FEAT-058: Handle transaction status for idempotency
    if (result.status === TransactionStatus.ALREADY_EXISTS) {
      // Message was already confirmed - mark as confirmed immediately
      debugLog(`[FeedsService] Message ${messageId} already exists (confirmed)`);
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        status: 'confirmed',
      });
    } else if (result.status === TransactionStatus.ACCEPTED) {
      // Message accepted - waiting for block confirmation
      debugLog(`[FeedsService] Message ${messageId} accepted, awaiting confirmation`);
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        status: 'confirming',
        lastAttemptTime: Date.now(),
        retryCount: 1,  // First attempt completed
      });
    }
    // For PENDING status, leave as-is - will be handled by sync

    debugLog(`[FeedsService] Message ${messageId} submitted successfully (status: ${TransactionStatus[result.status]})`);
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
    const requestInnerCircleRetry = (
      useAppStore.getState() as { requestInnerCircleRetry?: () => void }
    ).requestInnerCircleRetry;
    requestInnerCircleRetry?.();

    debugLog(`[FeedsService] Feed ${feedId} created successfully`);
    return { success: true, feedId, isExisting: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debugError(`[FeedsService] Create chat feed failed:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * FEAT-058: Retries sending a failed or pending message.
 * Re-encrypts the message content if needed (for group feeds with new key generation).
 *
 * @param feedId The feed containing the message
 * @param messageId The message ID to retry
 * @param isManualRetry If true, resets the retry count (user-initiated retry)
 * @returns Result with transaction status
 */
export async function retryMessage(
  feedId: string,
  messageId: string,
  isManualRetry: boolean = false
): Promise<{
  success: boolean;
  status: TransactionStatus;
  error?: string;
}> {
  const credentials = useAppStore.getState().credentials;
  const feed = useFeedsStore.getState().getFeed(feedId);
  const messages = useFeedsStore.getState().messages[feedId] ?? [];
  const message = messages.find((m) => m.id === messageId);

  // Validate credentials
  if (!credentials?.signingPrivateKey || !credentials?.signingPublicKey) {
    return { success: false, status: TransactionStatus.REJECTED, error: 'Not authenticated' };
  }

  // Validate feed
  if (!feed) {
    return { success: false, status: TransactionStatus.REJECTED, error: 'Feed not found' };
  }

  // Validate message
  if (!message) {
    return { success: false, status: TransactionStatus.REJECTED, error: 'Message not found' };
  }

  // Get plaintext content for re-encryption
  const messageContent = message.contentPlaintext ?? message.content;
  if (!messageContent) {
    return { success: false, status: TransactionStatus.REJECTED, error: 'Message content not available for retry' };
  }

  // Determine the AES key to use for encryption
  let aesKey: string | undefined;
  let keyGeneration: number | undefined;
  let needsReEncryption = false;

  if (feed.type === 'group') {
    // Group feeds: check if we need to re-encrypt with a newer key
    const keyState = useFeedsStore.getState().getGroupKeyState(feedId);
    keyGeneration = keyState?.currentKeyGeneration;
    aesKey = useFeedsStore.getState().getCurrentGroupKey(feedId);

    // If current key generation is higher than what message was encrypted with,
    // we need to re-encrypt
    if (message.keyGeneration !== undefined && keyGeneration !== undefined) {
      needsReEncryption = keyGeneration > message.keyGeneration;
    }

    debugLog(`[FeedsService] Retry group message - keyGeneration=${keyGeneration}, messageKeyGen=${message.keyGeneration}, needsReEncryption=${needsReEncryption}`);

    if (!aesKey) {
      debugError(`[FeedsService] No current group key for feed ${feedId} during retry`);
      return { success: false, status: TransactionStatus.REJECTED, error: 'Group encryption key not available' };
    }
  } else {
    // Non-group feeds: use the feed's direct AES key
    aesKey = feed.aesKey;
    if (!aesKey) {
      return { success: false, status: TransactionStatus.REJECTED, error: 'Feed encryption key not available' };
    }
  }

  try {
    // Convert private key from hex to bytes
    const privateKeyBytes = hexToBytes(credentials.signingPrivateKey);

    // Create and sign the transaction (will generate same messageId due to deterministic signature)
    // We pass the original messageId to ensure idempotency works
    const { signedTransaction } = await createFeedMessageTransaction(
      feedId,
      messageContent,
      aesKey,
      privateKeyBytes,
      credentials.signingPublicKey,
      message.replyToMessageId,
      keyGeneration,
      messageId  // Pass original messageId for idempotency
    );

    debugLog(`[FeedsService] Retrying message ${messageId} (manual=${isManualRetry})`);

    // Submit to blockchain
    const result = await submitTransaction(signedTransaction);

    // Handle transaction status
    if (result.status === TransactionStatus.ALREADY_EXISTS) {
      // Message was already confirmed on blockchain - mark as confirmed
      debugLog(`[FeedsService] Retry: Message ${messageId} already exists (confirmed)`);
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        status: 'confirmed',
      });
      return { success: true, status: result.status };
    }

    if (result.status === TransactionStatus.ACCEPTED) {
      // Message accepted - update retry state
      debugLog(`[FeedsService] Retry: Message ${messageId} accepted`);
      const currentRetryCount = message.retryCount ?? 0;
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        status: 'confirming',
        lastAttemptTime: Date.now(),
        retryCount: isManualRetry ? 1 : currentRetryCount + 1,
        // Update keyGeneration if re-encrypted with newer key
        ...(needsReEncryption && keyGeneration !== undefined && { keyGeneration }),
      });
      return { success: true, status: result.status };
    }

    if (result.status === TransactionStatus.PENDING) {
      // Message still pending in MemPool - don't increment retry count
      debugLog(`[FeedsService] Retry: Message ${messageId} still pending in MemPool`);
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        lastAttemptTime: Date.now(),
        // Don't increment retryCount for PENDING status
      });
      return { success: true, status: result.status };
    }

    if (result.status === TransactionStatus.REJECTED) {
      // Message was rejected - mark as failed
      debugError(`[FeedsService] Retry: Message ${messageId} rejected: ${result.message}`);
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        status: 'failed',
      });
      return { success: false, status: result.status, error: result.message };
    }

    // Default: treat as successful retry attempt
    if (result.successful) {
      const currentRetryCount = message.retryCount ?? 0;
      useFeedsStore.getState().updateMessageRetryState(feedId, messageId, {
        status: 'confirming',
        lastAttemptTime: Date.now(),
        retryCount: isManualRetry ? 1 : currentRetryCount + 1,
      });
      return { success: true, status: result.status };
    }

    debugError(`[FeedsService] Retry failed: ${result.message}`);
    return { success: false, status: result.status, error: result.message };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debugError(`[FeedsService] Retry message failed:`, error);
    return { success: false, status: TransactionStatus.REJECTED, error: errorMessage };
  }
}

// ============= FEAT-059: Per-Feed Pagination for Scroll-Based Prefetch =============

/**
 * Response type for per-feed pagination API
 */
export interface FetchFeedMessagesResponse {
  messages: FeedMessage[];
  hasMoreMessages: boolean;
  oldestBlockIndex: number;
  newestBlockIndex: number;
}

/**
 * FEAT-059: Fetches messages for a specific feed with cursor-based backward pagination.
 * Used for scroll-based prefetch buffering.
 *
 * @param feedId The specific feed to fetch messages from
 * @param beforeBlockIndex Optional cursor: return messages older than this block index (omit for newest)
 * @param limit Optional: Max messages to return (default: 100)
 * @returns Messages with pagination metadata
 */
export async function fetchFeedMessages(
  feedId: string,
  beforeBlockIndex?: number,
  limit?: number
): Promise<FetchFeedMessagesResponse> {
  const credentials = useAppStore.getState().credentials;
  const userAddress = credentials?.signingPublicKey;

  if (!userAddress) {
    debugError('[FeedsService] fetchFeedMessages: No user credentials');
    return {
      messages: [],
      hasMoreMessages: false,
      oldestBlockIndex: 0,
      newestBlockIndex: 0,
    };
  }

  const params = new URLSearchParams({
    feedId,
    userAddress,
  });

  if (beforeBlockIndex !== undefined && beforeBlockIndex > 0) {
    params.set('beforeBlockIndex', beforeBlockIndex.toString());
  }

  if (limit !== undefined && limit > 0) {
    params.set('limit', limit.toString());
  }

  const response = await fetch(buildApiUrl(`/api/feeds/messages-by-id?${params}`));

  if (!response.ok) {
    throw new Error(`Failed to fetch feed messages: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.messages || !Array.isArray(data.messages)) {
    return {
      messages: [],
      hasMoreMessages: false,
      oldestBlockIndex: 0,
      newestBlockIndex: 0,
    };
  }

  // Convert server messages to app message format
  const messages: FeedMessage[] = data.messages.map((msg: ServerMessage) => {
    return {
      id: msg.feedMessageId,
      feedId: msg.feedId,
      content: msg.messageContent,
      senderPublicKey: msg.issuerPublicAddress,
      senderName: msg.issuerName || undefined,
      timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
      blockHeight: msg.blockIndex,
      isConfirmed: true,
      replyToMessageId: msg.replyToMessageId || undefined,
      keyGeneration: msg.keyGeneration,
      attachments: parseAttachments(msg.attachments),  // FEAT-066
    };
  });

  return {
    messages,
    hasMoreMessages: data.hasMoreMessages ?? false,
    oldestBlockIndex: data.oldestBlockIndex ?? 0,
    newestBlockIndex: data.newestBlockIndex ?? 0,
  };
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

// ============= FEAT-066: Attachment Parsing Helper =============

/**
 * Parses server attachment references into client-side AttachmentRefMeta.
 * Returns undefined if no attachments (backward compatible with old messages).
 */
function parseAttachments(
  serverAttachments?: ServerAttachmentRef[]
): AttachmentRefMeta[] | undefined {
  if (!serverAttachments || serverAttachments.length === 0) {
    return undefined;
  }
  return serverAttachments.map((att) => ({
    id: att.id,
    hash: att.hash,
    mimeType: att.mimeType,
    size: att.size,
    fileName: att.fileName,
  }));
}

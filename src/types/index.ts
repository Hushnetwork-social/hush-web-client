// User/Identity types
export interface User {
  publicKey: string;
  displayName: string;
  initials: string;
}

// Group types (re-export from group.ts)
export type {
  GroupMemberRole,
  GroupFeedMember,
  PublicGroupInfo,
  GroupCreationData,
  GroupOperationResult,
  GroupParticipantData,
} from './group';

export {
  isGroupMemberRole,
  isGroupFeedMember,
  isPublicGroupInfo,
  isGroupCreationData,
} from './group';

// Group crypto types (re-export from group-crypto.ts)
export type {
  GroupKeyGeneration,
  GroupKeyState,
  GroupCryptoResult,
  GroupParticipantEncryptedKey,
  NewGroupFeedData,
  GroupMessageDecryptionContext,
} from './group-crypto';

export {
  isGroupKeyGeneration,
  isGroupKeyState,
  isGroupCryptoResult,
  isGroupParticipantEncryptedKey,
  isNewGroupFeedData,
  isGroupMessageDecryptionContext,
} from './group-crypto';

// Settings change record for group feeds (persisted for historical system messages)
export interface SettingsChangeRecord {
  /** Unique ID for this change record */
  id: string;
  /** Block index when the change was detected */
  blockIndex: number;
  /** Timestamp when the change was detected */
  timestamp: number;
  /** Name change: previous -> new */
  nameChange?: { previous: string; new: string };
  /** Description change: previous -> new */
  descriptionChange?: { previous: string; new: string };
  /** Visibility change: previous -> new */
  visibilityChange?: { previous: boolean; new: boolean };
}

// Feed types
export interface Feed {
  id: string;
  type: 'personal' | 'chat' | 'group' | 'broadcast';
  name: string;
  participants: string[];
  lastMessage?: FeedMessage;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
  /** Block index of the feed (for detecting changes during sync) */
  blockIndex?: number;
  /** Decrypted AES-256 key for message encryption/decryption (base64) */
  aesKey?: string;
  /** Encrypted feed key for current user (for key recovery) */
  encryptedFeedKey?: string;
  /** Public signing address of the other participant (for chat feeds) */
  otherParticipantPublicSigningAddress?: string;
  /** Flag indicating this feed has new data that needs to be fetched (blockIndex changed) */
  needsSync?: boolean;
  /** Group description (for group feeds) */
  description?: string;
  /** Whether the group is public (for group feeds) */
  isPublic?: boolean;
  /** Unique invite code for public groups (for sharing/joining) */
  inviteCode?: string;
  /** History of settings changes (for group feeds - used for historical system messages) */
  settingsChangeHistory?: SettingsChangeRecord[];
  /** FEAT-051: Last read block index for cross-device read sync (0 = not read) */
  lastReadBlockIndex?: number;
  /** FEAT-062: Client-only flag for optimistic sort boosting when pending messages exist */
  hasPendingMessages?: boolean;
}

// Profile search result type
export interface ProfileSearchResult {
  displayName: string;
  publicSigningAddress: string;
  publicEncryptAddress: string;
}

/**
 * FEAT-058: Message delivery status for retry tracking
 * - 'pending': Message created locally, not yet submitted to server
 * - 'confirming': Message submitted, waiting for block confirmation
 * - 'confirmed': Message confirmed in a block
 * - 'failed': Message failed after max retries
 */
export type MessageStatus = 'pending' | 'confirming' | 'confirmed' | 'failed';

// Message types
export interface FeedMessage {
  id: string;
  feedId: string;
  senderPublicKey: string;
  /** Display name of the sender (from server, current name at sync time) */
  senderName?: string;
  content: string;
  contentEncrypted?: string;
  timestamp: number;
  blockHeight?: number;
  /**
   * @deprecated Use status instead. Kept for backward compatibility during migration.
   * Will be removed in future version.
   */
  isConfirmed: boolean;
  replyToMessageId?: string;  // Reply to Message: parent message reference
  keyGeneration?: number;     // Group Feeds: Key generation used to encrypt this message
  decryptionFailed?: boolean; // True if message could not be decrypted (user lacks key)
  /** Whether user has read this message (based on lastReadBlockIndex) - undefined treated as unread */
  isRead?: boolean;

  // FEAT-058: Retry tracking fields
  /** Current delivery status of the message */
  status?: MessageStatus;
  /** Number of retry attempts made (0-3) */
  retryCount?: number;
  /** Unix timestamp of last send/retry attempt */
  lastAttemptTime?: number;
  /** Original plaintext content for re-encryption (group feeds only, transient) */
  contentPlaintext?: string;
}

/**
 * Per-feed cache metadata for message virtualization (FEAT-053)
 * and per-feed sync tracking (FEAT-054)
 * Tracks cache state to enable "Load More" pagination and selective sync
 */
export interface FeedCacheMetadata {
  /** Whether server has messages older than the current cache */
  hasOlderMessages: boolean;
  /** Block index of the oldest message in the local cache */
  oldestCachedBlockIndex: number;
  /** FEAT-054: Last synced message block index for this feed (enables selective sync) */
  lastSyncedMessageBlockIndex: number;
}

// Blockchain types
export interface BlockchainState {
  currentBlockHeight: number;
  isConnected: boolean;
  lastSyncTime: number;
}

// Bank types
export interface Balance {
  available: number;
  pending: number;
  currency: string;
}

// Credentials/Keys types
export interface Credentials {
  signingPublicKey: string;
  signingPrivateKey: string;
  encryptionPublicKey: string;
  encryptionPrivateKey: string;
  mnemonic?: string[];
}

// App state types
export interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser?: User;
  credentials?: Credentials;
}

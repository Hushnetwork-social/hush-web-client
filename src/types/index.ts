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
}

// Profile search result type
export interface ProfileSearchResult {
  displayName: string;
  publicSigningAddress: string;
  publicEncryptAddress: string;
}

// Message types
export interface FeedMessage {
  id: string;
  feedId: string;
  senderPublicKey: string;
  content: string;
  contentEncrypted?: string;
  timestamp: number;
  blockHeight?: number;
  isConfirmed: boolean;
  replyToMessageId?: string;  // Reply to Message: parent message reference
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

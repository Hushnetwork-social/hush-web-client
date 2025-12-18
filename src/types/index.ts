// User/Identity types
export interface User {
  publicKey: string;
  displayName: string;
  initials: string;
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
  /** Decrypted AES-256 key for message encryption/decryption (base64) */
  aesKey?: string;
  /** Encrypted feed key for current user (for key recovery) */
  encryptedFeedKey?: string;
  /** Public signing address of the other participant (for chat feeds) */
  otherParticipantPublicSigningAddress?: string;
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

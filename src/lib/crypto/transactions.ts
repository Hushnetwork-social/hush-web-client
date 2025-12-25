// Transaction creation and signing for HushNetwork
// Creates transactions compatible with HushNode's SignedTransaction<T> format
//
// This module follows the same pattern as HushClient:
// 1. Developers create UnsignedTransaction<T> using factory functions
// 2. Signing is done by a separate function that takes credentials
// 3. Returns SignedTransaction<T> for submission

import { signData, bytesToBase64, DerivedKeys } from './keys';
import { generateAesKey, eciesEncrypt, aesEncrypt } from './encryption';

// Payload GUIDs (match HushClient)
export const PAYLOAD_GUIDS = {
  FULL_IDENTITY: '351cd60b-3fdf-48d4-b608-e93c0100f7d0',
  UPDATE_IDENTITY: 'a7e3c4b2-1f8d-4e5a-9c6b-2d3e4f5a6b7c',
  NEW_PERSONAL_FEED: '70c718a9-14d0-4b70-ad37-fd8bfe184386',
  NEW_CHAT_FEED: '033c61f5-c6e3-4e43-9eb0-ac9c615110e3',
  NEW_FEED_MESSAGE: '3309d79b-92e9-4435-9b23-0de0b3d24264',
  NEW_REACTION: 'a7b3c2d1-e4f5-6789-abcd-ef0123456789',
};

// Feed types (match HushClient FeedType enum)
export const FEED_TYPES = {
  PERSONAL: 0,
  CHAT: 1,
  GROUP: 2,
  BROADCAST: 3,
};

// =============================================================================
// Transaction Types (matching server's SignedTransaction<T> structure)
// =============================================================================

// Signature info (matches HushShared.Blockchain.Model.SignatureInfo)
export interface SignatureInfo {
  Signatory: string;
  Signature: string;
}

/**
 * UnsignedTransaction<T> - matches server's UnsignedTransaction<T> structure
 * This is what developers create before signing
 */
export interface UnsignedTransaction<T> {
  TransactionId: string;
  PayloadKind: string;
  TransactionTimeStamp: string;
  Payload: T;
  PayloadSize: number;
}

/**
 * SignedTransaction<T> - matches server's SignedTransaction<T> structure
 * This is created by signing an UnsignedTransaction<T>
 */
export interface SignedTransaction<T> extends UnsignedTransaction<T> {
  UserSignature: SignatureInfo;
}

// =============================================================================
// Payload Interfaces
// =============================================================================

export interface FullIdentityPayload {
  IdentityAlias: string;
  PublicSigningAddress: string;
  PublicEncryptAddress: string;
  IsPublic: boolean;
}

// UpdateIdentityPayload - matches server's UpdateIdentityPayload record
export interface UpdateIdentityPayload {
  NewAlias: string;
}

// NewPersonalFeedPayload - matches server's NewPersonalFeedPayload record
export interface NewPersonalFeedPayload {
  FeedId: string;
  Title: string;
  FeedType: number;
  EncryptedFeedKey: string;
}

// NewFeedMessagePayload - matches server's NewFeedMessagePayload record
export interface NewFeedMessagePayload {
  FeedMessageId: string;
  FeedId: string;
  MessageContent: string; // Encrypted with feed's AES key
}

// ChatFeedParticipant - matches server's ChatFeedParticipant record
export interface ChatFeedParticipant {
  FeedId: string;
  ParticipantPublicAddress: string;
  EncryptedFeedKey: string;
}

// NewChatFeedPayload - matches server's NewChatFeedPayload record
export interface NewChatFeedPayload {
  FeedId: string;
  FeedType: number;
  FeedParticipants: ChatFeedParticipant[];
}

// =============================================================================
// Utility Functions
// =============================================================================

// Generate a new GUID (v4)
export function generateGuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get current timestamp in ISO 8601 format (matches HushShared.Blockchain.Model.Timestamp)
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// =============================================================================
// Transaction Creation (UnsignedTransaction<T>)
// =============================================================================

/**
 * Creates an UnsignedTransaction<T> - the developer works with this type
 * Similar to HushClient's UnsignedTransactionHandler.CreateNew()
 */
export function createUnsignedTransaction<T>(
  payloadKind: string,
  payload: T
): UnsignedTransaction<T> {
  const payloadJson = JSON.stringify(payload);
  return {
    TransactionId: generateGuid(),
    PayloadKind: payloadKind,
    TransactionTimeStamp: getCurrentTimestamp(),
    Payload: payload,
    PayloadSize: new TextEncoder().encode(payloadJson).length,
  };
}

// =============================================================================
// Transaction Signing
// =============================================================================

/**
 * Signing credentials - passed to signByUser()
 * This interface encapsulates the credentials needed for signing
 */
export interface SigningCredentials {
  privateKey: Uint8Array;
  publicSigningAddress: string;
}

/**
 * Signs an UnsignedTransaction<T> and returns a SignedTransaction<T>
 * Similar to HushClient's .SignByUser() extension method
 *
 * The signature is created by:
 * 1. Serializing the UnsignedTransaction to JSON
 * 2. Signing the JSON bytes with the private key
 * 3. Creating a SignedTransaction with the same data + UserSignature
 */
export async function signByUser<T>(
  unsignedTx: UnsignedTransaction<T>,
  credentials: SigningCredentials
): Promise<SignedTransaction<T>> {
  // Serialize the unsigned transaction to JSON for signing
  // This matches how C# client signs: DigitalSignature.SignMessage(unsignedTransaction.ToJson(), privateKey)
  const unsignedTxJson = JSON.stringify(unsignedTx);

  // Convert to bytes and sign
  const encoder = new TextEncoder();
  const unsignedTxBytes = encoder.encode(unsignedTxJson);
  const signatureBytes = await signData(unsignedTxBytes, credentials.privateKey);

  // Create signed transaction with flat structure (extends unsigned with signature)
  return {
    ...unsignedTx,
    UserSignature: {
      Signatory: credentials.publicSigningAddress,
      Signature: bytesToBase64(signatureBytes),
    },
  };
}

// =============================================================================
// Payload Factory Functions
// =============================================================================

/**
 * Creates an identity payload
 */
export function createIdentityPayload(
  identityAlias: string,
  keys: DerivedKeys,
  isPublic: boolean = false
): FullIdentityPayload {
  return {
    IdentityAlias: identityAlias,
    PublicSigningAddress: keys.signingKey.publicKeyHex,
    PublicEncryptAddress: keys.encryptionKey.publicKeyHex,
    IsPublic: isPublic,
  };
}

/**
 * Creates a personal feed payload with encrypted feed key
 * The feed AES key is encrypted with the owner's public encryption key using ECIES
 */
export async function createPersonalFeedPayload(
  keys: DerivedKeys
): Promise<{ payload: NewPersonalFeedPayload; feedAesKey: string }> {
  // Generate a new AES-256 key for this feed
  const feedAesKey = generateAesKey();

  // Encrypt the feed key with the owner's public encryption key using ECIES
  const encryptedFeedKey = await eciesEncrypt(feedAesKey, keys.encryptionKey.publicKeyHex);

  return {
    payload: {
      FeedId: generateGuid(),
      Title: '', // Personal feeds have empty title
      FeedType: FEED_TYPES.PERSONAL,
      EncryptedFeedKey: encryptedFeedKey,
    },
    feedAesKey, // Return for local storage
  };
}

// =============================================================================
// High-Level Transaction Functions
// =============================================================================

/**
 * Creates and signs an identity transaction
 * Combines payload creation, unsigned transaction, and signing in one call
 */
export async function createIdentityTransaction(
  profileName: string,
  keys: DerivedKeys,
  isPublic: boolean = false
): Promise<string> {
  // Create payload
  const payload = createIdentityPayload(profileName, keys, isPublic);

  // Create unsigned transaction
  const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.FULL_IDENTITY, payload);

  // Sign transaction
  const signedTx = await signByUser(unsignedTx, {
    privateKey: keys.signingKey.privateKey,
    publicSigningAddress: keys.signingKey.publicKeyHex,
  });

  // Return as JSON string for submission
  return JSON.stringify(signedTx);
}

/**
 * Creates and signs an UpdateIdentity transaction
 * Used to change the user's display name (alias)
 *
 * @param newAlias - The new display name
 * @param signingPrivateKey - User's private signing key
 * @param signingPublicAddress - User's public signing address
 * @returns JSON string of signed transaction for submission
 */
export async function createUpdateIdentityTransaction(
  newAlias: string,
  signingPrivateKey: Uint8Array,
  signingPublicAddress: string
): Promise<string> {
  // Create payload
  const payload: UpdateIdentityPayload = { NewAlias: newAlias };

  // Create unsigned transaction
  const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.UPDATE_IDENTITY, payload);

  // Sign transaction
  const signedTx = await signByUser(unsignedTx, {
    privateKey: signingPrivateKey,
    publicSigningAddress: signingPublicAddress,
  });

  // Return as JSON string for submission
  return JSON.stringify(signedTx);
}

/**
 * Creates and signs a personal feed transaction
 * Combines payload creation, unsigned transaction, and signing in one call
 */
export async function createPersonalFeedTransaction(
  keys: DerivedKeys
): Promise<{ signedTransaction: string; feedAesKey: string }> {
  // Create payload with encrypted feed key
  const { payload, feedAesKey } = await createPersonalFeedPayload(keys);

  // Create unsigned transaction
  const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_PERSONAL_FEED, payload);

  // Sign transaction
  const signedTx = await signByUser(unsignedTx, {
    privateKey: keys.signingKey.privateKey,
    publicSigningAddress: keys.signingKey.publicKeyHex,
  });

  // Return signed transaction and feed key (for local storage)
  return {
    signedTransaction: JSON.stringify(signedTx),
    feedAesKey,
  };
}

/**
 * Creates and signs a feed message transaction
 * Returns the signed transaction and the message ID (GUID) for tracking
 */
export async function createFeedMessageTransaction(
  feedId: string,
  messageContent: string,
  feedAesKey: string,
  signingPrivateKey: Uint8Array,
  signingPublicAddress: string
): Promise<{ signedTransaction: string; messageId: string }> {
  // Generate unique message ID
  const messageId = generateGuid();

  // Encrypt message content with feed's AES key
  const encryptedContent = await aesEncrypt(messageContent, feedAesKey);

  // Create payload
  const payload: NewFeedMessagePayload = {
    FeedMessageId: messageId,
    FeedId: feedId,
    MessageContent: encryptedContent,
  };

  // Create unsigned transaction
  const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_FEED_MESSAGE, payload);

  // Sign transaction
  const signedTx = await signByUser(unsignedTx, {
    privateKey: signingPrivateKey,
    publicSigningAddress: signingPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
    messageId,
  };
}

/**
 * Creates and signs a chat feed transaction
 * Creates a new chat feed between two participants
 *
 * @param ownPublicSigningAddress Current user's public signing address
 * @param ownPublicEncryptAddress Current user's public encryption address
 * @param otherPublicSigningAddress Other participant's public signing address
 * @param otherPublicEncryptAddress Other participant's public encryption address
 * @param signingPrivateKey Current user's private signing key
 * @returns Signed transaction, feed ID, and feed AES key
 */
export async function createChatFeedTransaction(
  ownPublicSigningAddress: string,
  ownPublicEncryptAddress: string,
  otherPublicSigningAddress: string,
  otherPublicEncryptAddress: string,
  signingPrivateKey: Uint8Array
): Promise<{ signedTransaction: string; feedId: string; feedAesKey: string }> {
  // Generate feed ID and AES key
  const feedId = generateGuid();
  const feedAesKey = generateAesKey();

  // Encrypt AES key for both participants using ECIES
  const ownEncryptedFeedKey = await eciesEncrypt(feedAesKey, ownPublicEncryptAddress);
  const otherEncryptedFeedKey = await eciesEncrypt(feedAesKey, otherPublicEncryptAddress);

  // Create participants array
  const feedParticipants: ChatFeedParticipant[] = [
    {
      FeedId: feedId,
      ParticipantPublicAddress: ownPublicSigningAddress,
      EncryptedFeedKey: ownEncryptedFeedKey,
    },
    {
      FeedId: feedId,
      ParticipantPublicAddress: otherPublicSigningAddress,
      EncryptedFeedKey: otherEncryptedFeedKey,
    },
  ];

  // Create payload
  const payload: NewChatFeedPayload = {
    FeedId: feedId,
    FeedType: FEED_TYPES.CHAT,
    FeedParticipants: feedParticipants,
  };

  // Create unsigned transaction
  const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_CHAT_FEED, payload);

  // Sign transaction
  const signedTx = await signByUser(unsignedTx, {
    privateKey: signingPrivateKey,
    publicSigningAddress: ownPublicSigningAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
    feedId,
    feedAesKey,
  };
}

// =============================================================================
// Reaction Transaction (Protocol Omega)
// =============================================================================

/**
 * NewReactionPayload - matches server's NewReactionPayload record
 * All byte arrays are serialized as base64 strings in JSON
 */
export interface NewReactionPayload {
  FeedId: string;           // GUID
  MessageId: string;        // GUID
  Nullifier: string;        // base64 encoded bytes
  CiphertextC1X: string[];  // 6 base64 encoded byte arrays
  CiphertextC1Y: string[];  // 6 base64 encoded byte arrays
  CiphertextC2X: string[];  // 6 base64 encoded byte arrays
  CiphertextC2Y: string[];  // 6 base64 encoded byte arrays
  ZkProof: string;          // base64 encoded bytes
  CircuitVersion: string;   // e.g., "omega-v1.0.0" or "dev-mode-v1"
  EncryptedEmojiBackup: string | null; // base64 encoded bytes or null
}

/**
 * Creates and signs a reaction transaction for Protocol Omega
 *
 * @param feedId - The feed UUID
 * @param messageId - The message UUID
 * @param nullifier - The nullifier bytes (already computed)
 * @param ciphertextC1 - Array of 6 {X, Y} base64-encoded points
 * @param ciphertextC2 - Array of 6 {X, Y} base64-encoded points
 * @param zkProof - The ZK proof bytes
 * @param circuitVersion - The circuit version string
 * @param encryptedBackup - Optional encrypted emoji backup bytes
 * @param signingPrivateKey - User's private signing key
 * @param signingPublicAddress - User's public signing address
 */
export async function createReactionTransaction(
  feedId: string,
  messageId: string,
  nullifier: Uint8Array,
  ciphertextC1: { X: string; Y: string }[],
  ciphertextC2: { X: string; Y: string }[],
  zkProof: Uint8Array,
  circuitVersion: string,
  encryptedBackup: Uint8Array | null,
  signingPrivateKey: Uint8Array,
  signingPublicAddress: string
): Promise<{ signedTransaction: string; transactionId: string }> {
  // Create payload with all byte arrays as base64
  const payload: NewReactionPayload = {
    FeedId: feedId,
    MessageId: messageId,
    Nullifier: bytesToBase64(nullifier),
    CiphertextC1X: ciphertextC1.map((p) => p.X),
    CiphertextC1Y: ciphertextC1.map((p) => p.Y),
    CiphertextC2X: ciphertextC2.map((p) => p.X),
    CiphertextC2Y: ciphertextC2.map((p) => p.Y),
    ZkProof: bytesToBase64(zkProof),
    CircuitVersion: circuitVersion,
    EncryptedEmojiBackup: encryptedBackup ? bytesToBase64(encryptedBackup) : null,
  };

  // Create unsigned transaction
  const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_REACTION, payload);

  // Sign transaction
  const signedTx = await signByUser(unsignedTx, {
    privateKey: signingPrivateKey,
    publicSigningAddress: signingPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
    transactionId: signedTx.TransactionId,
  };
}

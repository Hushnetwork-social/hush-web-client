/**
 * Group Feed Crypto Types
 *
 * TypeScript interfaces for group feed cryptographic operations.
 * Handles KeyGeneration storage, key rotation, and unban gap detection.
 */

/**
 * A single key generation for a group feed.
 * Groups can have multiple key generations due to key rotation.
 */
export interface GroupKeyGeneration {
  /** Key generation number (0, 1, 2, ...) - from server */
  keyGeneration: number;

  /** Block height when this key became valid */
  validFromBlock: number;

  /** Block height when this key was replaced (undefined = current) */
  validToBlock?: number;

  /** Decrypted AES-256 key (base64 encoded) */
  aesKey: string;
}

/**
 * KeyGeneration state for a single group feed.
 */
export interface GroupKeyState {
  /** Current key generation number (for sending new messages) */
  currentKeyGeneration: number;

  /** Array of all known key generations (may have gaps from ban periods) */
  keyGenerations: GroupKeyGeneration[];

  /** Key generations we know exist but don't have keys for (unban gap) */
  missingKeyGenerations: number[];
}

/**
 * Result wrapper for group crypto operations.
 */
export interface GroupCryptoResult<T = void> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Data returned from the operation (if successful) */
  data?: T;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Encrypted key data for a group participant.
 * Used when creating/joining groups or during key rotation.
 */
export interface GroupParticipantEncryptedKey {
  /** Public signing address of the participant */
  participantPublicAddress: string;

  /** ECIES-encrypted AES key for this participant (base64) */
  encryptedFeedKey: string;
}

/**
 * Data for a new group feed transaction.
 */
export interface NewGroupFeedData {
  /** Unique identifier for the group feed */
  feedId: string;

  /** Group name */
  name: string;

  /** Optional group description */
  description?: string;

  /** Whether the group is public */
  isPublic: boolean;

  /** Key generation number (0 for new groups) */
  keyGeneration: number;

  /** Encrypted keys for all participants */
  participantKeys: GroupParticipantEncryptedKey[];
}

/**
 * Data for decrypting a group message.
 */
export interface GroupMessageDecryptionContext {
  /** The feed ID of the group */
  feedId: string;

  /** The key generation used to encrypt the message */
  keyGeneration: number;

  /** The encrypted message content (base64) */
  encryptedContent: string;
}

// Type guards for runtime validation

/**
 * Check if an object is a valid GroupKeyGeneration
 */
export function isGroupKeyGeneration(obj: unknown): obj is GroupKeyGeneration {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.keyGeneration === 'number' &&
    candidate.keyGeneration >= 0 &&
    Number.isInteger(candidate.keyGeneration) &&
    typeof candidate.validFromBlock === 'number' &&
    candidate.validFromBlock >= 0 &&
    Number.isInteger(candidate.validFromBlock) &&
    (candidate.validToBlock === undefined ||
      (typeof candidate.validToBlock === 'number' &&
        candidate.validToBlock >= 0 &&
        Number.isInteger(candidate.validToBlock))) &&
    typeof candidate.aesKey === 'string' &&
    candidate.aesKey.length > 0
  );
}

/**
 * Check if an object is a valid GroupKeyState
 */
export function isGroupKeyState(obj: unknown): obj is GroupKeyState {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.currentKeyGeneration === 'number' &&
    candidate.currentKeyGeneration >= 0 &&
    Number.isInteger(candidate.currentKeyGeneration) &&
    Array.isArray(candidate.keyGenerations) &&
    candidate.keyGenerations.every(isGroupKeyGeneration) &&
    Array.isArray(candidate.missingKeyGenerations) &&
    candidate.missingKeyGenerations.every(
      (n) => typeof n === 'number' && n >= 0 && Number.isInteger(n)
    )
  );
}

/**
 * Check if an object is a valid GroupCryptoResult
 */
export function isGroupCryptoResult<T>(
  obj: unknown,
  dataValidator?: (data: unknown) => data is T
): obj is GroupCryptoResult<T> {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  if (typeof candidate.success !== 'boolean') {
    return false;
  }
  if (candidate.error !== undefined && typeof candidate.error !== 'string') {
    return false;
  }
  if (candidate.data !== undefined && dataValidator) {
    return dataValidator(candidate.data);
  }
  return true;
}

/**
 * Check if an object is a valid GroupParticipantEncryptedKey
 */
export function isGroupParticipantEncryptedKey(
  obj: unknown
): obj is GroupParticipantEncryptedKey {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.participantPublicAddress === 'string' &&
    candidate.participantPublicAddress.length > 0 &&
    typeof candidate.encryptedFeedKey === 'string' &&
    candidate.encryptedFeedKey.length > 0
  );
}

/**
 * Check if an object is a valid NewGroupFeedData
 */
export function isNewGroupFeedData(obj: unknown): obj is NewGroupFeedData {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.feedId === 'string' &&
    candidate.feedId.length > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.length >= 1 &&
    candidate.name.length <= 100 &&
    (candidate.description === undefined ||
      (typeof candidate.description === 'string' && candidate.description.length <= 500)) &&
    typeof candidate.isPublic === 'boolean' &&
    typeof candidate.keyGeneration === 'number' &&
    candidate.keyGeneration >= 0 &&
    Number.isInteger(candidate.keyGeneration) &&
    Array.isArray(candidate.participantKeys) &&
    candidate.participantKeys.every(isGroupParticipantEncryptedKey)
  );
}

/**
 * Check if an object is a valid GroupMessageDecryptionContext
 */
export function isGroupMessageDecryptionContext(
  obj: unknown
): obj is GroupMessageDecryptionContext {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.feedId === 'string' &&
    candidate.feedId.length > 0 &&
    typeof candidate.keyGeneration === 'number' &&
    candidate.keyGeneration >= 0 &&
    Number.isInteger(candidate.keyGeneration) &&
    typeof candidate.encryptedContent === 'string' &&
    candidate.encryptedContent.length > 0
  );
}

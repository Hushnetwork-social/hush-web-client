/**
 * Cross-Device Reaction Recovery
 *
 * Allows users to recover their reactions on a new device using
 * their secret and the encrypted backup stored on the server.
 */

import { computeBackupKey, uuidToBigint } from './poseidon';
import { bigintToBytes, bytesToBigint } from './babyjubjub';

const BACKUP_FORMAT_VERSION = 1;
const BACKUP_LENGTH = 32;
const LEGACY_BACKUP_LENGTH = 1;
const MIN_EMOJI_INDEX = -1;
const MAX_EMOJI_INDEX = 6;

function normalizeEmojiIndex(emojiIndex: number): number {
  if (!Number.isInteger(emojiIndex) || emojiIndex < MIN_EMOJI_INDEX || emojiIndex > MAX_EMOJI_INDEX) {
    throw new Error(`Unsupported reaction backup emoji index: ${emojiIndex}`);
  }

  return emojiIndex;
}

function encodeEmojiIndex(emojiIndex: number): number {
  return normalizeEmojiIndex(emojiIndex) + 128;
}

function decodeEmojiIndex(encoded: number): number {
  const decoded = encoded - 128;

  if (decoded < MIN_EMOJI_INDEX || decoded > MAX_EMOJI_INDEX) {
    throw new Error(`Recovered reaction backup is outside the supported FEAT-087 range: ${decoded}`);
  }

  return decoded;
}

/**
 * Encrypt emoji index for backup storage
 *
 * The backup is versioned and authenticated against the derived backup key so
 * corrupted artifacts fail closed instead of silently decoding to another vote.
 *
 * @param emojiIndex - The emoji index (0-5) or -1 for removal
 * @param backupKey - Derived backup key
 */
export function encryptEmojiBackup(
  emojiIndex: number,
  backupKey: bigint
): Uint8Array {
  const keyBytes = bigintToBytes(backupKey);
  const encodedEmoji = encodeEmojiIndex(emojiIndex);
  const encrypted = new Uint8Array(BACKUP_LENGTH);

  encrypted[0] = BACKUP_FORMAT_VERSION;
  encrypted[1] = encodedEmoji ^ keyBytes[0];

  for (let i = 2; i < BACKUP_LENGTH; i++) {
    const mask = keyBytes[(i - 1) % keyBytes.length];
    encrypted[i] = mask ^ encodedEmoji ^ i;
  }

  return encrypted;
}

/**
 * Decrypt emoji index from backup
 *
 * @param encrypted - The encrypted backup bytes
 * @param backupKey - Derived backup key
 * @returns The emoji index (0-5) or -1 for removal
 */
export function decryptEmojiBackup(
  encrypted: Uint8Array,
  backupKey: bigint
): number {
  if (encrypted.length === 0) {
    throw new Error('Encrypted reaction backup is empty');
  }

  const keyBytes = bigintToBytes(backupKey);

  if (encrypted.length === LEGACY_BACKUP_LENGTH) {
    return decodeEmojiIndex(encrypted[0] ^ keyBytes[0]);
  }

  if (encrypted.length !== BACKUP_LENGTH) {
    throw new Error(`Encrypted reaction backup has unexpected length ${encrypted.length}`);
  }

  if (encrypted[0] !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Unsupported reaction backup version: ${encrypted[0]}`);
  }

  const encodedEmoji = encrypted[1] ^ keyBytes[0];

  for (let i = 2; i < BACKUP_LENGTH; i++) {
    const mask = keyBytes[(i - 1) % keyBytes.length];
    const expected = mask ^ encodedEmoji ^ i;
    if (encrypted[i] !== expected) {
      throw new Error('Encrypted reaction backup integrity check failed');
    }
  }

  return decodeEmojiIndex(encodedEmoji);
}

/**
 * Full recovery flow: get user's reaction from server backup
 *
 * @param messageId - The message UUID
 * @param feedId - The feed UUID
 * @param userSecret - User's secret derived from mnemonic
 * @param getBackupFromServer - Function to fetch encrypted backup from server
 * @returns Emoji index (0-5), null if not reacted, or -1 for legacy reaction
 */
export async function recoverReaction(
  messageId: string,
  _feedId: string,
  userSecret: bigint,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _getBackupFromServer: (nullifier: string) => Promise<{ exists: boolean; encryptedBackup: Uint8Array | null }>
): Promise<number | null> {
  // Compute the backup key
  const messageIdBigint = uuidToBigint(messageId);
  await computeBackupKey(userSecret, messageIdBigint);

  // This would typically involve:
  // 1. Computing the nullifier
  // 2. Calling the server to get the backup
  // 3. Decrypting with the backup key
  //
  // For now, we'll return the structure but the actual server call
  // will be done in ReactionsService

  return null;
}

/**
 * Derive user secret from mnemonic
 *
 * Uses HKDF to derive a unique secret for Protocol Omega reactions.
 * This keeps the reaction secret separate from other key derivations.
 *
 * @param mnemonic - The user's BIP39 mnemonic phrase
 * @returns A bigint secret for use in reactions
 */
export async function deriveReactionSecret(mnemonic: string): Promise<bigint> {
  // Convert mnemonic to bytes
  const encoder = new TextEncoder();
  const mnemonicBytes = encoder.encode(mnemonic);

  // Use HKDF with "hush-reactions" as info
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    mnemonicBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: encoder.encode('hush-network'),
      info: encoder.encode('hush-reactions-secret-v1'),
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  return bytesToBigint(new Uint8Array(derivedBits));
}

/**
 * Local reaction cache manager
 *
 * Stores reactions locally for fast access, syncing with server as backup.
 */
export class LocalReactionCache {
  private readonly STORAGE_KEY = 'hush-reactions-local';

  /**
   * Get cached reaction for a message
   */
  get(messageId: string): number | undefined {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return undefined;
      const cache = JSON.parse(data) as Record<string, number>;
      return cache[messageId];
    } catch {
      return undefined;
    }
  }

  /**
   * Set cached reaction for a message
   */
  set(messageId: string, emojiIndex: number): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const cache = data ? (JSON.parse(data) as Record<string, number>) : {};
      cache[messageId] = emojiIndex;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Remove cached reaction for a message
   */
  remove(messageId: string): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return;
      const cache = JSON.parse(data) as Record<string, number>;
      delete cache[messageId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get all cached reactions
   */
  getAll(): Record<string, number> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? (JSON.parse(data) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  /**
   * Clear all cached reactions (e.g., on logout)
   */
  clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export const localReactionCache = new LocalReactionCache();

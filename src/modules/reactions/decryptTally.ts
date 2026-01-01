/**
 * Reaction Tally Decryption
 *
 * Decrypts encrypted reaction tallies from the server using the feed's private key.
 * Uses ElGamal decryption followed by BSGS discrete log solving to get counts.
 *
 * See MemoryBank/ProtocolOmega/ for full documentation.
 */

import {
  decrypt,
  grpcToCiphertext,
  bsgsManager,
  EMOJIS,
  type EmojiType,
  deriveFeedElGamalKey,
} from '@/lib/crypto/reactions';
import type { EmojiCounts } from './useReactionsStore';
import { debugLog } from '@/lib/debug-logger';

/**
 * Server reaction tally format (received from API)
 */
export interface ServerTallyData {
  tallyC1: { x: string; y: string }[];  // Base64 encoded EC points
  tallyC2: { x: string; y: string }[];  // Base64 encoded EC points
}

/**
 * Decrypts a reaction tally to get emoji counts
 *
 * @param tally - The encrypted tally from the server
 * @param feedPrivateKey - The feed's ElGamal private key
 * @returns Decrypted emoji counts
 */
export async function decryptTally(
  tally: ServerTallyData,
  feedPrivateKey: bigint
): Promise<EmojiCounts> {
  debugLog('[decryptTally] Starting tally decryption...');

  // Ensure BSGS table is loaded
  await bsgsManager.ensureLoaded();
  debugLog('[decryptTally] BSGS table loaded');

  const counts: EmojiCounts = {
    '👍': 0,
    '❤️': 0,
    '😂': 0,
    '😮': 0,
    '😢': 0,
    '😡': 0,
  };

  // Decrypt each emoji slot
  for (let i = 0; i < 6; i++) {
    if (!tally.tallyC1[i] || !tally.tallyC2[i]) {
      continue;
    }

    // Convert base64 to ECPoint format expected by grpcToCiphertext
    const c1 = { X: tally.tallyC1[i].x, Y: tally.tallyC1[i].y };
    const c2 = { X: tally.tallyC2[i].x, Y: tally.tallyC2[i].y };

    // Convert to ciphertext format
    const ciphertext = grpcToCiphertext(c1, c2);

    // Decrypt to get m*G
    const mG = decrypt(ciphertext, feedPrivateKey);

    // Solve discrete log to get count
    const count = bsgsManager.solve(mG);

    if (count !== null && count >= 0) {
      counts[EMOJIS[i] as EmojiType] = count;
    }
  }

  debugLog(`[decryptTally] Decrypted counts: 👍=${counts['👍']}, ❤️=${counts['❤️']}, 😂=${counts['😂']}, 😮=${counts['😮']}, 😢=${counts['😢']}, 😡=${counts['😡']}`);

  return counts;
}

/**
 * Synchronously decrypts a tally if BSGS table is already loaded
 * Throws if table not loaded
 *
 * @param tally - The encrypted tally from the server
 * @param feedPrivateKey - The feed's ElGamal private key
 * @returns Decrypted emoji counts
 */
export function decryptTallySync(
  tally: ServerTallyData,
  feedPrivateKey: bigint
): EmojiCounts {
  if (!bsgsManager.isLoaded()) {
    throw new Error('BSGS table not loaded. Call bsgsManager.ensureLoaded() first.');
  }

  const counts: EmojiCounts = {
    '👍': 0,
    '❤️': 0,
    '😂': 0,
    '😮': 0,
    '😢': 0,
    '😡': 0,
  };

  for (let i = 0; i < 6; i++) {
    if (!tally.tallyC1[i] || !tally.tallyC2[i]) {
      continue;
    }

    const c1 = { X: tally.tallyC1[i].x, Y: tally.tallyC1[i].y };
    const c2 = { X: tally.tallyC2[i].x, Y: tally.tallyC2[i].y };

    const ciphertext = grpcToCiphertext(c1, c2);
    const mG = decrypt(ciphertext, feedPrivateKey);
    const count = bsgsManager.solve(mG);

    if (count !== null && count >= 0) {
      counts[EMOJIS[i] as EmojiType] = count;
    }
  }

  return counts;
}

/**
 * Batch decrypt multiple tallies efficiently
 *
 * @param tallies - Map of messageId to encrypted tally
 * @param feedPrivateKey - The feed's ElGamal private key
 * @returns Map of messageId to decrypted counts
 */
export async function decryptTalliesBatch(
  tallies: Map<string, ServerTallyData>,
  feedPrivateKey: bigint
): Promise<Map<string, EmojiCounts>> {
  // Ensure BSGS table is loaded once
  await bsgsManager.ensureLoaded();

  const results = new Map<string, EmojiCounts>();

  for (const [messageId, tally] of tallies) {
    try {
      const counts = decryptTallySync(tally, feedPrivateKey);
      results.set(messageId, counts);
    } catch (err) {
      console.warn(`[decryptTally] Failed to decrypt tally for ${messageId}:`, err);
    }
  }

  return results;
}

/**
 * Decrypts a reaction tally using the feed's AES key
 *
 * Derives the ElGamal private key from the AES key and decrypts the tally.
 *
 * @param tally - The encrypted tally from the server
 * @param feedAesKey - The feed's AES-256 key (base64 encoded)
 * @returns Decrypted emoji counts
 */
export async function decryptTallyWithAesKey(
  tally: ServerTallyData,
  feedAesKey: string
): Promise<EmojiCounts> {
  // Derive ElGamal private key from AES key
  const feedPrivateKey = await deriveFeedElGamalKey(feedAesKey);

  // Decrypt the tally
  return decryptTally(tally, feedPrivateKey);
}

/**
 * Batch decrypt multiple tallies using the feed's AES key
 *
 * @param tallies - Map of messageId to encrypted tally
 * @param feedAesKey - The feed's AES-256 key (base64 encoded)
 * @returns Map of messageId to decrypted counts
 */
export async function decryptTalliesBatchWithAesKey(
  tallies: Map<string, ServerTallyData>,
  feedAesKey: string
): Promise<Map<string, EmojiCounts>> {
  // Derive ElGamal private key from AES key
  const feedPrivateKey = await deriveFeedElGamalKey(feedAesKey);

  // Decrypt all tallies
  return decryptTalliesBatch(tallies, feedPrivateKey);
}

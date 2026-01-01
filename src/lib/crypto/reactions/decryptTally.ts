/**
 * Decrypt Reaction Tally
 *
 * Decrypts the homomorphic ElGamal tally to get actual emoji counts.
 */

import { decrypt, grpcToCiphertext } from './elgamal';
import { deriveFeedElGamalKey } from './poseidon';
import { bsgsManager } from './bsgs';
import { EMOJI_COUNT } from './constants';
import { debugLog } from '@/lib/debug-logger';

/**
 * EC Point type - handles both uppercase (X, Y) and lowercase (x, y) formats
 */
interface FlexibleECPoint {
  X?: string;
  Y?: string;
  x?: string;
  y?: string;
}

/**
 * Normalize EC point to uppercase format
 */
function normalizeECPoint(point: FlexibleECPoint): { X: string; Y: string } {
  return {
    X: point.X ?? point.x ?? '',
    Y: point.Y ?? point.y ?? '',
  };
}

/**
 * Emoji counts interface
 */
export interface DecryptedEmojiCounts {
  '👍': number;
  '❤️': number;
  '😂': number;
  '😮': number;
  '😢': number;
  '😡': number;
}

/**
 * Empty emoji counts
 */
export const EMPTY_DECRYPTED_COUNTS: DecryptedEmojiCounts = {
  '👍': 0,
  '❤️': 0,
  '😂': 0,
  '😮': 0,
  '😢': 0,
  '😡': 0,
};

const EMOJI_KEYS: (keyof DecryptedEmojiCounts)[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];

/**
 * Initialize the BSGS table for decryption
 * Call this early in app startup for faster decryption later
 */
export async function initializeBsgs(): Promise<void> {
  debugLog('[decryptTally] Initializing BSGS table...');
  await bsgsManager.ensureLoaded();
  debugLog('[decryptTally] BSGS table ready');
}

/**
 * Check if BSGS is ready for decryption
 */
export function isBsgsReady(): boolean {
  return bsgsManager.isLoaded();
}

/**
 * Decrypt a reaction tally from the server
 *
 * @param tallyC1 - Array of 6 C1 points (base64 encoded, can be uppercase or lowercase x/y)
 * @param tallyC2 - Array of 6 C2 points (base64 encoded, can be uppercase or lowercase x/y)
 * @param feedAesKey - The feed's AES key (base64 encoded)
 * @returns Decrypted emoji counts
 */
export async function decryptReactionTally(
  tallyC1: FlexibleECPoint[],
  tallyC2: FlexibleECPoint[],
  feedAesKey: string
): Promise<DecryptedEmojiCounts> {
  // Validate input
  if (!tallyC1 || !tallyC2 || tallyC1.length !== EMOJI_COUNT || tallyC2.length !== EMOJI_COUNT) {
    debugWarn(`[decryptTally] Invalid tally data (c1=${tallyC1?.length}, c2=${tallyC2?.length}), returning empty counts`);
    return { ...EMPTY_DECRYPTED_COUNTS };
  }

  // Ensure BSGS is loaded
  if (!bsgsManager.isLoaded()) {
    debugLog('[decryptTally] BSGS not loaded, loading now...');
    await bsgsManager.ensureLoaded();
  }

  // Derive the feed's ElGamal private key
  const privateKey = await deriveFeedElGamalKey(feedAesKey);

  // Decrypt each emoji's count
  const counts: DecryptedEmojiCounts = { ...EMPTY_DECRYPTED_COUNTS };

  for (let i = 0; i < EMOJI_COUNT; i++) {
    try {
      // Normalize EC points to uppercase format
      const c1Point = normalizeECPoint(tallyC1[i]);
      const c2Point = normalizeECPoint(tallyC2[i]);

      // Convert gRPC format to Ciphertext
      const ciphertext: Ciphertext = grpcToCiphertext(c1Point, c2Point);

      // Decrypt to get m*G
      const decryptedPoint = decrypt(ciphertext, privateKey);

      // Solve discrete log to get m (the count)
      const count = bsgsManager.solve(decryptedPoint);

      if (count !== null && count >= 0) {
        counts[EMOJI_KEYS[i]] = count;
      } else {
        debugWarn(`[decryptTally] Could not solve discrete log for emoji ${i}`);
        counts[EMOJI_KEYS[i]] = 0;
      }
    } catch (err) {
      debugError(`[decryptTally] Failed to decrypt emoji ${i}:`, err);
      counts[EMOJI_KEYS[i]] = 0;
    }
  }

  debugLog(`[decryptTally] Decrypted counts: 👍=${counts['👍']} ❤️=${counts['❤️']} 😂=${counts['😂']} 😮=${counts['😮']} 😢=${counts['😢']} 😡=${counts['😡']}`);

  return counts;
}

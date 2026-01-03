/**
 * Group Feed Crypto Functions
 *
 * Implements:
 * - KeyGeneration decryption (ECIES)
 * - KeyGeneration storage integration with useFeedsStore
 * - Group message encryption/decryption (AES-256-GCM)
 *
 * Key Concepts:
 * - KeyGeneration: Each group can have multiple AES keys due to key rotation
 * - Unban Gap: When a user is unbanned, they may be missing some KeyGenerations
 * - Current KeyGeneration: The latest key used for sending new messages
 */

import { eciesDecrypt, aesEncrypt, aesDecrypt } from './encryption';
import type { GroupCryptoResult } from '@/types';

/**
 * Decrypt a KeyGeneration's encrypted AES key using the user's private encryption key.
 *
 * This is called when:
 * 1. User joins/creates a group and receives their encrypted key
 * 2. Key rotation occurs and user receives the new encrypted key
 * 3. User receives KeyGenerations they missed (after sync)
 *
 * @param encryptedKey - ECIES-encrypted AES key (base64)
 * @param privateEncryptKeyHex - User's private encryption key (hex)
 * @returns Decrypted AES key (base64) or error
 */
export async function decryptKeyGeneration(
  encryptedKey: string,
  privateEncryptKeyHex: string
): Promise<GroupCryptoResult<string>> {
  try {
    const aesKey = await eciesDecrypt(encryptedKey, privateEncryptKeyHex);
    return {
      success: true,
      data: aesKey,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decrypt KeyGeneration',
    };
  }
}

/**
 * Get the current KeyGeneration AES key for a group feed.
 * Used when sending new messages.
 *
 * @param feedId - The group feed ID
 * @param getGroupKeyState - Function to get key state from store
 * @returns Current AES key (base64) or undefined if not available
 */
export function getCurrentGroupKey(
  feedId: string,
  getGroupKeyState: (feedId: string) => { currentKeyGeneration: number; keyGenerations: { keyGeneration: number; aesKey: string }[] } | undefined
): string | undefined {
  const keyState = getGroupKeyState(feedId);
  if (!keyState) {
    return undefined;
  }

  const currentKey = keyState.keyGenerations.find(
    (kg) => kg.keyGeneration === keyState.currentKeyGeneration
  );

  return currentKey?.aesKey;
}

/**
 * Get a specific KeyGeneration AES key for a group feed.
 * Used when decrypting messages (each message specifies its KeyGeneration).
 *
 * @param feedId - The group feed ID
 * @param keyGeneration - The key generation number to retrieve
 * @param getGroupKeyState - Function to get key state from store
 * @returns AES key (base64) or undefined if not available (unban gap)
 */
export function getKeyGenerationForMessage(
  feedId: string,
  keyGeneration: number,
  getGroupKeyState: (feedId: string) => { keyGenerations: { keyGeneration: number; aesKey: string }[] } | undefined
): string | undefined {
  const keyState = getGroupKeyState(feedId);
  if (!keyState) {
    return undefined;
  }

  const key = keyState.keyGenerations.find((kg) => kg.keyGeneration === keyGeneration);

  return key?.aesKey;
}

/**
 * Encrypt a message for a group feed.
 * Uses the current KeyGeneration's AES key.
 *
 * @param feedId - The group feed ID
 * @param messageContent - Plaintext message to encrypt
 * @param getCurrentGroupKeyFn - Function to get current AES key
 * @returns Encrypted content and key generation, or error
 */
export async function encryptGroupMessage(
  feedId: string,
  messageContent: string,
  getCurrentGroupKeyFn: (feedId: string) => { aesKey: string; keyGeneration: number } | undefined
): Promise<GroupCryptoResult<{ encryptedContent: string; keyGeneration: number }>> {
  try {
    const keyInfo = getCurrentGroupKeyFn(feedId);
    if (!keyInfo) {
      return {
        success: false,
        error: 'No KeyGeneration available for this group',
      };
    }

    const encryptedContent = await aesEncrypt(messageContent, keyInfo.aesKey);

    return {
      success: true,
      data: {
        encryptedContent,
        keyGeneration: keyInfo.keyGeneration,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to encrypt group message',
    };
  }
}

/**
 * Decrypt a group message.
 * Uses the message's KeyGeneration to find the correct AES key.
 *
 * @param feedId - The group feed ID
 * @param encryptedContent - Encrypted message content (base64)
 * @param keyGeneration - The key generation used for encryption
 * @param getKeyGenerationFn - Function to get AES key by generation
 * @returns Decrypted plaintext or undefined (for unban gap) or error
 */
export async function decryptGroupMessage(
  feedId: string,
  encryptedContent: string,
  keyGeneration: number,
  getKeyGenerationFn: (feedId: string, keyGen: number) => string | undefined
): Promise<GroupCryptoResult<string>> {
  try {
    const aesKey = getKeyGenerationFn(feedId, keyGeneration);

    if (!aesKey) {
      // This is an unban gap - user doesn't have this KeyGeneration
      return {
        success: false,
        error: 'KeyGeneration not available (message unavailable)',
      };
    }

    const plaintext = await aesDecrypt(encryptedContent, aesKey);

    return {
      success: true,
      data: plaintext,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decrypt group message',
    };
  }
}

/**
 * Check if a user is missing any KeyGenerations for a group feed.
 * Used to detect unban gaps.
 *
 * @param feedId - The group feed ID
 * @param getGroupKeyState - Function to get key state from store
 * @returns True if there are missing KeyGenerations
 */
export function hasMissingKeyGenerations(
  feedId: string,
  getGroupKeyState: (feedId: string) => { missingKeyGenerations: number[] } | undefined
): boolean {
  const keyState = getGroupKeyState(feedId);
  if (!keyState) {
    return false;
  }

  return keyState.missingKeyGenerations.length > 0;
}

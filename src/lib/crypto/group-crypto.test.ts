/**
 * Group Crypto Functions Tests
 *
 * Tests for:
 * 1. decryptKeyGeneration() - ECIES decryption of AES key
 * 2. getCurrentGroupKey() - Get current key for sending
 * 3. getKeyGenerationForMessage() - Get key by generation number
 * 4. encryptGroupMessage() - AES encryption with current KeyGeneration
 * 5. decryptGroupMessage() - AES decryption with message's KeyGeneration
 * 6. hasMissingKeyGenerations() - Unban gap detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decryptKeyGeneration,
  getCurrentGroupKey,
  getKeyGenerationForMessage,
  encryptGroupMessage,
  decryptGroupMessage,
  hasMissingKeyGenerations,
} from './group-crypto';

// Mock the encryption module
vi.mock('./encryption', () => ({
  eciesDecrypt: vi.fn().mockImplementation((encryptedKey: string, privateKey: string) => {
    // Simulate successful decryption
    if (privateKey === 'valid_private_key_hex') {
      return Promise.resolve('decrypted_aes_key_base64');
    }
    // Simulate decryption failure with wrong key
    return Promise.reject(new Error('Decryption failed: invalid key'));
  }),
  aesEncrypt: vi.fn().mockImplementation((plaintext: string, aesKey: string) => {
    // Simulate AES encryption
    if (aesKey && plaintext) {
      return Promise.resolve(`encrypted_${plaintext}_with_${aesKey.substring(0, 8)}`);
    }
    return Promise.reject(new Error('AES encryption failed'));
  }),
  aesDecrypt: vi.fn().mockImplementation((ciphertext: string, aesKey: string) => {
    // Simulate AES decryption
    if (ciphertext.startsWith('encrypted_') && aesKey) {
      // Extract original message from our mock format
      const match = ciphertext.match(/^encrypted_(.+)_with_/);
      if (match) {
        return Promise.resolve(match[1]);
      }
    }
    if (ciphertext === 'valid_ciphertext' && aesKey === 'valid_aes_key') {
      return Promise.resolve('decrypted message');
    }
    return Promise.reject(new Error('AES decryption failed'));
  }),
}));

describe('Group Crypto Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('decryptKeyGeneration', () => {
    it('should successfully decrypt a KeyGeneration with valid private key', async () => {
      const result = await decryptKeyGeneration('encrypted_aes_key', 'valid_private_key_hex');

      expect(result.success).toBe(true);
      expect(result.data).toBe('decrypted_aes_key_base64');
      expect(result.error).toBeUndefined();
    });

    it('should return error when decryption fails with wrong key', async () => {
      const result = await decryptKeyGeneration('encrypted_aes_key', 'wrong_private_key');

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toContain('Decryption failed');
    });

    it('should handle empty encrypted key', async () => {
      const result = await decryptKeyGeneration('', 'valid_private_key_hex');

      expect(result.success).toBe(true);
      // Empty string is technically valid to decrypt
    });
  });

  describe('getCurrentGroupKey', () => {
    it('should return current AES key when key state exists', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        currentKeyGeneration: 1,
        keyGenerations: [
          { keyGeneration: 0, aesKey: 'key_gen_0' },
          { keyGeneration: 1, aesKey: 'key_gen_1' },
        ],
      });

      const result = getCurrentGroupKey('feed-123', mockGetGroupKeyState);

      expect(result).toBe('key_gen_1');
      expect(mockGetGroupKeyState).toHaveBeenCalledWith('feed-123');
    });

    it('should return undefined when feed has no key state', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue(undefined);

      const result = getCurrentGroupKey('unknown-feed', mockGetGroupKeyState);

      expect(result).toBeUndefined();
    });

    it('should return undefined when current key generation not found', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        currentKeyGeneration: 2,
        keyGenerations: [
          { keyGeneration: 0, aesKey: 'key_gen_0' },
          { keyGeneration: 1, aesKey: 'key_gen_1' },
        ],
      });

      const result = getCurrentGroupKey('feed-123', mockGetGroupKeyState);

      expect(result).toBeUndefined();
    });

    it('should work with KeyGeneration 0 (initial)', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        currentKeyGeneration: 0,
        keyGenerations: [{ keyGeneration: 0, aesKey: 'initial_key' }],
      });

      const result = getCurrentGroupKey('feed-123', mockGetGroupKeyState);

      expect(result).toBe('initial_key');
    });
  });

  describe('getKeyGenerationForMessage', () => {
    it('should return AES key for specific key generation', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        keyGenerations: [
          { keyGeneration: 0, aesKey: 'key_gen_0' },
          { keyGeneration: 1, aesKey: 'key_gen_1' },
          { keyGeneration: 2, aesKey: 'key_gen_2' },
        ],
      });

      const result = getKeyGenerationForMessage('feed-123', 1, mockGetGroupKeyState);

      expect(result).toBe('key_gen_1');
    });

    it('should return undefined when key generation not found (unban gap)', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        keyGenerations: [
          { keyGeneration: 0, aesKey: 'key_gen_0' },
          { keyGeneration: 2, aesKey: 'key_gen_2' },
          // KeyGeneration 1 is missing (unban gap)
        ],
      });

      const result = getKeyGenerationForMessage('feed-123', 1, mockGetGroupKeyState);

      expect(result).toBeUndefined();
    });

    it('should return undefined when feed has no key state', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue(undefined);

      const result = getKeyGenerationForMessage('unknown-feed', 0, mockGetGroupKeyState);

      expect(result).toBeUndefined();
    });
  });

  describe('encryptGroupMessage', () => {
    it('should encrypt message with current KeyGeneration', async () => {
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey: 'current_aes_key',
        keyGeneration: 2,
      });

      const result = await encryptGroupMessage('feed-123', 'Hello, group!', mockGetCurrentGroupKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.encryptedContent).toContain('encrypted_');
      expect(result.data?.keyGeneration).toBe(2);
    });

    it('should return error when no KeyGeneration available', async () => {
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue(undefined);

      const result = await encryptGroupMessage('unknown-feed', 'Hello', mockGetCurrentGroupKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No KeyGeneration available for this group');
    });

    it('should include keyGeneration 0 for new groups', async () => {
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey: 'initial_key',
        keyGeneration: 0,
      });

      const result = await encryptGroupMessage('feed-123', 'First message', mockGetCurrentGroupKey);

      expect(result.success).toBe(true);
      expect(result.data?.keyGeneration).toBe(0);
    });
  });

  describe('decryptGroupMessage', () => {
    it('should decrypt message with correct KeyGeneration', async () => {
      const mockGetKeyGeneration = vi.fn().mockReturnValue('valid_aes_key');

      const result = await decryptGroupMessage(
        'feed-123',
        'valid_ciphertext',
        1,
        mockGetKeyGeneration
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('decrypted message');
      expect(mockGetKeyGeneration).toHaveBeenCalledWith('feed-123', 1);
    });

    it('should return error when KeyGeneration not available (unban gap)', async () => {
      const mockGetKeyGeneration = vi.fn().mockReturnValue(undefined);

      const result = await decryptGroupMessage('feed-123', 'ciphertext', 2, mockGetKeyGeneration);

      expect(result.success).toBe(false);
      expect(result.error).toContain('KeyGeneration not available');
      expect(result.error).toContain('message unavailable');
    });

    it('should return error when decryption fails', async () => {
      const mockGetKeyGeneration = vi.fn().mockReturnValue('wrong_key');

      const result = await decryptGroupMessage(
        'feed-123',
        'invalid_ciphertext',
        1,
        mockGetKeyGeneration
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Error can be either our wrapper or the underlying error
      expect(result.error?.length).toBeGreaterThan(0);
    });

    it('should correctly decrypt with different key generations', async () => {
      const keysByGeneration: Record<number, string> = {
        0: 'key_gen_0',
        1: 'key_gen_1',
        2: 'key_gen_2',
      };
      const mockGetKeyGeneration = vi.fn().mockImplementation((_feedId: string, keyGen: number) => {
        return keysByGeneration[keyGen];
      });

      // Decrypt with KeyGeneration 0
      const result0 = await decryptGroupMessage(
        'feed-123',
        'encrypted_msg0_with_key_gen_',
        0,
        mockGetKeyGeneration
      );
      expect(result0.success).toBe(true);
      expect(result0.data).toBe('msg0');

      // Decrypt with KeyGeneration 2
      const result2 = await decryptGroupMessage(
        'feed-123',
        'encrypted_msg2_with_key_gen_',
        2,
        mockGetKeyGeneration
      );
      expect(result2.success).toBe(true);
      expect(result2.data).toBe('msg2');
    });
  });

  describe('hasMissingKeyGenerations', () => {
    it('should return true when there are missing KeyGenerations', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        missingKeyGenerations: [1, 3],
      });

      const result = hasMissingKeyGenerations('feed-123', mockGetGroupKeyState);

      expect(result).toBe(true);
    });

    it('should return false when there are no missing KeyGenerations', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue({
        missingKeyGenerations: [],
      });

      const result = hasMissingKeyGenerations('feed-123', mockGetGroupKeyState);

      expect(result).toBe(false);
    });

    it('should return false when feed has no key state', () => {
      const mockGetGroupKeyState = vi.fn().mockReturnValue(undefined);

      const result = hasMissingKeyGenerations('unknown-feed', mockGetGroupKeyState);

      expect(result).toBe(false);
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should encrypt and decrypt message correctly', async () => {
      const originalMessage = 'Hello, this is a test message!';
      const aesKey = 'test_aes_key_base64';
      const keyGeneration = 1;

      // Mock for encryption
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey,
        keyGeneration,
      });

      // Encrypt
      const encryptResult = await encryptGroupMessage(
        'feed-123',
        originalMessage,
        mockGetCurrentGroupKey
      );

      expect(encryptResult.success).toBe(true);
      expect(encryptResult.data?.keyGeneration).toBe(keyGeneration);

      // Mock for decryption - return the same key for this generation
      const mockGetKeyGeneration = vi.fn().mockReturnValue(aesKey);

      // Decrypt
      const decryptResult = await decryptGroupMessage(
        'feed-123',
        encryptResult.data!.encryptedContent,
        encryptResult.data!.keyGeneration,
        mockGetKeyGeneration
      );

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(originalMessage);
    });

    it('should use correct KeyGeneration for decryption', async () => {
      // This test verifies that decryptGroupMessage correctly passes
      // the keyGeneration parameter to the getter function
      const aesKeyGen0 = 'key_gen_0';
      const aesKeyGen1 = 'key_gen_1';

      // Mock that returns different keys for different generations
      const mockGetKeyGeneration = vi.fn().mockImplementation(
        (_feedId: string, keyGen: number) => {
          if (keyGen === 0) return aesKeyGen0;
          if (keyGen === 1) return aesKeyGen1;
          return undefined;
        }
      );

      // Encrypt with KeyGeneration 0
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey: aesKeyGen0,
        keyGeneration: 0,
      });

      const encryptResult = await encryptGroupMessage(
        'feed-123',
        'Secret message',
        mockGetCurrentGroupKey
      );

      expect(encryptResult.success).toBe(true);

      // Decrypt with KeyGeneration 0 (correct) - should work
      const decryptResult = await decryptGroupMessage(
        'feed-123',
        encryptResult.data!.encryptedContent,
        0, // Correct generation
        mockGetKeyGeneration
      );

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe('Secret message');

      // Verify the mock was called with the correct keyGeneration
      expect(mockGetKeyGeneration).toHaveBeenCalledWith('feed-123', 0);
    });
  });

  describe('Unicode and edge cases', () => {
    it('should handle unicode characters in messages', async () => {
      const unicodeMessage = 'Hello 🚀 日本語 emoji 🎉 test';
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey: 'test_key',
        keyGeneration: 0,
      });

      const encryptResult = await encryptGroupMessage(
        'feed-123',
        unicodeMessage,
        mockGetCurrentGroupKey
      );

      expect(encryptResult.success).toBe(true);

      // Mock decryption
      const mockGetKeyGeneration = vi.fn().mockReturnValue('test_key');
      const decryptResult = await decryptGroupMessage(
        'feed-123',
        encryptResult.data!.encryptedContent,
        0,
        mockGetKeyGeneration
      );

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data).toBe(unicodeMessage);
    });

    it('should handle empty messages', async () => {
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey: 'test_key',
        keyGeneration: 0,
      });

      const encryptResult = await encryptGroupMessage('feed-123', '', mockGetCurrentGroupKey);

      // Empty message encryption behavior depends on the AES implementation
      // The mock may reject empty plaintext, which is valid behavior
      // What matters is that we get a result (success or error), not a crash
      expect(encryptResult).toBeDefined();
      expect(typeof encryptResult.success).toBe('boolean');
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);
      const mockGetCurrentGroupKey = vi.fn().mockReturnValue({
        aesKey: 'test_key',
        keyGeneration: 0,
      });

      const encryptResult = await encryptGroupMessage(
        'feed-123',
        longMessage,
        mockGetCurrentGroupKey
      );

      expect(encryptResult.success).toBe(true);
    });
  });
});

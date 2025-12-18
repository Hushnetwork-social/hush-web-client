// ECIES (Elliptic Curve Integrated Encryption Scheme) for HushNetwork
// Uses secp256k1 ECDH + HKDF-SHA256 + AES-256-GCM
// Compatible with Olimpo.EncryptingManager

import * as secp256k1 from '@noble/secp256k1';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const AES_KEY_SIZE = 32;    // 256 bits
const GCM_NONCE_SIZE = 12;  // 96 bits
const GCM_TAG_SIZE = 128;   // 128 bits

// HKDF info string - must match server
const HKDF_INFO = new TextEncoder().encode('hush/ecies/aes256gcm/v1');

/**
 * Generate a random AES-256 key
 * @returns Base64-encoded AES key (32 bytes)
 */
export function generateAesKey(): string {
  const key = new Uint8Array(AES_KEY_SIZE);
  crypto.getRandomValues(key);
  return bytesToBase64(key);
}

/**
 * Encrypt a message using ECIES (ECDH + AES-256-GCM)
 * Compatible with Olimpo.EncryptingManager.Encrypt()
 *
 * @param message Plaintext message to encrypt
 * @param recipientPublicKeyHex Recipient's public key (hex, 65 bytes uncompressed or 33 bytes compressed)
 * @returns Base64-encoded ciphertext: ephemeralPublicKey (65) + nonce (12) + ciphertext + tag
 */
export async function eciesEncrypt(message: string, recipientPublicKeyHex: string): Promise<string> {
  // Parse recipient's public key (convert to uncompressed if needed)
  let recipientPubKeyBytes = hexToBytes(recipientPublicKeyHex);
  if (recipientPubKeyBytes.length === 33) {
    // Compressed - decompress it using Point class
    const point = secp256k1.Point.fromHex(recipientPublicKeyHex);
    recipientPubKeyBytes = point.toBytes(false); // uncompressed (65 bytes)
  }

  // Generate ephemeral key pair
  const ephemeralPrivateKey = secp256k1.utils.randomSecretKey();
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, false); // uncompressed (65 bytes)

  // Perform ECDH to get shared secret
  const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivateKey, recipientPubKeyBytes, false);
  // Remove the prefix byte (0x04) from the shared point to get just the x-coordinate
  const sharedSecretX = sharedSecret.slice(1, 33);

  // Derive AES key using HKDF
  // Salt: ephemeral public key, Info: "hush/ecies/aes256gcm/v1"
  const aesKey = hkdf(sha256, sharedSecretX, ephemeralPublicKey, HKDF_INFO, AES_KEY_SIZE);

  // Generate random nonce
  const nonce = new Uint8Array(GCM_NONCE_SIZE);
  crypto.getRandomValues(nonce);

  // Encrypt with AES-256-GCM
  const plaintextBytes = new TextEncoder().encode(message);
  // Convert to ArrayBuffer for WebCrypto API
  const aesKeyBuffer = new Uint8Array(aesKey).buffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: GCM_TAG_SIZE },
    cryptoKey,
    plaintextBytes
  );

  // Combine: ephemeralPublicKey (65) + nonce (12) + ciphertext (includes tag)
  const result = new Uint8Array(ephemeralPublicKey.length + nonce.length + ciphertext.byteLength);
  result.set(ephemeralPublicKey, 0);
  result.set(nonce, ephemeralPublicKey.length);
  result.set(new Uint8Array(ciphertext), ephemeralPublicKey.length + nonce.length);

  return bytesToBase64(result);
}

/**
 * Decrypt a message using ECIES (ECDH + AES-256-GCM)
 * Compatible with Olimpo.EncryptingManager.Decrypt()
 *
 * @param encryptedBase64 Base64-encoded ciphertext from eciesEncrypt()
 * @param privateKeyHex Recipient's private key (hex, 32 bytes)
 * @returns Decrypted plaintext message
 */
export async function eciesDecrypt(encryptedBase64: string, privateKeyHex: string): Promise<string> {
  const encryptedBytes = base64ToBytes(encryptedBase64);

  // Extract components
  const ephemeralPubKeyLen = 65;
  const ephemeralPubKey = encryptedBytes.slice(0, ephemeralPubKeyLen);
  const nonce = encryptedBytes.slice(ephemeralPubKeyLen, ephemeralPubKeyLen + GCM_NONCE_SIZE);
  const ciphertext = encryptedBytes.slice(ephemeralPubKeyLen + GCM_NONCE_SIZE);

  // Parse private key
  const privateKey = hexToBytes(privateKeyHex);

  // Perform ECDH to get shared secret
  const sharedSecret = secp256k1.getSharedSecret(privateKey, ephemeralPubKey, false);
  const sharedSecretX = sharedSecret.slice(1, 33);

  // Derive AES key using HKDF
  const aesKey = hkdf(sha256, sharedSecretX, ephemeralPubKey, HKDF_INFO, AES_KEY_SIZE);

  // Decrypt with AES-256-GCM
  const aesKeyBuffer = new Uint8Array(aesKey).buffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: GCM_TAG_SIZE },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Compatible with Olimpo.EncryptingManager.AesEncrypt()
 *
 * @param plaintext The text to encrypt
 * @param aesKeyBase64 Base64-encoded AES-256 key
 * @returns Base64-encoded ciphertext (nonce + ciphertext + tag)
 */
export async function aesEncrypt(plaintext: string, aesKeyBase64: string): Promise<string> {
  const key = base64ToBytes(aesKeyBase64);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Generate random nonce
  const nonce = new Uint8Array(GCM_NONCE_SIZE);
  crypto.getRandomValues(nonce);

  // Import key - convert to ArrayBuffer for WebCrypto API
  const keyBuffer = new Uint8Array(key).buffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: GCM_TAG_SIZE },
    cryptoKey,
    plaintextBytes
  );

  // Combine nonce + ciphertext
  const result = new Uint8Array(nonce.length + ciphertext.byteLength);
  result.set(nonce, 0);
  result.set(new Uint8Array(ciphertext), nonce.length);

  return bytesToBase64(result);
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Compatible with Olimpo.EncryptingManager.AesDecrypt()
 *
 * @param encryptedBase64 Base64-encoded ciphertext (nonce + ciphertext + tag)
 * @param aesKeyBase64 Base64-encoded AES-256 key
 * @returns Decrypted plaintext
 */
export async function aesDecrypt(encryptedBase64: string, aesKeyBase64: string): Promise<string> {
  const key = base64ToBytes(aesKeyBase64);
  const encryptedBytes = base64ToBytes(encryptedBase64);

  // Extract nonce and ciphertext
  const nonce = encryptedBytes.slice(0, GCM_NONCE_SIZE);
  const ciphertext = encryptedBytes.slice(GCM_NONCE_SIZE);

  // Import key - convert to ArrayBuffer for WebCrypto API
  const keyBuffer = new Uint8Array(key).buffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: GCM_TAG_SIZE },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

// Helper functions for base64 encoding/decoding
function bytesToBase64(bytes: Uint8Array): string {
  if (typeof window !== 'undefined') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof window !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

// Re-export hex utilities
export { bytesToHex, hexToBytes };

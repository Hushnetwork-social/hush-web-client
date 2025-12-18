// Key generation and derivation utilities for HushNetwork
// Uses BIP-39 mnemonic, HKDF-SHA256, and secp256k1 ECDSA

import * as bip39 from 'bip39';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Generate a 24-word BIP-39 mnemonic (256-bit entropy)
export function generateMnemonic(): string {
  return bip39.generateMnemonic(256);
}

// Validate a BIP-39 mnemonic
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

// Key pair structure
export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHex: string;
}

// Derived keys structure
export interface DerivedKeys {
  signingKey: KeyPair;
  encryptionKey: KeyPair;
}

// Text encoder for converting strings to bytes
const encoder = new TextEncoder();

// Derive keys from mnemonic using HKDF
export function deriveKeysFromMnemonic(mnemonic: string): DerivedKeys {
  // Convert mnemonic to seed (512 bits)
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Use HKDF to derive signing key material
  // Info string matches HushClient: "signing"
  const signingKeyMaterial = hkdf(sha256, seed, undefined, encoder.encode('signing'), 32);

  // Use HKDF to derive encryption key material
  // Info string matches HushClient: "encryption"
  const encryptionKeyMaterial = hkdf(sha256, seed, undefined, encoder.encode('encryption'), 32);

  // Create secp256k1 key pairs
  const signingPrivateKey = new Uint8Array(signingKeyMaterial);
  const signingPublicKey = secp256k1.getPublicKey(signingPrivateKey, true); // compressed

  const encryptionPrivateKey = new Uint8Array(encryptionKeyMaterial);
  const encryptionPublicKey = secp256k1.getPublicKey(encryptionPrivateKey, true); // compressed

  return {
    signingKey: {
      privateKey: signingPrivateKey,
      publicKey: signingPublicKey,
      publicKeyHex: bytesToHex(signingPublicKey),
    },
    encryptionKey: {
      privateKey: encryptionPrivateKey,
      publicKey: encryptionPublicKey,
      publicKeyHex: bytesToHex(encryptionPublicKey),
    },
  };
}

// Sign data with ECDSA (secp256k1)
export async function signData(data: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  // Sign the data - signAsync will hash with SHA-256 internally (prehash: true is default)
  // Returns compact signature (64 bytes: r || s)
  const signature = await secp256k1.signAsync(data, privateKey);
  return signature;
}

// Verify a signature
export function verifySignature(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  // verify will hash with SHA-256 internally (prehash: true is default)
  return secp256k1.verify(signature, data, publicKey);
}

// Convert hex string to bytes
export { hexToBytes, bytesToHex };

// Encode bytes to base64
export function bytesToBase64(bytes: Uint8Array): string {
  // Use browser's btoa or Buffer depending on environment
  if (typeof window !== 'undefined') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

// Decode base64 to bytes
export function base64ToBytes(base64: string): Uint8Array {
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

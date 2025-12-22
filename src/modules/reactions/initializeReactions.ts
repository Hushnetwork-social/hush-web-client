/**
 * Reactions Initialization
 *
 * Initializes the reactions system:
 * 1. Loads Poseidon hash function
 * 2. Derives user secret from mnemonic
 * 3. Computes user commitment
 * 4. Registers commitment for feeds
 */

import { initializePoseidon, computeCommitment } from '@/lib/crypto/reactions/poseidon';
import { BABYJUBJUB } from '@/lib/crypto/reactions/constants';
import { useReactionsStore } from './useReactionsStore';
import { membershipProofManager } from './MembershipProofManager';
import { debugLog, debugError } from '@/lib/debug-logger';

// Track registered feeds to avoid duplicate API calls
const registeredFeeds = new Set<string>();

/**
 * Derive user secret from mnemonic
 *
 * Uses HKDF to derive a Baby JubJub scalar from the mnemonic.
 * This is deterministic - same mnemonic always produces same secret.
 */
async function deriveUserSecretFromMnemonic(mnemonic: string[]): Promise<bigint> {
  const mnemonicString = mnemonic.join(' ');
  const encoder = new TextEncoder();

  // Import mnemonic as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(mnemonicString),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive 256 bits using HKDF
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: encoder.encode('hush-network-reactions'),
      info: encoder.encode('user-secret-v1'),
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  // Convert to bigint and reduce modulo curve order
  const derivedBytes = new Uint8Array(derivedBits);
  let secret = 0n;
  for (const byte of derivedBytes) {
    secret = (secret << 8n) | BigInt(byte);
  }

  // Reduce modulo curve order to get a valid scalar
  const reduced = secret % BABYJUBJUB.order;

  // Ensure non-zero
  return reduced === 0n ? 1n : reduced;
}

/**
 * Initialize the reactions system
 *
 * Should be called once when user logs in with a mnemonic.
 * Sets up Poseidon, derives user secret, and computes commitment.
 */
export async function initializeReactionsSystem(mnemonic: string[]): Promise<boolean> {
  try {
    console.log('[initializeReactions] Starting initialization...');
    debugLog('[initializeReactions] Starting initialization...');

    // 1. Initialize Poseidon hash
    console.log('[initializeReactions] Loading Poseidon (circomlibjs)...');
    debugLog('[initializeReactions] Loading Poseidon...');
    await initializePoseidon();
    console.log('[initializeReactions] Poseidon loaded successfully');
    debugLog('[initializeReactions] Poseidon loaded');

    // 2. Derive user secret from mnemonic
    console.log('[initializeReactions] Deriving user secret from mnemonic...');
    debugLog('[initializeReactions] Deriving user secret...');
    const userSecret = await deriveUserSecretFromMnemonic(mnemonic);
    console.log('[initializeReactions] User secret derived:', userSecret.toString(16).substring(0, 16) + '...');
    debugLog('[initializeReactions] User secret derived');

    // 3. Compute commitment
    console.log('[initializeReactions] Computing Poseidon commitment...');
    debugLog('[initializeReactions] Computing commitment...');
    const userCommitment = await computeCommitment(userSecret);
    console.log(`[initializeReactions] Commitment computed: ${userCommitment.toString(16).substring(0, 16)}...`);
    debugLog(`[initializeReactions] Commitment computed: ${userCommitment.toString(16).substring(0, 16)}...`);

    // 4. Store in reactions store
    const store = useReactionsStore.getState();
    store.setUserSecret(userSecret);
    store.setUserCommitment(userCommitment);

    console.log('[initializeReactions] Reactions system initialized successfully');
    debugLog('[initializeReactions] Reactions system initialized successfully');
    return true;
  } catch (error) {
    console.error('[initializeReactions] Failed to initialize:', error);
    debugError('[initializeReactions] Failed to initialize:', error);
    return false;
  }
}

/**
 * Register commitment for a feed
 *
 * Should be called when user opens a feed.
 * Checks if already registered to avoid duplicate calls.
 */
export async function ensureCommitmentRegistered(feedId: string): Promise<boolean> {
  const store = useReactionsStore.getState();
  const userCommitment = store.getUserCommitment();

  if (!userCommitment) {
    debugLog('[ensureCommitmentRegistered] User commitment not set, skipping');
    return false;
  }

  // Check if already registered this session
  const cacheKey = `${feedId}:${userCommitment.toString(16)}`;
  if (registeredFeeds.has(cacheKey)) {
    debugLog(`[ensureCommitmentRegistered] Already registered for feed ${feedId.substring(0, 8)}...`);
    return true;
  }

  try {
    // Check if already registered on server
    const isMember = await membershipProofManager.isMember(feedId, userCommitment);

    if (isMember) {
      debugLog(`[ensureCommitmentRegistered] Already a member of feed ${feedId.substring(0, 8)}...`);
      registeredFeeds.add(cacheKey);
      return true;
    }

    // Register commitment
    debugLog(`[ensureCommitmentRegistered] Registering for feed ${feedId.substring(0, 8)}...`);
    const success = await membershipProofManager.registerCommitment(feedId, userCommitment);

    if (success) {
      debugLog(`[ensureCommitmentRegistered] Successfully registered for feed ${feedId.substring(0, 8)}...`);
      registeredFeeds.add(cacheKey);
    } else {
      debugError(`[ensureCommitmentRegistered] Failed to register for feed ${feedId.substring(0, 8)}...`);
    }

    return success;
  } catch (error) {
    debugError(`[ensureCommitmentRegistered] Error registering for feed ${feedId.substring(0, 8)}...:`, error);
    return false;
  }
}

/**
 * Clear registration cache (call on logout)
 */
export function clearRegistrationCache(): void {
  registeredFeeds.clear();
}

/**
 * Check if reactions system is initialized
 */
export function isReactionsInitialized(): boolean {
  const store = useReactionsStore.getState();
  return store.getUserSecret() !== null && store.getUserCommitment() !== null;
}

/**
 * Identity Syncable
 *
 * Checks if the user's identity exists in the blockchain and creates it if missing.
 * This is an auth-dependent syncable (requiresAuth: true).
 *
 * Responsibilities:
 * - Check if identity exists in the blockchain
 * - Create identity transaction if missing
 * - Log sync status for debugging
 */

import type { ISyncable } from '@/lib/sync';
import { useAppStore } from '@/stores';
import { createIdentityTransaction, deriveKeysFromMnemonic } from '@/lib/crypto';
import { checkIdentityExists, submitTransaction } from './IdentityService';
import { debugLog, debugWarn, debugError } from '@/lib/debug-logger';

// Track state to avoid repeated operations
let identityConfirmed = false;
let identityCreationPending = false;
let lastCheckedAddress: string | null = null;

export class IdentitySyncable implements ISyncable {
  name = 'IdentitySyncable';
  requiresAuth = true; // Only runs when authenticated

  private isSyncing = false;

  async syncTask(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      return;
    }

    const { credentials, currentUser, isAuthenticated } = useAppStore.getState();

    if (!credentials?.signingPublicKey) {
      debugLog('[IdentitySyncable] Skipping - no credentials');
      return;
    }

    // Reset state if address changed (different user logged in)
    if (lastCheckedAddress !== credentials.signingPublicKey) {
      identityConfirmed = false;
      identityCreationPending = false;
      lastCheckedAddress = credentials.signingPublicKey;
    }

    // If identity is already confirmed, skip
    if (identityConfirmed) {
      return;
    }

    this.isSyncing = true;

    try {
      // Log what we're checking
      debugLog('[IdentitySyncable] Checking identity in blockchain...');
      debugLog(`  - User: ${currentUser?.displayName || 'Unknown'}`);
      debugLog(`  - SigningKey: ${credentials.signingPublicKey.substring(0, 20)}...`);

      // Check if identity exists
      const identityInfo = await checkIdentityExists(credentials.signingPublicKey);

      if (identityInfo.exists) {
        debugLog('[IdentitySyncable] Identity found in blockchain:');
        debugLog(`  - ProfileName: ${identityInfo.profileName}`);
        debugLog(`  - PublicSigningAddress: ${identityInfo.publicSigningAddress?.substring(0, 20)}...`);
        debugLog(`  - PublicEncryptAddress: ${identityInfo.publicEncryptAddress?.substring(0, 20)}...`);
        debugLog(`  - IsPublic: ${identityInfo.isPublic}`);
        identityConfirmed = true;
        identityCreationPending = false;
        return;
      }

      // Identity not found
      debugLog('[IdentitySyncable] Identity NOT found in blockchain');

      // If already creating, wait for it
      if (identityCreationPending) {
        debugLog('[IdentitySyncable] Identity creation already pending, waiting...');
        return;
      }

      // Check if we have mnemonic to create identity
      if (!credentials.mnemonic) {
        debugWarn('[IdentitySyncable] Cannot create identity - no mnemonic in credentials');
        return;
      }

      // Create identity
      await this.createIdentity(credentials, currentUser?.displayName || 'Anonymous');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      debugError(`[IdentitySyncable] Error: ${message}`, error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Creates the identity transaction and submits it
   */
  private async createIdentity(
    credentials: { mnemonic?: string[]; signingPublicKey?: string },
    displayName: string
  ): Promise<void> {
    debugLog('[IdentitySyncable] Creating identity transaction...');
    debugLog(`  - DisplayName: ${displayName}`);

    identityCreationPending = true;

    try {
      // Derive keys from mnemonic
      const mnemonic = credentials.mnemonic!.join(' ');
      const keys = deriveKeysFromMnemonic(mnemonic);

      // Create and sign the identity transaction
      const signedTransaction = await createIdentityTransaction(displayName, keys, false);

      // Submit to blockchain
      debugLog('[IdentitySyncable] Submitting identity transaction...');
      const result = await submitTransaction(signedTransaction);

      if (!result.successful) {
        throw new Error(result.message || 'Failed to create identity');
      }

      debugLog('[IdentitySyncable] Identity transaction submitted successfully');
      debugLog('[IdentitySyncable] Waiting for blockchain confirmation...');
      // identityConfirmed will be set to true on next sync when identity is found
    } catch (error) {
      debugError('[IdentitySyncable] Failed to create identity:', error);
      identityCreationPending = false;
      throw error;
    }
  }
}

/**
 * Reset identity sync state (call on logout)
 */
export function resetIdentitySyncState(): void {
  identityConfirmed = false;
  identityCreationPending = false;
  lastCheckedAddress = null;
}

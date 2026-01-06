/**
 * Group Feed Synchronization Functions
 *
 * Provides sync functions for group feeds:
 * - syncGroupFeeds: Sync all group feeds the user participates in
 * - syncGroupMembers: Sync member list for a specific group
 * - syncKeyGenerations: Fetch and decrypt KeyGenerations for a group
 *
 * These functions are called by FeedsSyncable during the sync cycle.
 */

import { groupService } from '@/lib/grpc/services/group';
import { identityService } from '@/lib/grpc/services/identity';
import { decryptKeyGeneration } from '@/lib/crypto/group-crypto';
import { useFeedsStore } from '@/modules/feeds/useFeedsStore';
import type { GroupFeedMember, GroupKeyGeneration, GroupKeyState } from '@/types';
import type { KeyGenerationProto } from '@/lib/grpc/types';
import { debugLog, debugError, debugWarn } from '@/lib/debug-logger';

/**
 * Result type for sync operations
 */
export interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Sync result with data
 */
export interface SyncResultWithData<T> extends SyncResult {
  data?: T;
}

/**
 * Result for member sync operations - includes new members for notifications
 */
export interface MemberSyncResult extends SyncResult {
  members?: GroupFeedMember[];
  newMembers?: GroupFeedMember[];  // Members that were not in the previous list
}

/**
 * Sync group members for a specific group feed
 *
 * Flow:
 * 1. Get existing members from store (for detecting new members)
 * 2. Fetch member list from server via gRPC
 * 3. Resolve display names for each member via identity service
 * 4. Detect new members (for notifications)
 * 5. Store members in useFeedsStore.groupMembers
 * 6. Determine and store current user's role
 *
 * @param feedId - Group feed ID to sync members for
 * @param userAddress - Current user's public signing address
 * @returns MemberSyncResult with member list and new members
 */
export async function syncGroupMembers(
  feedId: string,
  userAddress: string
): Promise<MemberSyncResult> {
  debugLog('[GroupSync] syncGroupMembers:', { feedId: feedId.substring(0, 8) });

  try {
    // Step 1: Get existing members from store (for detecting new ones)
    const existingMembers = useFeedsStore.getState().getGroupMembers(feedId);
    const existingAddresses = new Set(existingMembers.map(m => m.publicAddress));

    // Step 2: Fetch members from server
    const members = await groupService.getGroupMembers(feedId);

    if (members.length === 0) {
      debugLog('[GroupSync] No members returned for group');
      return { success: true, members: [], newMembers: [] };
    }

    // Step 3: Resolve display names for each member
    const membersWithNames: GroupFeedMember[] = await Promise.all(
      members.map(async (member) => {
        try {
          const identity = await identityService.getIdentity(member.publicAddress);
          return {
            ...member,
            displayName: identity.Successfull ? identity.ProfileName : member.publicAddress.substring(0, 10),
          };
        } catch {
          // If identity lookup fails, use truncated address
          return {
            ...member,
            displayName: member.publicAddress.substring(0, 10),
          };
        }
      })
    );

    // Step 4: Detect new members (for notifications)
    // Only detect new members if we had existing members (not first sync)
    // Also exclude current user from notifications (they don't need to see "You joined")
    const newMembers = existingAddresses.size > 0
      ? membersWithNames.filter(m =>
          !existingAddresses.has(m.publicAddress) &&
          m.publicAddress !== userAddress
        )
      : [];

    if (newMembers.length > 0) {
      debugLog('[GroupSync] Detected new members:', {
        count: newMembers.length,
        names: newMembers.map(m => m.displayName),
      });
    }

    // Step 5: Store members in store
    useFeedsStore.getState().setGroupMembers(feedId, membersWithNames);

    // Step 6: Determine current user's role
    const currentUser = membersWithNames.find((m) => m.publicAddress === userAddress);
    if (currentUser) {
      useFeedsStore.getState().setUserRole(feedId, currentUser.role);
    }

    debugLog('[GroupSync] Synced members:', { count: membersWithNames.length });
    return { success: true, members: membersWithNames, newMembers };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync group members';
    debugError('[GroupSync] syncGroupMembers error:', message);
    return { success: false, error: message };
  }
}

/**
 * Sync KeyGenerations for a group feed
 *
 * Flow:
 * 1. Fetch all KeyGenerations the user has access to from server
 * 2. Decrypt each encrypted key using user's private encryption key
 * 3. Store decrypted keys in useFeedsStore.groupKeyStates
 * 4. Detect gaps (missing KeyGenerations from unban periods)
 *
 * @param feedId - Group feed ID
 * @param userAddress - User's public signing address
 * @param privateEncryptKeyHex - User's private encryption key (hex)
 * @returns SyncResult with KeyGeneration state
 */
export async function syncKeyGenerations(
  feedId: string,
  userAddress: string,
  privateEncryptKeyHex: string
): Promise<SyncResultWithData<GroupKeyState>> {
  debugLog('[GroupSync] syncKeyGenerations:', { feedId: feedId.substring(0, 8) });

  try {
    // Step 1: Fetch KeyGenerations from server
    // The server only returns KeyGenerations the user has access to
    const serverKeyGens = await groupService.getKeyGenerations(feedId, userAddress);

    if (!serverKeyGens || serverKeyGens.length === 0) {
      debugLog('[GroupSync] No KeyGenerations returned');
      return { success: true, data: undefined };
    }

    debugLog('[GroupSync] Received KeyGenerations:', { count: serverKeyGens.length });

    // Step 2: Decrypt each key and build state
    const decryptedKeyGens: GroupKeyGeneration[] = [];
    let maxKeyGeneration = 0;

    for (const serverKeyGen of serverKeyGens) {
      try {
        const decryptResult = await decryptKeyGeneration(
          serverKeyGen.EncryptedKey,
          privateEncryptKeyHex
        );

        if (decryptResult.success && decryptResult.data) {
          decryptedKeyGens.push({
            keyGeneration: serverKeyGen.KeyGeneration,
            aesKey: decryptResult.data,
            validFromBlock: serverKeyGen.ValidFromBlock,
            validToBlock: serverKeyGen.ValidToBlock,
          });

          if (serverKeyGen.KeyGeneration > maxKeyGeneration) {
            maxKeyGeneration = serverKeyGen.KeyGeneration;
          }

          debugLog('[GroupSync] Decrypted KeyGeneration:', {
            keyGen: serverKeyGen.KeyGeneration,
            validFromBlock: serverKeyGen.ValidFromBlock,
          });
        } else {
          debugWarn('[GroupSync] Failed to decrypt KeyGeneration:', {
            keyGen: serverKeyGen.KeyGeneration,
            error: decryptResult.error,
          });
        }
      } catch (error) {
        debugWarn('[GroupSync] Error decrypting KeyGeneration:', {
          keyGen: serverKeyGen.KeyGeneration,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Step 3: Detect gaps (missing KeyGenerations)
    const missingKeyGens = detectMissingKeyGenerations(serverKeyGens, maxKeyGeneration);

    // Step 4: Build and store key state
    const keyState: GroupKeyState = {
      currentKeyGeneration: maxKeyGeneration,
      keyGenerations: decryptedKeyGens,
      missingKeyGenerations: missingKeyGens,
    };

    useFeedsStore.getState().setGroupKeyState(feedId, keyState);

    debugLog('[GroupSync] KeyGenerations synced:', {
      count: decryptedKeyGens.length,
      currentKeyGen: maxKeyGeneration,
      missingCount: missingKeyGens.length,
    });

    return { success: true, data: keyState };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync KeyGenerations';
    debugError('[GroupSync] syncKeyGenerations error:', message);
    return { success: false, error: message };
  }
}

/**
 * Detect missing KeyGenerations (gaps from unban periods)
 *
 * If a user was banned and then unbanned, they will be missing KeyGenerations
 * from the period they were banned. This function detects those gaps.
 *
 * @param serverKeyGens - KeyGenerations received from server
 * @param maxKeyGeneration - Highest KeyGeneration number
 * @returns Array of missing KeyGeneration numbers
 */
function detectMissingKeyGenerations(
  serverKeyGens: KeyGenerationProto[],
  maxKeyGeneration: number
): number[] {
  if (serverKeyGens.length === 0 || maxKeyGeneration === 0) {
    return [];
  }

  const receivedKeyGens = new Set(serverKeyGens.map((k) => k.KeyGeneration));
  const missing: number[] = [];

  // Check for gaps from 0 to maxKeyGeneration
  for (let i = 0; i <= maxKeyGeneration; i++) {
    if (!receivedKeyGens.has(i)) {
      missing.push(i);
    }
  }

  if (missing.length > 0) {
    debugLog('[GroupSync] Detected missing KeyGenerations (unban gap):', missing);
  }

  return missing;
}

/**
 * Sync all group-related data for a specific group feed
 *
 * This is a convenience function that combines:
 * - syncGroupMembers
 * - syncKeyGenerations
 *
 * @param feedId - Group feed ID
 * @param userAddress - User's public signing address
 * @param privateEncryptKeyHex - User's private encryption key (hex)
 * @returns Combined sync result
 */
export async function syncGroupFeedData(
  feedId: string,
  userAddress: string,
  privateEncryptKeyHex: string
): Promise<SyncResult> {
  debugLog('[GroupSync] syncGroupFeedData:', { feedId: feedId.substring(0, 8) });

  // Sync members and keys in parallel for efficiency
  const [membersResult, keysResult] = await Promise.all([
    syncGroupMembers(feedId, userAddress),
    syncKeyGenerations(feedId, userAddress, privateEncryptKeyHex),
  ]);

  if (!membersResult.success) {
    return { success: false, error: membersResult.error };
  }

  if (!keysResult.success) {
    return { success: false, error: keysResult.error };
  }

  return { success: true };
}

/**
 * Check if a feed is a group feed and needs group-specific sync
 *
 * @param feedId - Feed ID to check
 * @returns true if the feed is a group feed
 */
export function isGroupFeed(feedId: string): boolean {
  const feed = useFeedsStore.getState().getFeed(feedId);
  return feed?.type === 'group';
}

/**
 * Get all group feeds that need sync
 *
 * @returns Array of group feed IDs that need sync
 */
export function getGroupFeedsNeedingSync(): string[] {
  const { feeds } = useFeedsStore.getState();
  return feeds
    .filter((f) => f.type === 'group' && f.needsSync)
    .map((f) => f.id);
}

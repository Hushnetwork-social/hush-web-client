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
import { decryptKeyGeneration } from '@/lib/crypto/group-crypto';
import { useFeedsStore } from '@/modules/feeds/useFeedsStore';
import type { GroupFeedMember, GroupKeyGeneration, GroupKeyState } from '@/types';
import type { KeyGenerationProto } from '@/lib/grpc/types';
import { debugLog, debugError, debugWarn } from '@/lib/debug-logger';

/**
 * Cache for KeyGeneration sync timestamps.
 * Used to avoid redundant API calls when keys haven't changed.
 */
const keyGenSyncCache = new Map<string, { lastSyncTime: number; keyCount: number }>();

/**
 * Cache for group members sync timestamps.
 */
const membersSyncCache = new Map<string, { lastSyncTime: number; memberCount: number }>();

/**
 * Cache for group info sync timestamps.
 */
const groupInfoSyncCache = new Map<string, { lastSyncTime: number }>();

// Note: Cooldowns removed - sync happens on every 3s cycle.
// When a member joins, the block is confirmed and the next sync should detect it.

/**
 * Invalidate the KeyGeneration sync cache for a specific feed.
 * Call this when you know keys have changed (e.g., member added/removed).
 */
export function invalidateKeyGenCache(feedId: string): void {
  keyGenSyncCache.delete(feedId);
  debugLog('[GroupSync] Invalidated KeyGen cache for feed:', feedId.substring(0, 8));
}

/**
 * Invalidate all sync caches for a specific feed.
 * Call this when you know something changed for this group.
 */
export function invalidateGroupCaches(feedId: string): void {
  keyGenSyncCache.delete(feedId);
  membersSyncCache.delete(feedId);
  groupInfoSyncCache.delete(feedId);
  debugLog('[GroupSync] Invalidated all caches for feed:', feedId.substring(0, 8));
}

/**
 * Invalidate all sync caches for all feeds.
 * Call this on session start or when doing a full refresh.
 */
export function invalidateAllGroupCaches(): void {
  keyGenSyncCache.clear();
  membersSyncCache.clear();
  groupInfoSyncCache.clear();
  debugLog('[GroupSync] Invalidated all group sync caches');
}

/**
 * @deprecated Use invalidateAllGroupCaches instead
 */
export function invalidateAllKeyGenCache(): void {
  invalidateAllGroupCaches();
}

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
 * Result for group info sync - includes all settings changes
 */
export interface GroupInfoSyncResult extends SyncResult {
  /** True if visibility changed from the previous value */
  visibilityChanged?: boolean;
  /** New visibility value (if changed) */
  isPublic?: boolean;
  /** True if name changed */
  nameChanged?: boolean;
  /** New name (if changed) */
  newName?: string;
  /** Previous name (if changed) */
  previousName?: string;
  /** True if description changed */
  descriptionChanged?: boolean;
  /** New description (if changed) */
  newDescription?: string;
  /** Previous description (if changed) */
  previousDescription?: string;
  /** Previous visibility (if changed) */
  previousIsPublic?: boolean;
}

/**
 * Result for full group sync - includes all change notifications
 */
export interface GroupSyncResult extends SyncResult {
  /** New members detected during sync (for notifications) */
  newMembers?: GroupFeedMember[];
  /** Visibility changed during sync */
  visibilityChanged?: boolean;
  /** New visibility value (if changed) */
  isPublic?: boolean;
  /** Previous visibility (if changed) */
  previousIsPublic?: boolean;
  /** Name changed during sync */
  nameChanged?: boolean;
  /** New name (if changed) */
  newName?: string;
  /** Previous name (if changed) */
  previousName?: string;
  /** Description changed during sync */
  descriptionChanged?: boolean;
  /** New description (if changed) */
  newDescription?: string;
  /** Previous description (if changed) */
  previousDescription?: string;
}

/**
 * Sync group members for a specific group feed
 *
 * Flow:
 * 1. Get existing members from store (for detecting new members)
 * 2. Fetch member list from server via gRPC (includes display names from cache)
 * 3. Detect new members (for notifications)
 * 4. Store members in useFeedsStore.groupMembers
 * 5. Determine and store current user's role
 *
 * Performance: Server returns display names via cache-aside pattern
 * (Redis cache with identity JOIN on cache miss). No N+1 identity lookups needed.
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

    // Step 2: Fetch members from server (includes display names from server-side cache)
    const members = await groupService.getGroupMembers(feedId);

    if (members.length === 0) {
      debugLog('[GroupSync] No members returned for group');
      return { success: true, members: [], newMembers: [] };
    }

    // Step 3: Map members with display names from server response
    // Server now returns display names via cache-aside pattern (no N+1 identity lookups needed)
    const membersWithNames: GroupFeedMember[] = members.map((member) => ({
      ...member,
      // Use server-provided displayName, fallback to truncated address if empty
      displayName: member.displayName || member.publicAddress.substring(0, 10),
    }));

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
 * 2. Check which keys we already have decrypted (skip re-decryption)
 * 3. Decrypt only NEW keys using user's private encryption key
 * 4. Merge new keys with existing ones (preserves cached keys)
 * 5. Detect gaps (missing KeyGenerations from unban periods)
 *
 * Performance optimization: Keys are immutable once created, so we cache
 * decrypted keys and only decrypt new ones. This avoids expensive ECIES
 * decryption on every sync cycle.
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
    const store = useFeedsStore.getState();
    const existingState = store.getGroupKeyState(feedId);

    // Step 1: Fetch KeyGenerations from server
    // The server only returns KeyGenerations the user has access to
    const serverKeyGens = await groupService.getKeyGenerations(feedId, userAddress);

    if (!serverKeyGens || serverKeyGens.length === 0) {
      debugLog('[GroupSync] No KeyGenerations returned');
      return { success: true, data: undefined };
    }

    // Step 2: Check which keys we already have decrypted
    const keysToDecrypt = serverKeyGens.filter(
      (serverKey) => !store.hasDecryptedKey(feedId, serverKey.KeyGeneration)
    );

    const alreadyCachedCount = serverKeyGens.length - keysToDecrypt.length;

    // Step 2b: Check for validity updates on existing keys
    // Keys are immutable (AES key never changes), but validity can change
    // when new members join (existing key gets a ValidToBlock set)
    const existingKeysMap = new Map(
      existingState?.keyGenerations.map((k) => [k.keyGeneration, k]) ?? []
    );

    const keysWithValidityUpdates: GroupKeyGeneration[] = [];
    for (const serverKey of serverKeyGens) {
      const existingKey = existingKeysMap.get(serverKey.KeyGeneration);
      if (existingKey) {
        // Check if validity changed
        if (
          existingKey.validFromBlock !== serverKey.ValidFromBlock ||
          existingKey.validToBlock !== serverKey.ValidToBlock
        ) {
          keysWithValidityUpdates.push({
            keyGeneration: serverKey.KeyGeneration,
            aesKey: existingKey.aesKey, // Preserve existing AES key
            validFromBlock: serverKey.ValidFromBlock,
            validToBlock: serverKey.ValidToBlock,
          });
          debugLog('[GroupSync] Detected validity update for KeyGeneration:', {
            keyGen: serverKey.KeyGeneration,
            oldValidTo: existingKey.validToBlock,
            newValidTo: serverKey.ValidToBlock,
          });
        }
      }
    }

    if (keysToDecrypt.length === 0 && keysWithValidityUpdates.length === 0) {
      debugLog('[GroupSync] All keys already cached, no validity changes:', {
        total: serverKeyGens.length,
        cached: alreadyCachedCount,
      });
      // Still need to update missing keys detection
      const maxKeyGeneration = Math.max(...serverKeyGens.map((k) => k.KeyGeneration));
      const missingKeyGens = detectMissingKeyGenerations(serverKeyGens, maxKeyGeneration);
      if (missingKeyGens.length > 0) {
        store.mergeKeyGenerations(feedId, [], missingKeyGens);
      }
      return { success: true, data: store.getGroupKeyState(feedId) };
    }

    if (keysToDecrypt.length === 0 && keysWithValidityUpdates.length > 0) {
      debugLog('[GroupSync] Only validity updates needed:', {
        total: serverKeyGens.length,
        validityUpdates: keysWithValidityUpdates.length,
      });
      const maxKeyGeneration = Math.max(...serverKeyGens.map((k) => k.KeyGeneration));
      const missingKeyGens = detectMissingKeyGenerations(serverKeyGens, maxKeyGeneration);
      store.mergeKeyGenerations(feedId, keysWithValidityUpdates, missingKeyGens);
      return { success: true, data: store.getGroupKeyState(feedId) };
    }

    debugLog('[GroupSync] KeyGenerations to decrypt:', {
      total: serverKeyGens.length,
      cached: alreadyCachedCount,
      toDecrypt: keysToDecrypt.length,
    });

    // Step 3: Decrypt only NEW keys
    const newlyDecryptedKeyGens: GroupKeyGeneration[] = [];
    let maxKeyGeneration = 0;

    for (const serverKeyGen of keysToDecrypt) {
      try {
        const decryptResult = await decryptKeyGeneration(
          serverKeyGen.EncryptedKey,
          privateEncryptKeyHex
        );

        if (decryptResult.success && decryptResult.data) {
          newlyDecryptedKeyGens.push({
            keyGeneration: serverKeyGen.KeyGeneration,
            aesKey: decryptResult.data,
            validFromBlock: serverKeyGen.ValidFromBlock,
            validToBlock: serverKeyGen.ValidToBlock,
          });

          debugLog('[GroupSync] Decrypted NEW KeyGeneration:', {
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

    // Calculate max from ALL server keys (not just newly decrypted)
    maxKeyGeneration = Math.max(...serverKeyGens.map((k) => k.KeyGeneration));

    // Step 4: Detect gaps (missing KeyGenerations)
    const missingKeyGens = detectMissingKeyGenerations(serverKeyGens, maxKeyGeneration);

    // Step 5: Merge new keys AND validity updates with existing ones
    // Combine newly decrypted keys with keys that have validity updates
    const allKeysToMerge = [...newlyDecryptedKeyGens, ...keysWithValidityUpdates];
    store.mergeKeyGenerations(feedId, allKeysToMerge, missingKeyGens);

    const finalState = store.getGroupKeyState(feedId);

    debugLog('[GroupSync] KeyGenerations synced:', {
      newlyDecrypted: newlyDecryptedKeyGens.length,
      validityUpdates: keysWithValidityUpdates.length,
      totalCached: finalState?.keyGenerations.length ?? 0,
      currentKeyGen: finalState?.currentKeyGeneration ?? 0,
      missingCount: missingKeyGens.length,
    });

    return { success: true, data: finalState };
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
 * Previous settings to compare against (for change detection)
 */
export interface PreviousGroupSettings {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * Sync group feed info (title, description, isPublic)
 *
 * Fetches the current group feed settings from the server and updates
 * the local feed store. This ensures visibility changes are reflected.
 *
 * @param feedId - Group feed ID
 * @param previousSettings - Optional previous settings for change detection.
 *        If not provided, uses current store values (which may have been updated already).
 *        For accurate change detection, caller should capture settings BEFORE any sync operations.
 * @returns GroupInfoSyncResult with all settings changes
 */
export async function syncGroupFeedInfo(
  feedId: string,
  previousSettings?: PreviousGroupSettings
): Promise<GroupInfoSyncResult> {
  debugLog('[GroupSync] syncGroupFeedInfo:', { feedId: feedId.substring(0, 8) });

  try {
    // Get previous values either from parameter or from store
    // Using provided previousSettings is more reliable for change detection
    const currentFeed = useFeedsStore.getState().getFeed(feedId);
    const previousName = previousSettings?.name ?? currentFeed?.name;
    const previousDescription = previousSettings?.description ?? currentFeed?.description;
    const previousIsPublic = previousSettings?.isPublic ?? currentFeed?.isPublic;

    const groupInfo = await groupService.getGroupInfo(feedId);

    if (!groupInfo) {
      debugLog('[GroupSync] getGroupInfo returned null');
      return { success: false, error: 'Failed to get group info' };
    }

    // Detect all changes (only if we had previous values)
    const nameChanged = previousName !== undefined && previousName !== groupInfo.Title;
    const descriptionChanged = previousDescription !== undefined && previousDescription !== groupInfo.Description;
    const visibilityChanged = previousIsPublic !== undefined && previousIsPublic !== groupInfo.IsPublic;

    const hasAnyChange = nameChanged || descriptionChanged || visibilityChanged;

    if (hasAnyChange) {
      debugLog('[GroupSync] Settings changed:', {
        nameChanged: nameChanged ? { from: previousName, to: groupInfo.Title } : false,
        descriptionChanged: descriptionChanged ? { from: previousDescription, to: groupInfo.Description } : false,
        visibilityChanged: visibilityChanged ? { from: previousIsPublic, to: groupInfo.IsPublic } : false,
      });
    }

    // Update the feed in the store with the latest info
    useFeedsStore.getState().updateFeedInfo(feedId, {
      name: groupInfo.Title,
      description: groupInfo.Description,
      isPublic: groupInfo.IsPublic,
      inviteCode: groupInfo.InviteCode,
    });

    debugLog('[GroupSync] Group info synced:', {
      title: groupInfo.Title,
      isPublic: groupInfo.IsPublic,
    });

    return {
      success: true,
      // Visibility change
      visibilityChanged,
      isPublic: visibilityChanged ? groupInfo.IsPublic : undefined,
      previousIsPublic: visibilityChanged ? previousIsPublic : undefined,
      // Name change
      nameChanged,
      newName: nameChanged ? groupInfo.Title : undefined,
      previousName: nameChanged ? previousName : undefined,
      // Description change
      descriptionChanged,
      newDescription: descriptionChanged ? groupInfo.Description : undefined,
      previousDescription: descriptionChanged ? previousDescription : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync group info';
    debugError('[GroupSync] syncGroupFeedInfo error:', message);
    return { success: false, error: message };
  }
}

/**
 * Sync all group-related data for a specific group feed
 *
 * This is a convenience function that combines:
 * - syncGroupFeedInfo (title, description, visibility)
 * - syncGroupMembers
 * - syncKeyGenerations
 *
 * @param feedId - Group feed ID
 * @param userAddress - User's public signing address
 * @param privateEncryptKeyHex - User's private encryption key (hex)
 * @param previousSettings - Optional previous settings for change detection.
 *        If provided, used for accurate change detection.
 * @returns Combined sync result including all changes
 */
export async function syncGroupFeedData(
  feedId: string,
  userAddress: string,
  privateEncryptKeyHex: string,
  previousSettings?: PreviousGroupSettings
): Promise<GroupSyncResult> {
  debugLog('[GroupSync] syncGroupFeedData:', { feedId: feedId.substring(0, 8) });

  // Sync group info, members, and keys in parallel for efficiency
  const [infoResult, membersResult, keysResult] = await Promise.all([
    syncGroupFeedInfo(feedId, previousSettings),
    syncGroupMembers(feedId, userAddress),
    syncKeyGenerations(feedId, userAddress, privateEncryptKeyHex),
  ]);

  if (!infoResult.success) {
    debugWarn('[GroupSync] Group info sync failed:', infoResult.error);
    // Don't fail the whole sync if info sync fails - continue with other data
  }

  if (!membersResult.success) {
    return { success: false, error: membersResult.error };
  }

  if (!keysResult.success) {
    return { success: false, error: keysResult.error };
  }

  return {
    success: true,
    newMembers: membersResult.newMembers,
    // Visibility change
    visibilityChanged: infoResult.visibilityChanged,
    isPublic: infoResult.isPublic,
    previousIsPublic: infoResult.previousIsPublic,
    // Name change
    nameChanged: infoResult.nameChanged,
    newName: infoResult.newName,
    previousName: infoResult.previousName,
    // Description change
    descriptionChanged: infoResult.descriptionChanged,
    newDescription: infoResult.newDescription,
    previousDescription: infoResult.previousDescription,
  };
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

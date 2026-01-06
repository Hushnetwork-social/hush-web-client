/**
 * Feeds Syncable
 *
 * Syncs feeds AND messages every cycle.
 * This is an auth-dependent syncable (requiresAuth: true).
 *
 * Responsibilities:
 * - Fetch new feeds since last sync block
 * - Fetch new messages since last sync block
 * - Detect missing personal feed and trigger creation
 * - Update store with new data
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { ISyncable } from '@/lib/sync';
import { useAppStore } from '@/stores';
import {
  createPersonalFeedTransaction,
  deriveKeysFromMnemonic,
  eciesDecrypt,
  aesDecrypt,
} from '@/lib/crypto';
import { decryptReactionTally, initializeBsgs } from '@/lib/crypto/reactions';
import { fetchFeeds, fetchMessages, submitTransaction, type FetchMessagesResponse } from './FeedsService';
import { checkIdentityExists } from '../identity/IdentityService';
import { useFeedsStore } from './useFeedsStore';
import { useBlockchainStore } from '../blockchain/useBlockchainStore';
import { useReactionsStore } from '../reactions/useReactionsStore';
import { syncGroupMembers, syncKeyGenerations, syncGroupFeedInfo, type PreviousGroupSettings } from '@/lib/sync/group-sync';
import { emitMemberJoin, emitSettingsChange, type SettingsChange } from '@/lib/events';
import type { Feed, FeedMessage, SettingsChangeRecord } from '@/types';
import { debugLog, debugWarn, debugError } from '@/lib/debug-logger';

// Minimum blocks to wait before resetting pending personal feed creation
const MIN_BLOCKS_BEFORE_RESET = 5;

// Session storage key to detect page reload/refresh
// We use a unique page load ID to detect when the page has been refreshed
const SESSION_PAGE_LOAD_ID_KEY = 'hush-feeds-page-load-id';

// Generate a unique ID for this page load
// This changes on every page refresh, even within the same tab
const CURRENT_PAGE_LOAD_ID = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export class FeedsSyncable implements ISyncable {
  name = 'FeedsSyncable';
  requiresAuth = true; // Only runs when authenticated

  private isSyncing = false;

  private isFirstSync = true;

  private hasValidatedThisSession = false;

  // Flag to track if THIS sync cycle should reset reaction tally version
  // Set at the start of syncTask before any operations
  private shouldResetReactionTallyVersion = false;

  // Track if initial full sync is complete - after this, only sync active feed incrementally
  private isInitialSyncComplete = false;

  // Track the blockIndex we had for each feed before server sync (to detect changes)
  private previousFeedBlockIndices = new Map<string, number>();

  // Track previous group settings for each group feed (for change detection)
  // This is captured at the START of each sync cycle, BEFORE any updates
  private previousGroupSettings = new Map<string, PreviousGroupSettings>();

  async syncTask(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      debugLog('[FeedsSyncable] Skipping - already syncing');
      return;
    }

    const credentials = useAppStore.getState().credentials;

    if (!credentials?.signingPublicKey) {
      debugLog('[FeedsSyncable] Skipping - no credentials');
      return;
    }

    // Check for new session BEFORE any sync operations
    // This ensures both syncFeeds and syncMessages can use this flag
    this.shouldResetReactionTallyVersion = !this.hasValidatedThisSession && this.isNewSession();
    if (this.shouldResetReactionTallyVersion) {
      debugLog('[FeedsSyncable] New session detected - will reset reaction tally version');
    }

    // Log on first sync
    if (this.isFirstSync) {
      debugLog('[FeedsSyncable] Starting feeds sync...');
      debugLog(`  - Address: ${credentials.signingPublicKey.substring(0, 20)}...`);
    }

    this.isSyncing = true;
    useFeedsStore.getState().setSyncing(true);

    // CRITICAL: Capture previous group settings BEFORE any sync operations
    // This ensures we can accurately detect changes by comparing pre-sync vs post-sync values
    this.captureGroupSettings();

    try {
      // Sync feeds from blockchain (always - to get new feeds/metadata and detect changes)
      await this.syncFeeds(credentials.signingPublicKey);

      // CRITICAL: Sync KeyGenerations for ALL group feeds on every cycle
      // This ensures existing members get new keys when members are added/removed
      // Without this, senders would encrypt with old keys that new members can't decrypt
      await this.syncAllGroupKeyGenerations(credentials.signingPublicKey);

      // Initial sync: fetch ALL messages for ALL feeds once
      if (!this.isInitialSyncComplete) {
        await this.syncMessages(credentials.signingPublicKey);
        this.isInitialSyncComplete = true;
        debugLog('[FeedsSyncable] Initial sync complete - subsequent syncs will only fetch active feed messages');
      } else {
        // Incremental sync: only fetch messages for the ACTIVE feed if it needs sync
        await this.syncActiveFeedMessages(credentials.signingPublicKey);
      }

      // Check for personal feed and create if missing
      await this.ensurePersonalFeed(credentials);

      // Clear any previous error
      useFeedsStore.getState().setError(null);

      // Update previousFeedBlockIndices AFTER all syncing is done
      // This ensures the next sync cycle can correctly detect changes
      const currentFeeds = useFeedsStore.getState().feeds;
      for (const feed of currentFeeds) {
        this.previousFeedBlockIndices.set(feed.id, feed.blockIndex ?? 0);
      }

      this.isFirstSync = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      debugError(`[FeedsSyncable] Sync failed: ${message}`, error);
      useFeedsStore.getState().setError(message);
      throw error; // Re-throw so SyncProvider can track failures
    } finally {
      this.isSyncing = false;
      useFeedsStore.getState().setSyncing(false);
      // Clear the flag after sync completes
      this.shouldResetReactionTallyVersion = false;
    }
  }

  /**
   * Check if this is a new page load (page reload/refresh/new tab)
   * Compares the current page load ID with the stored one.
   * Every page refresh generates a new CURRENT_PAGE_LOAD_ID, so this
   * returns true on every refresh until markSessionValidated() is called.
   */
  private isNewSession(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const storedPageLoadId = sessionStorage.getItem(SESSION_PAGE_LOAD_ID_KEY);
      // If no stored ID or stored ID doesn't match current page load, it's a new session
      return storedPageLoadId !== CURRENT_PAGE_LOAD_ID;
    } catch {
      // sessionStorage may be unavailable (private browsing, etc.)
      return false;
    }
  }

  /**
   * Mark that we've validated data this page load
   */
  private markSessionValidated(): void {
    if (typeof window === 'undefined') return;

    try {
      // Store the current page load ID to mark this session as validated
      sessionStorage.setItem(SESSION_PAGE_LOAD_ID_KEY, CURRENT_PAGE_LOAD_ID);
    } catch {
      // Ignore errors
    }
    this.hasValidatedThisSession = true;
  }

  /**
   * Capture current group settings for all group feeds.
   * Called at the START of each sync cycle to enable accurate change detection.
   */
  private captureGroupSettings(): void {
    const feeds = useFeedsStore.getState().feeds;
    const groupFeeds = feeds.filter(f => f.type === 'group');

    for (const feed of groupFeeds) {
      this.previousGroupSettings.set(feed.id, {
        name: feed.name,
        description: feed.description,
        isPublic: feed.isPublic,
      });
    }

    if (groupFeeds.length > 0) {
      debugLog(`[FeedsSyncable] Captured settings for ${groupFeeds.length} group feed(s)`);
    }
  }

  /**
   * Get previous settings for a group feed (captured at start of sync)
   */
  private getPreviousGroupSettings(feedId: string): PreviousGroupSettings | undefined {
    return this.previousGroupSettings.get(feedId);
  }

  /**
   * Sync feeds from blockchain
   */
  private async syncFeeds(address: string): Promise<void> {
    const { syncMetadata } = useFeedsStore.getState();
    const currentBlockHeight = useBlockchainStore.getState().blockHeight;
    let blockIndex = syncMetadata.lastFeedBlockIndex;
    let forceFullSync = false;

    // On page reload/refresh (new session), always sync from block 0 to validate
    // cached data against current blockchain state
    if (!this.hasValidatedThisSession && this.isNewSession()) {
      debugLog('[FeedsSyncable] New session detected (page reload/refresh)');
      debugLog('[FeedsSyncable] Forcing full sync from block 0 to validate cached data...');
      forceFullSync = true;
    }

    // Detect blockchain reset: if server block height is lower than our last sync block,
    // the database was reset and we need to clear all local cached data
    if (currentBlockHeight > 0 && blockIndex > 0 && currentBlockHeight < blockIndex) {
      debugLog('[FeedsSyncable] Blockchain reset detected!');
      debugLog(`  - Server block height: ${currentBlockHeight}`);
      debugLog(`  - Client last sync block: ${blockIndex}`);
      debugLog('[FeedsSyncable] Clearing local feeds cache and resyncing from scratch...');
      useFeedsStore.getState().reset();
      blockIndex = 0;
      this.isFirstSync = true;
      forceFullSync = true;
    }

    // If forcing full sync, start from block 0
    if (forceFullSync) {
      blockIndex = 0;
    }

    // Check if any feed is missing its AES key - if so, force a full refresh from block 0
    const currentFeeds = useFeedsStore.getState().feeds;
    const feedsMissingKey = currentFeeds.filter((f) => f.encryptedFeedKey && !f.aesKey);
    const feedsNoEncryptedKey = currentFeeds.filter((f) => !f.encryptedFeedKey && !f.aesKey);

    if (feedsMissingKey.length > 0 || feedsNoEncryptedKey.length > 0) {
      debugLog(`[FeedsSyncable] Feeds missing AES key: ${feedsMissingKey.length}, missing encryptedFeedKey: ${feedsNoEncryptedKey.length}`);
      if (feedsNoEncryptedKey.length > 0) {
        // Force refresh from block 0 to get encryptedFeedKey from server
        debugLog('[FeedsSyncable] Forcing full refresh to get encryptedFeedKey');
        blockIndex = 0;
      }
    }

    // Log on first sync or when feeds are empty
    if (currentFeeds.length === 0 || this.isFirstSync) {
      debugLog(`[FeedsSyncable] Syncing feeds for address: ${address.substring(0, 20)}...`);
      debugLog(`  - Current feed count: ${currentFeeds.length}`);
      debugLog(`  - Last sync block: ${blockIndex}`);
    }

    const { feeds: serverFeeds, maxBlockIndex } = await fetchFeeds(address, blockIndex);

    // When doing a full sync from block 0, validate cached data against server
    // BUT preserve group feeds where the user has left (they can still view old messages)
    if (forceFullSync && currentFeeds.length > 0) {
      const serverFeedIds = new Set(serverFeeds.map(f => f.id));
      const { messages } = useFeedsStore.getState();

      // A feed is "stale" only if:
      // 1. Server doesn't return it AND
      // 2. It's NOT a group feed with messages (user may have left but should still see history)
      const staleFeedIds = currentFeeds.filter(f => {
        if (serverFeedIds.has(f.id)) return false; // Server still returns it, not stale

        // For group feeds, preserve if user has messages in it
        // This handles the case where user left the group but should still see their message history
        if (f.type === 'group') {
          const feedMessages = messages[f.id] ?? [];
          if (feedMessages.length > 0) {
            debugLog(`[FeedsSyncable] Preserving group feed "${f.name}" (user left but has ${feedMessages.length} messages)`);
            return false; // Not stale - preserve it
          }
        }

        return true; // Actually stale
      });

      if (staleFeedIds.length > 0) {
        debugLog(`[FeedsSyncable] Found ${staleFeedIds.length} stale cached feed(s) not on server`);
        staleFeedIds.forEach(f => debugLog(`  - Stale: ${f.name} (${f.type}, id: ${f.id})`));
        // Remove only the stale feeds, not all feeds
        const preservedFeeds = currentFeeds.filter(f => !staleFeedIds.some(s => s.id === f.id));
        useFeedsStore.getState().setFeeds(preservedFeeds);
      } else if (serverFeeds.length === 0 && currentFeeds.length > 0) {
        // Server has no feeds - check if any should be preserved (groups with messages)
        const feedsToPreserve = currentFeeds.filter(f => {
          if (f.type === 'group') {
            const feedMessages = messages[f.id] ?? [];
            if (feedMessages.length > 0) {
              debugLog(`[FeedsSyncable] Preserving group feed "${f.name}" (user left but has ${feedMessages.length} messages)`);
              return true;
            }
          }
          return false;
        });

        if (feedsToPreserve.length > 0) {
          debugLog(`[FeedsSyncable] Preserving ${feedsToPreserve.length} group feed(s) with messages`);
          useFeedsStore.getState().setFeeds(feedsToPreserve);
        } else {
          debugLog('[FeedsSyncable] Server has no feeds but client has cached data - clearing stale cache');
          useFeedsStore.getState().reset();
        }
      }
    }

    if (serverFeeds.length > 0) {
      debugLog(`[FeedsSyncable] Found ${serverFeeds.length} feed(s) from server`);
      serverFeeds.forEach(f => debugLog(`  - Feed: ${f.name} (${f.type}, id: ${f.id}, blockIndex: ${f.blockIndex})`));

      // Detect chat feeds with BlockIndex changes (participant may have updated their name)
      const feedsWithChangedBlockIndex = this.detectBlockIndexChanges(currentFeeds, serverFeeds);

      // Detect feeds that have new messages (blockIndex increased) and mark them as needing sync
      // NOTE: This runs BEFORE we update previousFeedBlockIndices, so the comparison is correct
      this.detectAndMarkFeedsNeedingSync(currentFeeds, serverFeeds);

      useFeedsStore.getState().addFeeds(serverFeeds);
      useFeedsStore.getState().setSyncMetadata({ lastFeedBlockIndex: maxBlockIndex });

      // NOTE: previousFeedBlockIndices is updated AFTER syncActiveFeedMessages runs
      // See the end of syncTask where we update it

      // Decrypt feed keys for new feeds
      await this.decryptFeedKeys(serverFeeds);

      // Sync group-specific data for group feeds
      await this.syncGroupFeedData(serverFeeds, address);

      // Refresh participant names for feeds with BlockIndex changes
      if (feedsWithChangedBlockIndex.length > 0) {
        await this.refreshParticipantNames(feedsWithChangedBlockIndex);
      }
    } else if (useFeedsStore.getState().feeds.length === 0) {
      debugLog('[FeedsSyncable] No feeds found for this user');
    }

    // Mark session as validated after successful full sync
    if (forceFullSync) {
      this.markSessionValidated();

      // On new session, also sync group data for ALL cached group feeds
      // This ensures joinedAtBlock and KeyGenerations are fresh
      const allGroupFeeds = useFeedsStore.getState().feeds.filter(f => f.type === 'group');
      if (allGroupFeeds.length > 0) {
        debugLog(`[FeedsSyncable] New session - syncing group data for ${allGroupFeeds.length} cached group feed(s)`);
        await this.syncGroupFeedData(allGroupFeeds, address);
      }
    }

    // Also check if any existing feeds are missing decrypted keys
    await this.ensureFeedKeysDecrypted();
  }

  /**
   * Decrypt feed AES keys using ECIES with user's private encryption key
   */
  private async decryptFeedKeys(feeds: Feed[]): Promise<void> {
    const credentials = useAppStore.getState().credentials;
    if (!credentials?.encryptionPrivateKey) {
      debugLog('[FeedsSyncable] Cannot decrypt feed keys - no encryption private key');
      return;
    }

    for (const feed of feeds) {
      if (feed.encryptedFeedKey && !feed.aesKey) {
        try {
          // Pass hex string directly - eciesDecrypt expects a hex string
          const decryptedKey = await eciesDecrypt(feed.encryptedFeedKey, credentials.encryptionPrivateKey);
          useFeedsStore.getState().updateFeedAesKey(feed.id, decryptedKey);
          debugLog(`[FeedsSyncable] Decrypted AES key for feed: ${feed.name}`);
        } catch (error) {
          debugError(`[FeedsSyncable] Failed to decrypt feed key for ${feed.name}:`, error);
        }
      }
    }
  }

  /**
   * Ensure all feeds have their AES keys decrypted
   */
  private async ensureFeedKeysDecrypted(): Promise<void> {
    const feeds = useFeedsStore.getState().feeds;
    const feedsNeedingDecryption = feeds.filter((f) => f.encryptedFeedKey && !f.aesKey);

    if (feedsNeedingDecryption.length > 0) {
      debugLog(`[FeedsSyncable] ${feedsNeedingDecryption.length} feed(s) need key decryption`);
      await this.decryptFeedKeys(feedsNeedingDecryption);
    }

    // Log status of all feeds
    const allFeeds = useFeedsStore.getState().feeds;
    allFeeds.forEach((f) => {
      if (!f.aesKey) {
        debugLog(`[FeedsSyncable] Feed "${f.name}" missing aesKey (hasEncryptedKey: ${!!f.encryptedFeedKey})`);
      }
    });
  }

  /**
   * Sync group-specific data (members, KeyGenerations) for group feeds
   *
   * For each group feed in the list, this method:
   * 1. Syncs the member list via group-sync.ts
   * 2. Syncs KeyGenerations and decrypts them with user's private key
   *
   * This ensures group-specific state is kept up-to-date after feed sync.
   */
  private async syncGroupFeedData(feeds: Feed[], userAddress: string): Promise<void> {
    const credentials = useAppStore.getState().credentials;
    if (!credentials?.encryptionPrivateKey) {
      debugLog('[FeedsSyncable] Cannot sync group data - no encryption private key');
      return;
    }

    // Filter to only group feeds
    const groupFeeds = feeds.filter((f) => f.type === 'group');

    if (groupFeeds.length === 0) {
      return;
    }

    debugLog(`[FeedsSyncable] Syncing data for ${groupFeeds.length} group feed(s)`);

    // Sync each group feed in parallel
    const syncPromises = groupFeeds.map(async (feed) => {
      try {
        // Get previous settings captured at start of sync cycle
        const previousSettings = this.getPreviousGroupSettings(feed.id);

        // Sync group info (title, description, visibility) with previous settings for change detection
        const infoResult = await syncGroupFeedInfo(feed.id, previousSettings);
        if (!infoResult.success) {
          debugWarn(`[FeedsSyncable] Failed to sync info for group ${feed.id.substring(0, 8)}...: ${infoResult.error}`);
        } else {
          // Check if ANY settings changed
          const hasAnyChange = infoResult.visibilityChanged || infoResult.nameChanged || infoResult.descriptionChanged;

          if (hasAnyChange) {
            // Build the changes object for the event
            const changes: SettingsChange = {};

            if (infoResult.nameChanged) {
              changes.previousName = infoResult.previousName;
              changes.newName = infoResult.newName;
            }
            if (infoResult.descriptionChanged) {
              changes.previousDescription = infoResult.previousDescription;
              changes.newDescription = infoResult.newDescription;
            }
            if (infoResult.visibilityChanged) {
              changes.previousIsPublic = infoResult.previousIsPublic;
              changes.newIsPublic = infoResult.isPublic;
            }

            // Get the updated feed name for the event (use new name if changed)
            const currentFeedName = infoResult.newName ?? feed.name;

            // Get the feed's current blockIndex (this is when the change was recorded)
            const currentFeed = useFeedsStore.getState().getFeed(feed.id);
            const blockIndex = currentFeed?.blockIndex ?? 0;
            const timestamp = Date.now();

            // Create and persist the settings change record
            const record: SettingsChangeRecord = {
              id: `settings-${feed.id}-${blockIndex}-${timestamp}`,
              blockIndex,
              timestamp,
              ...(infoResult.nameChanged && {
                nameChange: { previous: infoResult.previousName!, new: infoResult.newName! },
              }),
              ...(infoResult.descriptionChanged && {
                descriptionChange: { previous: infoResult.previousDescription!, new: infoResult.newDescription! },
              }),
              ...(infoResult.visibilityChanged && {
                visibilityChange: { previous: infoResult.previousIsPublic!, new: infoResult.isPublic! },
              }),
            };

            // Persist the settings change record to feed history
            useFeedsStore.getState().addSettingsChangeRecord(feed.id, record);
            debugLog(`[FeedsSyncable] Persisted settings change record for group ${feed.id.substring(0, 8)}...`, record);

            // Also emit event for real-time UI updates (for users currently viewing the feed)
            emitSettingsChange({
              feedId: feed.id,
              feedName: currentFeedName,
              changes,
              timestamp,
            });

            debugLog(`[FeedsSyncable] Emitted settings change for group ${feed.id.substring(0, 8)}...`, changes);
          }
        }

        // Sync members
        const membersResult = await syncGroupMembers(feed.id, userAddress);
        if (!membersResult.success) {
          debugWarn(`[FeedsSyncable] Failed to sync members for group ${feed.id.substring(0, 8)}...: ${membersResult.error}`);
        } else if (membersResult.newMembers && membersResult.newMembers.length > 0) {
          // Emit member join events for notifications
          for (const member of membersResult.newMembers) {
            emitMemberJoin({
              feedId: feed.id,
              feedName: feed.name,
              member,
              timestamp: Date.now(),
            });
          }
        }

        // Sync KeyGenerations
        const keysResult = await syncKeyGenerations(
          feed.id,
          userAddress,
          credentials.encryptionPrivateKey
        );
        if (!keysResult.success) {
          debugWarn(`[FeedsSyncable] Failed to sync KeyGenerations for group ${feed.id.substring(0, 8)}...: ${keysResult.error}`);
        } else if (keysResult.data) {
          debugLog(`[FeedsSyncable] Synced KeyGenerations for group ${feed.id.substring(0, 8)}...: keyGen=${keysResult.data.currentKeyGeneration}, count=${keysResult.data.keyGenerations.length}`);
        }
      } catch (error) {
        debugError(`[FeedsSyncable] Error syncing group ${feed.id.substring(0, 8)}...:`, error);
      }
    });

    await Promise.all(syncPromises);
  }

  /**
   * Sync KeyGenerations for ALL group feeds on every sync cycle.
   *
   * This is CRITICAL for group messaging to work correctly:
   * - When a new member joins, a new KeyGeneration is created
   * - Existing members MUST sync this new key BEFORE sending messages
   * - Otherwise, they'll encrypt with an old key that new members can't decrypt
   *
   * This method only syncs KeyGenerations (lightweight), not full group data.
   */
  private async syncAllGroupKeyGenerations(userAddress: string): Promise<void> {
    const credentials = useAppStore.getState().credentials;
    if (!credentials?.encryptionPrivateKey) {
      return;
    }

    const allGroupFeeds = useFeedsStore.getState().feeds.filter(f => f.type === 'group');

    if (allGroupFeeds.length === 0) {
      return;
    }

    // Sync KeyGenerations for all group feeds in parallel
    const syncPromises = allGroupFeeds.map(async (feed) => {
      try {
        const keysResult = await syncKeyGenerations(
          feed.id,
          userAddress,
          credentials.encryptionPrivateKey
        );

        if (!keysResult.success) {
          debugWarn(`[FeedsSyncable] Failed to sync KeyGenerations for group ${feed.id.substring(0, 8)}...: ${keysResult.error}`);
        } else if (keysResult.data) {
          // Only log if there's a change (new key generation)
          const currentState = useFeedsStore.getState().getGroupKeyState(feed.id);
          if (!currentState || currentState.currentKeyGeneration !== keysResult.data.currentKeyGeneration) {
            debugLog(`[FeedsSyncable] KeyGen updated for group ${feed.id.substring(0, 8)}...: keyGen=${keysResult.data.currentKeyGeneration}`);
          }
        }
      } catch (error) {
        debugError(`[FeedsSyncable] Error syncing KeyGenerations for group ${feed.id.substring(0, 8)}...:`, error);
      }
    });

    await Promise.all(syncPromises);
  }

  /**
   * Sync messages from blockchain
   */
  private async syncMessages(address: string): Promise<void> {
    const { syncMetadata, feeds } = useFeedsStore.getState();
    let blockIndex = syncMetadata.lastMessageBlockIndex;

    // On new session, reset to fetch all messages from block 0
    // This ensures cached messages are updated with any new fields (e.g., replyToMessageId)
    // Use the flag set at start of syncTask (before hasValidatedThisSession was updated)
    if (this.shouldResetReactionTallyVersion) {
      debugLog(`[FeedsSyncable] Resetting lastMessageBlockIndex from ${blockIndex} to 0 for full message sync`);
      blockIndex = 0;
    }

    // On new session, reset reaction tally version to get all tallies fresh
    // This ensures we sync all reactions after page reload
    let lastReactionTallyVersion = syncMetadata.lastReactionTallyVersion;
    if (this.shouldResetReactionTallyVersion) {
      lastReactionTallyVersion = 0;
      debugLog(`[FeedsSyncable] Resetting lastReactionTallyVersion from ${syncMetadata.lastReactionTallyVersion} to 0 for full tally sync`);
    }

    const response = await fetchMessages(address, blockIndex, lastReactionTallyVersion);
    const { messages: newMessages, maxBlockIndex, reactionTallies, maxReactionTallyVersion } = response;

    if (newMessages.length > 0) {
      debugLog(`[FeedsSyncable] Found ${newMessages.length} new message(s)`);

      // Group messages by feed ID
      const messagesByFeed = new Map<string, FeedMessage[]>();
      for (const msg of newMessages) {
        const feedMessages = messagesByFeed.get(msg.feedId) || [];
        feedMessages.push(msg);
        messagesByFeed.set(msg.feedId, feedMessages);
      }

      // Decrypt and add messages to each feed
      for (const [feedId, messages] of messagesByFeed) {
        const feed = feeds.find((f) => f.id === feedId);

        // For group feeds, use multi-key decryption with fallback to trying all keys
        if (feed?.type === 'group') {
          const decryptedMessages = await this.decryptGroupMessages(feedId, messages);
          useFeedsStore.getState().addMessages(feedId, decryptedMessages);
        } else {
          // Non-group feeds: Use the single AES key
          const feedAesKey = feed?.aesKey;
          if (feedAesKey) {
            const decryptedMessages = await Promise.all(
              messages.map(async (msg) => {
                try {
                  const decryptedContent = await aesDecrypt(msg.content, feedAesKey);
                  return {
                    ...msg,
                    content: decryptedContent,
                    contentEncrypted: msg.content,
                  };
                } catch (error) {
                  debugError(`[FeedsSyncable] Failed to decrypt message ${msg.id}:`, error);
                  return msg;
                }
              })
            );
            useFeedsStore.getState().addMessages(feedId, decryptedMessages);
          } else {
            debugWarn(`[FeedsSyncable] No AES key for feed ${feedId}, storing encrypted messages`);
            useFeedsStore.getState().addMessages(feedId, messages);
          }
        }
      }
    }

    // Protocol Omega: Process reaction tallies
    if (reactionTallies.length > 0) {
      debugLog(`[FeedsSyncable] Found ${reactionTallies.length} updated reaction tally(s), maxVersion=${maxReactionTallyVersion}`);
      await this.processReactionTallies(reactionTallies, feeds);
    }

    // Update sync metadata with both block index and reaction tally version
    if (maxReactionTallyVersion > lastReactionTallyVersion) {
      debugLog(`[FeedsSyncable] Updating lastReactionTallyVersion: ${lastReactionTallyVersion} -> ${maxReactionTallyVersion}`);
    }
    useFeedsStore.getState().setSyncMetadata({
      lastMessageBlockIndex: maxBlockIndex,
      lastReactionTallyVersion: maxReactionTallyVersion,
    });
  }

  /**
   * Process reaction tallies from server (Protocol Omega)
   * Decrypts the homomorphic tallies to get actual emoji counts
   */
  private async processReactionTallies(
    tallies: FetchMessagesResponse['reactionTallies'],
    feeds: Feed[]
  ): Promise<void> {
    const reactionsStore = useReactionsStore.getState();
    const { messages } = useFeedsStore.getState();

    debugLog(`[FeedsSyncable] Processing ${tallies.length} reaction tallies...`);

    // Ensure BSGS table is ready for decryption
    await initializeBsgs();

    let processedCount = 0;
    let skippedCount = 0;
    let decryptedCount = 0;

    for (const tally of tallies) {
      // Find which feed this message belongs to
      const feedId = this.findFeedIdForMessage(tally.messageId, messages);

      if (!feedId) {
        debugWarn(`[FeedsSyncable] Cannot process tally: feed not found for message ${tally.messageId}`);
        skippedCount++;
        continue;
      }

      // Find the feed to get its AES key for decryption
      const feed = feeds.find(f => f.id === feedId);
      const feedAesKey = feed?.aesKey;

      debugLog(`[FeedsSyncable] Processing tally for message ${tally.messageId.substring(0, 8)}..., version=${tally.tallyVersion}, reactionCount=${tally.reactionCount}, feedId=${feedId.substring(0, 8)}..., hasKey=${!!feedAesKey}`);

      // Check if this tally version is newer than what we have
      const existingReaction = reactionsStore.reactions[tally.messageId];
      const existingVersion = existingReaction?.tallyVersion ?? 0;

      if (tally.tallyVersion <= existingVersion) {
        debugLog(`[FeedsSyncable] Skipping tally for ${tally.messageId.substring(0, 8)}... (version ${tally.tallyVersion} <= existing ${existingVersion})`);
        continue;
      }

      // Try to decrypt the tally if we have the feed's AES key
      if (feedAesKey && tally.tallyC1.length > 0 && tally.tallyC2.length > 0) {
        try {
          const decryptedCounts = await decryptReactionTally(
            tally.tallyC1,
            tally.tallyC2,
            feedAesKey
          );

          // Update the store with decrypted counts and server's tally version
          reactionsStore.updateTally(tally.messageId, decryptedCounts, tally.tallyVersion);
          decryptedCount++;
          processedCount++;
          continue;
        } catch (err) {
          debugWarn(`[FeedsSyncable] Failed to decrypt tally for ${tally.messageId.substring(0, 8)}...:`, err);
          // Fall through to store encrypted tally
        }
      }

      // Fallback: Store the encrypted tally for later decryption (when key becomes available)
      reactionsStore.setTallyFromServer(tally.messageId, {
        tallyC1: tally.tallyC1,
        tallyC2: tally.tallyC2,
        tallyVersion: tally.tallyVersion,
        reactionCount: tally.reactionCount,
        feedId,
      });
      processedCount++;
    }

    debugLog(`[FeedsSyncable] Reaction tallies processed: ${processedCount} successful (${decryptedCount} decrypted), ${skippedCount} skipped`);
  }

  /**
   * Find the feed ID that contains a specific message
   */
  private findFeedIdForMessage(
    messageId: string,
    messages: Record<string, FeedMessage[]>
  ): string | undefined {
    for (const [feedId, feedMessages] of Object.entries(messages)) {
      if (feedMessages.some((m) => m.id === messageId)) {
        return feedId;
      }
    }
    return undefined;
  }

  /**
   * Ensure personal feed exists, create if missing
   */
  private async ensurePersonalFeed(credentials: {
    mnemonic?: string[];
    signingPublicKey?: string;
  }): Promise<void> {
    const store = useFeedsStore.getState();
    const currentBlockHeight = useBlockchainStore.getState().blockHeight;

    // Log status on first sync
    if (this.isFirstSync) {
      debugLog('[FeedsSyncable] Checking personal feed status...');
      debugLog(`  - hasPersonalFeed: ${store.hasPersonalFeed()}`);
      debugLog(`  - isCreatingPersonalFeed: ${store.isCreatingPersonalFeed}`);
      debugLog(`  - isPersonalFeedCreationPending: ${store.syncMetadata.isPersonalFeedCreationPending}`);
      debugLog(`  - personalFeedCreationBlockIndex: ${store.syncMetadata.personalFeedCreationBlockIndex}`);
      debugLog(`  - currentBlockHeight: ${currentBlockHeight}`);
      debugLog(`  - hasMnemonic: ${!!credentials.mnemonic}`);
    }

    // Check if personal feed already exists
    if (store.hasPersonalFeed()) {
      // If we were waiting for it to be created, clear the pending flag
      if (store.syncMetadata.isPersonalFeedCreationPending) {
        debugLog('[FeedsSyncable] Personal feed confirmed on blockchain');
        store.setSyncMetadata({
          isPersonalFeedCreationPending: false,
          personalFeedCreationBlockIndex: 0
        });
      }
      return;
    }

    // Don't create if already creating
    if (store.isCreatingPersonalFeed) {
      debugLog('[FeedsSyncable] Skipping - already creating personal feed');
      return;
    }

    // If pending, check if enough blocks have passed before resetting
    if (store.syncMetadata.isPersonalFeedCreationPending) {
      const blocksSinceCreation = currentBlockHeight - store.syncMetadata.personalFeedCreationBlockIndex;

      if (blocksSinceCreation < MIN_BLOCKS_BEFORE_RESET) {
        // Still waiting for blockchain confirmation
        debugLog(`[FeedsSyncable] Personal feed creation pending, waiting for confirmation (${blocksSinceCreation}/${MIN_BLOCKS_BEFORE_RESET} blocks)`);
        return;
      }

      // Enough blocks have passed, reset and try again
      debugLog(`[FeedsSyncable] Personal feed creation timed out after ${blocksSinceCreation} blocks - resetting`);
      store.setSyncMetadata({
        isPersonalFeedCreationPending: false,
        personalFeedCreationBlockIndex: 0
      });
    }

    // Don't create if no mnemonic
    if (!credentials.mnemonic) {
      debugLog('[FeedsSyncable] Cannot create personal feed - no mnemonic in credentials');
      return;
    }

    debugLog('[FeedsSyncable] No personal feed detected, creating one...');
    store.setCreatingPersonalFeed(true);

    // Store current block height to track timeout
    store.setSyncMetadata({
      isPersonalFeedCreationPending: true,
      personalFeedCreationBlockIndex: currentBlockHeight
    });

    try {
      // Derive keys from mnemonic
      const mnemonic = credentials.mnemonic.join(' ');
      const keys = deriveKeysFromMnemonic(mnemonic);

      // Create and sign the personal feed transaction
      const { signedTransaction } = await createPersonalFeedTransaction(keys);

      // Submit to blockchain
      debugLog('[FeedsSyncable] Submitting personal feed transaction...');
      const result = await submitTransaction(signedTransaction);

      if (!result.successful) {
        throw new Error(result.message || 'Failed to create personal feed');
      }

      debugLog('[FeedsSyncable] Personal feed creation transaction submitted successfully');
      // Keep isPersonalFeedCreationPending true - it will be cleared when feed appears in sync
    } catch (error) {
      debugError('[FeedsSyncable] Failed to create personal feed:', error);
      store.setSyncMetadata({
        isPersonalFeedCreationPending: false,
        personalFeedCreationBlockIndex: 0
      });
      throw error;
    } finally {
      store.setCreatingPersonalFeed(false);
    }
  }

  /**
   * Detect chat feeds where BlockIndex has increased (participant may have updated their identity)
   * Returns array of feed objects that need participant name refresh
   */
  private detectBlockIndexChanges(
    currentFeeds: Feed[],
    serverFeeds: Feed[]
  ): Feed[] {
    const changedFeeds: Feed[] = [];

    // Create a map of current feeds by ID for quick lookup
    const currentFeedsMap = new Map(currentFeeds.map(f => [f.id, f]));

    for (const serverFeed of serverFeeds) {
      // Only check chat feeds (not personal/group/broadcast)
      if (serverFeed.type !== 'chat') continue;

      const currentFeed = currentFeedsMap.get(serverFeed.id);

      // Skip new feeds (no previous blockIndex to compare)
      if (!currentFeed) continue;

      // Check if blockIndex has increased
      const currentBlockIndex = currentFeed.blockIndex ?? 0;
      const serverBlockIndex = serverFeed.blockIndex ?? 0;

      if (serverBlockIndex > currentBlockIndex) {
        debugLog(`[FeedsSyncable] Feed ${serverFeed.id.substring(0, 8)}... BlockIndex changed: ${currentBlockIndex} -> ${serverBlockIndex}`);
        // Use serverFeed as it has the updated data including otherParticipantPublicSigningAddress
        changedFeeds.push(serverFeed);
      }
    }

    return changedFeeds;
  }

  /**
   * Refresh participant display names for feeds with BlockIndex changes
   * Fetches current profile name from blockchain and updates the feed store
   */
  private async refreshParticipantNames(feeds: Feed[]): Promise<void> {
    debugLog(`[FeedsSyncable] Refreshing participant names for ${feeds.length} feed(s)`);

    for (const feed of feeds) {
      const participantAddress = feed.otherParticipantPublicSigningAddress;

      if (!participantAddress) {
        debugLog(`[FeedsSyncable] Feed ${feed.id.substring(0, 8)}... has no otherParticipantPublicSigningAddress, skipping`);
        continue;
      }

      try {
        // Fetch the participant's current identity from blockchain
        const identityInfo = await checkIdentityExists(participantAddress);

        if (identityInfo.exists && identityInfo.profileName) {
          const currentName = feed.name;
          const newName = identityInfo.profileName;

          if (currentName !== newName) {
            debugLog(`[FeedsSyncable] Updating feed name: "${currentName}" -> "${newName}"`);
            useFeedsStore.getState().updateFeedName(feed.id, newName);
          } else {
            debugLog(`[FeedsSyncable] Feed name unchanged: "${currentName}"`);
          }
        } else {
          debugLog(`[FeedsSyncable] No profile name found for participant ${participantAddress.substring(0, 12)}...`);
        }
      } catch (error) {
        debugError(`[FeedsSyncable] Failed to refresh name for feed ${feed.id.substring(0, 8)}...:`, error);
        // Continue with other feeds - don't fail the entire refresh
      }
    }
  }

  /**
   * Detect feeds where blockIndex has increased and mark them as needing sync
   * This enables incremental sync - we only fetch messages for feeds that changed
   */
  private detectAndMarkFeedsNeedingSync(
    currentFeeds: Feed[],
    serverFeeds: Feed[]
  ): void {
    const selectedFeedId = useAppStore.getState().selectedFeedId;

    // Create a map of current feeds by ID for quick lookup
    const currentFeedsMap = new Map(currentFeeds.map(f => [f.id, f]));

    for (const serverFeed of serverFeeds) {
      const currentFeed = currentFeedsMap.get(serverFeed.id);

      // For new feeds, mark as needing sync (unless it's the active feed, which will sync immediately)
      if (!currentFeed) {
        if (serverFeed.id !== selectedFeedId) {
          debugLog(`[FeedsSyncable] New feed ${serverFeed.id.substring(0, 8)}... marked as needsSync`);
          useFeedsStore.getState().markFeedNeedsSync(serverFeed.id, true);
        }
        continue;
      }

      // Check if blockIndex has increased
      const currentBlockIndex = currentFeed.blockIndex ?? 0;
      const serverBlockIndex = serverFeed.blockIndex ?? 0;

      if (serverBlockIndex > currentBlockIndex) {
        // Feed has new data - mark it as needing sync (unless it's the active feed)
        if (serverFeed.id !== selectedFeedId) {
          debugLog(`[FeedsSyncable] Feed ${serverFeed.id.substring(0, 8)}... blockIndex changed: ${currentBlockIndex} -> ${serverBlockIndex}, marked as needsSync`);
          useFeedsStore.getState().markFeedNeedsSync(serverFeed.id, true);
        } else {
          debugLog(`[FeedsSyncable] Active feed ${serverFeed.id.substring(0, 8)}... has new data - will sync immediately`);
        }
      }
    }
  }

  /**
   * Sync messages only for the currently active feed (incremental sync)
   * Called after initial sync is complete
   */
  private async syncActiveFeedMessages(address: string): Promise<void> {
    const selectedFeedId = useAppStore.getState().selectedFeedId;

    if (!selectedFeedId) {
      // No feed selected, nothing to sync
      return;
    }

    const { feeds } = useFeedsStore.getState();
    const activeFeed = feeds.find(f => f.id === selectedFeedId);

    if (!activeFeed) {
      debugLog(`[FeedsSyncable] Active feed ${selectedFeedId.substring(0, 8)}... not found in store`);
      return;
    }

    // Check if the active feed has changes (blockIndex increased from server sync)
    // We compare with our tracked previousBlockIndex
    const previousBlockIndex = this.previousFeedBlockIndices.get(selectedFeedId) ?? 0;
    const currentBlockIndex = activeFeed.blockIndex ?? 0;

    const hasNewMessages = currentBlockIndex > previousBlockIndex || activeFeed.needsSync;

    // Always sync for active feed to get reaction updates
    // Reactions don't update blockIndex, so we need to poll for them
    // We pass hasNewMessages to determine if we should process messages or just reactions
    debugLog(`[FeedsSyncable] syncActiveFeedMessages: feedId=${selectedFeedId.substring(0, 8)}..., hasNewMessages=${hasNewMessages}`);
    await this.syncMessagesForFeed(address, activeFeed, hasNewMessages);

    // For group feeds, also sync members and KeyGenerations periodically
    // This ensures system messages for new members appear without page refresh
    if (activeFeed.type === 'group') {
      await this.syncGroupFeedData([activeFeed], address);
    }

    // Clear the needsSync flag if it was set
    if (activeFeed.needsSync) {
      useFeedsStore.getState().clearFeedNeedsSync(selectedFeedId);
    }
  }

  /**
   * Sync messages for a specific feed
   * @param processMessages - If true, process new messages. If false, only sync reaction tallies.
   */
  private async syncMessagesForFeed(address: string, feed: Feed, processMessages: boolean = true): Promise<void> {
    const { syncMetadata } = useFeedsStore.getState();
    let blockIndex = syncMetadata.lastMessageBlockIndex;

    // On new session, reset to fetch all messages from block 0
    if (this.shouldResetReactionTallyVersion) {
      blockIndex = 0;
    }

    // Fetch messages for this specific feed
    // TODO: The API currently fetches all messages for all feeds
    // Ideally, we should have a per-feed endpoint: fetchMessagesForFeed(feedId, fromBlock)
    // For now, we still fetch all but only process the ones we need
    debugLog(`[FeedsSyncable] syncMessagesForFeed: blockIndex=${blockIndex}, lastReactionTallyVersion=${syncMetadata.lastReactionTallyVersion}, processMessages=${processMessages}`);
    const response = await fetchMessages(address, blockIndex, syncMetadata.lastReactionTallyVersion);
    const { messages: newMessages, maxBlockIndex, reactionTallies, maxReactionTallyVersion } = response;
    debugLog(`[FeedsSyncable] syncMessagesForFeed response: messages=${newMessages.length}, reactionTallies=${reactionTallies.length}, maxReactionTallyVersion=${maxReactionTallyVersion}`);

    // Process messages if the server returned any for this feed
    // (Always process, regardless of processMessages flag - server returned them for a reason)
    const feedMessages = newMessages.filter(m => m.feedId === feed.id);
    if (feedMessages.length > 0) {
      debugLog(`[FeedsSyncable] Found ${feedMessages.length} new message(s) for feed ${feed.id.substring(0, 8)}...`);

      // For group feeds, use multi-key decryption with fallback to trying all keys
      if (feed.type === 'group') {
        const decryptedMessages = await this.decryptGroupMessages(feed.id, feedMessages);
        useFeedsStore.getState().addMessages(feed.id, decryptedMessages);
      } else {
        // Non-group feeds: Use the single AES key
        const feedAesKey = feed.aesKey;
        if (feedAesKey) {
          const decryptedMessages = await Promise.all(
            feedMessages.map(async (msg) => {
              try {
                const decryptedContent = await aesDecrypt(msg.content, feedAesKey);
                return {
                  ...msg,
                  content: decryptedContent,
                  contentEncrypted: msg.content,
                };
              } catch (error) {
                debugError(`[FeedsSyncable] Failed to decrypt message ${msg.id}:`, error);
                return msg;
              }
            })
          );
          useFeedsStore.getState().addMessages(feed.id, decryptedMessages);
        } else {
          debugWarn(`[FeedsSyncable] No AES key for feed ${feed.id}, storing encrypted messages`);
          useFeedsStore.getState().addMessages(feed.id, feedMessages);
        }
      }
    }

    // Always process reaction tallies for this feed
    if (reactionTallies.length > 0) {
      const feedTallies = reactionTallies.filter(t => {
        // Find if this tally belongs to a message in our feed
        const { messages } = useFeedsStore.getState();
        const feedMsgs = messages[feed.id] ?? [];
        return feedMsgs.some(m => m.id === t.messageId);
      });

      if (feedTallies.length > 0) {
        debugLog(`[FeedsSyncable] Processing ${feedTallies.length} reaction tally(s) for active feed`);
        const feeds = useFeedsStore.getState().feeds;
        await this.processReactionTallies(feedTallies, feeds);
      }
    }

    // Update sync metadata
    useFeedsStore.getState().setSyncMetadata({
      lastMessageBlockIndex: maxBlockIndex,
      lastReactionTallyVersion: maxReactionTallyVersion,
    });
  }

  /**
   * Decrypt group feed messages by trying all available KeyGeneration keys.
   *
   * Since the server doesn't yet return the KeyGeneration with each message,
   * we try all available keys until one works. Messages that fail all decryption
   * attempts are marked with decryptionFailed: true.
   *
   * @param feedId - The group feed ID
   * @param messages - Messages to decrypt
   * @returns Array of messages with decrypted content or decryptionFailed flag
   */
  private async decryptGroupMessages(feedId: string, messages: FeedMessage[]): Promise<FeedMessage[]> {
    const keyState = useFeedsStore.getState().getGroupKeyState(feedId);

    if (!keyState || keyState.keyGenerations.length === 0) {
      debugWarn(`[FeedsSyncable] No KeyGenerations available for group feed ${feedId.substring(0, 8)}...`);
      // Mark all messages as decryption failed
      return messages.map(msg => ({
        ...msg,
        contentEncrypted: msg.content,
        decryptionFailed: true,
      }));
    }

    // Get all available AES keys, sorted by keyGeneration descending (try newest first)
    const keysToTry = [...keyState.keyGenerations]
      .filter(kg => kg.aesKey) // Only try keys we have
      .sort((a, b) => b.keyGeneration - a.keyGeneration); // Newest first

    debugLog(`[FeedsSyncable] Decrypting ${messages.length} group messages, ${keysToTry.length} keys available`);

    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        // If message has KeyGeneration from server, use that specific key
        if (msg.keyGeneration !== undefined) {
          const specificKey = keyState.keyGenerations.find(
            kg => kg.keyGeneration === msg.keyGeneration
          );

          if (specificKey?.aesKey) {
            try {
              const decryptedContent = await aesDecrypt(msg.content, specificKey.aesKey);
              return {
                ...msg,
                content: decryptedContent,
                contentEncrypted: msg.content,
                decryptionFailed: false,
              };
            } catch {
              debugWarn(`[FeedsSyncable] Failed to decrypt msg ${msg.id.substring(0, 8)}... with keyGen=${msg.keyGeneration}`);
              // Mark as failed - we have the key but it didn't work
              return {
                ...msg,
                contentEncrypted: msg.content,
                decryptionFailed: true,
              };
            }
          } else {
            // We don't have this KeyGeneration (unban gap)
            debugLog(`[FeedsSyncable] Missing keyGen=${msg.keyGeneration} for msg ${msg.id.substring(0, 8)}...`);
            useFeedsStore.getState().recordMissingKeyGeneration(feedId, msg.keyGeneration);
            return {
              ...msg,
              contentEncrypted: msg.content,
              decryptionFailed: true,
            };
          }
        }

        // No KeyGeneration in message - try all keys until one works
        for (const keyGen of keysToTry) {
          try {
            const decryptedContent = await aesDecrypt(msg.content, keyGen.aesKey);
            // Success! Record which key worked
            debugLog(`[FeedsSyncable] Decrypted msg ${msg.id.substring(0, 8)}... with keyGen=${keyGen.keyGeneration}`);
            return {
              ...msg,
              content: decryptedContent,
              contentEncrypted: msg.content,
              keyGeneration: keyGen.keyGeneration, // Remember which key worked
              decryptionFailed: false,
            };
          } catch {
            // This key didn't work, try next
            continue;
          }
        }

        // All keys failed - mark message as decryption failed
        debugWarn(`[FeedsSyncable] All ${keysToTry.length} keys failed for msg ${msg.id.substring(0, 8)}...`);
        return {
          ...msg,
          contentEncrypted: msg.content,
          decryptionFailed: true,
        };
      })
    );

    // Log summary
    const failedCount = decryptedMessages.filter(m => m.decryptionFailed).length;
    if (failedCount > 0) {
      debugWarn(`[FeedsSyncable] ${failedCount}/${messages.length} messages could not be decrypted`);
    }

    return decryptedMessages;
  }
}

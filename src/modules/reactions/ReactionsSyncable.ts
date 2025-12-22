/**
 * Reactions Syncable
 *
 * Syncs reaction tallies for visible messages.
 * Implements ISyncable interface for SyncProvider integration.
 * Also handles initialization and commitment registration.
 */

import type { ISyncable } from '@/lib/sync/types';
import { reactionsServiceInstance } from './ReactionsService';
import { useReactionsStore } from './useReactionsStore';
import { useFeedsStore } from '@/modules/feeds/useFeedsStore';
import { useAppStore } from '@/stores';
import { debugLog, debugError } from '@/lib/debug-logger';
import {
  initializeReactionsSystem,
  ensureCommitmentRegistered,
  isReactionsInitialized,
  clearRegistrationCache,
} from './initializeReactions';

/**
 * Reactions Syncable - syncs reaction data
 */
class ReactionsSyncableClass implements ISyncable {
  name = 'ReactionsSyncable';
  requiresAuth = true; // Requires user to be logged in

  // Track which messages we've synced recently
  private lastSyncedMessages: Set<string> = new Set();
  private lastSyncTime = 0;
  private lastFullRefreshTime = 0;
  private readonly SYNC_COOLDOWN_MS = 5_000; // 5 seconds between syncs
  private readonly FULL_REFRESH_INTERVAL_MS = 15_000; // 15 seconds for full refresh

  // Track initialization state
  private isInitializing = false;
  private initializationAttempted = false;

  // Track which feeds we've registered commitments for
  private registeredFeeds: Set<string> = new Set();

  async syncTask(): Promise<void> {
    const reactionsStore = useReactionsStore.getState();
    const feedsStore = useFeedsStore.getState();
    const appStore = useAppStore.getState();

    // Step 1: Initialize reactions system if not done yet
    if (!isReactionsInitialized() && !this.isInitializing && !this.initializationAttempted) {
      const mnemonic = appStore.credentials?.mnemonic;
      console.log('[ReactionsSyncable] Checking mnemonic:', mnemonic ? `${mnemonic.length} words` : 'null');
      if (mnemonic && mnemonic.length > 0) {
        this.isInitializing = true;
        this.initializationAttempted = true;
        console.log('[ReactionsSyncable] Initializing reactions system...');
        debugLog('[ReactionsSyncable] Initializing reactions system...');

        try {
          const success = await initializeReactionsSystem(mnemonic);
          if (success) {
            console.log('[ReactionsSyncable] Reactions system initialized successfully');
            debugLog('[ReactionsSyncable] Reactions system initialized');
          } else {
            console.error('[ReactionsSyncable] Failed to initialize reactions system');
            debugError('[ReactionsSyncable] Failed to initialize reactions system');
          }
        } catch (error) {
          console.error('[ReactionsSyncable] Error initializing reactions system:', error);
          debugError('[ReactionsSyncable] Error initializing reactions system:', error);
        } finally {
          this.isInitializing = false;
        }
      } else {
        console.log('[ReactionsSyncable] No mnemonic available, skipping initialization');
        debugLog('[ReactionsSyncable] No mnemonic available, skipping initialization');
        return;
      }
    }

    // Skip if still initializing or no commitment yet
    if (this.isInitializing || !isReactionsInitialized()) {
      return;
    }

    // Step 2: Register commitment for all feeds user is part of
    const feeds = Object.values(feedsStore.feeds);
    console.log(`[ReactionsSyncable] Found ${feeds.length} feeds to register`);
    for (const feed of feeds) {
      if (!this.registeredFeeds.has(feed.id)) {
        console.log(`[ReactionsSyncable] Registering commitment for feed ${feed.id.substring(0, 8)}...`);
        // Register in background, don't block
        ensureCommitmentRegistered(feed.id)
          .then((success) => {
            if (success) {
              console.log(`[ReactionsSyncable] Successfully registered for feed ${feed.id.substring(0, 8)}...`);
              this.registeredFeeds.add(feed.id);
            } else {
              console.warn(`[ReactionsSyncable] Failed to register for feed ${feed.id.substring(0, 8)}...`);
            }
          })
          .catch((error) => {
            console.error(`[ReactionsSyncable] Error registering for feed ${feed.id}:`, error);
            debugError(`[ReactionsSyncable] Failed to register for feed ${feed.id}:`, error);
          });
      }
    }

    // Note: Reaction tallies are synced via FeedsSyncable (server sends them with messages).
    // This syncable is for supplementary tasks like fetching my own reactions.

    // For now, skip if no feeds loaded yet
    if (feeds.length === 0) {
      debugLog('[ReactionsSyncable] No feeds loaded yet, skipping');
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_COOLDOWN_MS) {
      return;
    }

    // Periodic full refresh - clear tracking to re-fetch all tallies
    if (now - this.lastFullRefreshTime > this.FULL_REFRESH_INTERVAL_MS) {
      debugLog('[ReactionsSyncable] Performing full refresh of reaction tallies');
      this.lastSyncedMessages.clear();
      this.lastFullRefreshTime = now;
    }

    try {
      reactionsStore.setSyncing(true);

      // Get currently visible messages (from active feed)
      // For now, we'll sync reactions for all loaded messages
      // In a real implementation, this would be optimized to only sync visible messages
      const messageIds = this.getVisibleMessageIds(feedsStore);

      if (messageIds.length === 0) {
        return;
      }

      // Filter to messages we haven't synced recently
      const newMessageIds = messageIds.filter((id) => !this.lastSyncedMessages.has(id));

      if (newMessageIds.length === 0) {
        return;
      }

      // Get the current feed's private key (for decryption)
      // This would need to be obtained from the feed context
      // For now, we'll skip actual decryption and just fetch tallies

      debugLog(`[ReactionsSyncable] Syncing ${newMessageIds.length} messages`);

      // Update tracking
      for (const id of newMessageIds) {
        this.lastSyncedMessages.add(id);
      }
      this.lastSyncTime = now;

      // Cleanup old tracked messages (keep last 100)
      if (this.lastSyncedMessages.size > 100) {
        const toRemove = Array.from(this.lastSyncedMessages).slice(0, 50);
        for (const id of toRemove) {
          this.lastSyncedMessages.delete(id);
        }
      }
    } catch (error) {
      debugLog('[ReactionsSyncable] Sync error:', error);
      reactionsStore.setError('Failed to sync reactions');
    } finally {
      reactionsStore.setSyncing(false);
    }
  }

  /**
   * Get IDs of messages that should have reactions synced
   */
  private getVisibleMessageIds(feedsStore: ReturnType<typeof useFeedsStore.getState>): string[] {
    const messageIds: string[] = [];

    // Get messages from all feeds (in a real implementation, this would be smarter)
    for (const [feedId, messages] of Object.entries(feedsStore.messages)) {
      // Get the most recent messages (likely visible)
      const recentMessages = messages.slice(-20); // Last 20 messages
      for (const msg of recentMessages) {
        if (msg.id && msg.isConfirmed) {
          messageIds.push(msg.id);
        }
      }
    }

    return messageIds;
  }

  /**
   * Force sync for specific messages
   */
  async syncMessages(feedId: string, messageIds: string[], feedPrivateKey: bigint): Promise<void> {
    const reactionsStore = useReactionsStore.getState();

    if (!reactionsStore.isBsgsReady) {
      throw new Error('BSGS not ready');
    }

    await reactionsServiceInstance.getTallies(feedId, messageIds, feedPrivateKey);
  }

  /**
   * Clear sync tracking (e.g., on logout)
   */
  reset(): void {
    this.lastSyncedMessages.clear();
    this.lastSyncTime = 0;
    this.registeredFeeds.clear();
    this.initializationAttempted = false;
    clearRegistrationCache();
  }
}

export const reactionsSyncable = new ReactionsSyncableClass();

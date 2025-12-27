/**
 * Reactions Syncable
 *
 * Handles reactions system initialization and commitment registration.
 * Implements ISyncable interface for SyncProvider integration.
 *
 * NOTE: Actual reaction tally syncing is done by:
 *   - FeedsSyncable (server sends tallies with messages)
 *   - useFeedReactions hook (polls for active feed's tallies)
 */

import type { ISyncable } from '@/lib/sync/types';
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
 * Reactions Syncable
 *
 * Handles reactions system initialization and commitment registration.
 * NOTE: Actual reaction tally syncing is done by:
 *   - FeedsSyncable (receives tallies from server with messages)
 *   - useFeedReactions hook (polls for active feed's tallies)
 */
class ReactionsSyncableClass implements ISyncable {
  name = 'ReactionsSyncable';
  requiresAuth = true; // Requires user to be logged in

  // Track initialization state
  private isInitializing = false;
  private initializationAttempted = false;

  // Track which feeds we've registered commitments for
  private registeredFeeds: Set<string> = new Set();

  async syncTask(): Promise<void> {
    const feedsStore = useFeedsStore.getState();
    const appStore = useAppStore.getState();

    // Step 1: Initialize reactions system if not done yet
    if (!isReactionsInitialized() && !this.isInitializing && !this.initializationAttempted) {
      const mnemonic = appStore.credentials?.mnemonic;
      debugLog('[ReactionsSyncable] Checking mnemonic:', mnemonic ? `${mnemonic.length} words` : 'null');
      if (mnemonic && mnemonic.length > 0) {
        this.isInitializing = true;
        this.initializationAttempted = true;
        debugLog('[ReactionsSyncable] Initializing reactions system...');

        try {
          const success = await initializeReactionsSystem(mnemonic);
          if (success) {
            debugLog('[ReactionsSyncable] Reactions system initialized');
          } else {
            debugError('[ReactionsSyncable] Failed to initialize reactions system');
          }
        } catch (error) {
          debugError('[ReactionsSyncable] Error initializing reactions system:', error);
        } finally {
          this.isInitializing = false;
        }
      } else {
        debugLog('[ReactionsSyncable] No mnemonic available, skipping initialization');
        return;
      }
    }

    // Skip if still initializing or no commitment yet
    if (this.isInitializing || !isReactionsInitialized()) {
      return;
    }

    // Step 2: Register commitment for new feeds only (skip already registered)
    const feeds = Object.values(feedsStore.feeds);
    const unregisteredFeeds = feeds.filter(f => !this.registeredFeeds.has(f.id));

    if (unregisteredFeeds.length > 0) {
      debugLog(`[ReactionsSyncable] Found ${unregisteredFeeds.length} new feeds to register`);
      for (const feed of unregisteredFeeds) {
        debugLog(`[ReactionsSyncable] Registering commitment for feed ${feed.id.substring(0, 8)}...`);
        // Register in background, don't block
        ensureCommitmentRegistered(feed.id)
          .then((success) => {
            if (success) {
              debugLog(`[ReactionsSyncable] Successfully registered for feed ${feed.id.substring(0, 8)}`);
              this.registeredFeeds.add(feed.id);
            } else {
              debugLog(`[ReactionsSyncable] Failed to register for feed ${feed.id.substring(0, 8)}`);
            }
          })
          .catch((error) => {
            debugError(`[ReactionsSyncable] Error registering for feed ${feed.id}:`, error);
          });
      }
    }

    // Reaction tallies are synced via:
    // - FeedsSyncable (server sends them with messages)
    // - useFeedReactions hook (polls for active feed's tallies)
    // This syncable only handles initialization and commitment registration.
  }

  /**
   * Clear sync tracking (e.g., on logout)
   */
  reset(): void {
    this.registeredFeeds.clear();
    this.initializationAttempted = false;
    clearRegistrationCache();
  }
}

export const reactionsSyncable = new ReactionsSyncableClass();

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
import { fetchFeeds, fetchMessages, submitTransaction } from './FeedsService';
import { useFeedsStore } from './useFeedsStore';
import { useBlockchainStore } from '../blockchain/useBlockchainStore';
import type { Feed, FeedMessage } from '@/types';

// Minimum blocks to wait before resetting pending personal feed creation
const MIN_BLOCKS_BEFORE_RESET = 5;

export class FeedsSyncable implements ISyncable {
  name = 'FeedsSyncable';
  requiresAuth = true; // Only runs when authenticated

  private isSyncing = false;

  private isFirstSync = true;

  async syncTask(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('[FeedsSyncable] Skipping - already syncing');
      return;
    }

    const credentials = useAppStore.getState().credentials;

    if (!credentials?.signingPublicKey) {
      console.log('[FeedsSyncable] Skipping - no credentials');
      return;
    }

    // Log on first sync
    if (this.isFirstSync) {
      console.log('[FeedsSyncable] Starting feeds sync...');
      console.log(`  - Address: ${credentials.signingPublicKey.substring(0, 20)}...`);
    }

    this.isSyncing = true;
    useFeedsStore.getState().setSyncing(true);

    try {
      // Sync feeds from blockchain
      await this.syncFeeds(credentials.signingPublicKey);

      // Sync messages from blockchain
      await this.syncMessages(credentials.signingPublicKey);

      // Check for personal feed and create if missing
      await this.ensurePersonalFeed(credentials);

      // Clear any previous error
      useFeedsStore.getState().setError(null);

      this.isFirstSync = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FeedsSyncable] Sync failed: ${message}`, error);
      useFeedsStore.getState().setError(message);
      throw error; // Re-throw so SyncProvider can track failures
    } finally {
      this.isSyncing = false;
      useFeedsStore.getState().setSyncing(false);
    }
  }

  /**
   * Sync feeds from blockchain
   */
  private async syncFeeds(address: string): Promise<void> {
    const { syncMetadata } = useFeedsStore.getState();
    const currentBlockHeight = useBlockchainStore.getState().blockHeight;
    let blockIndex = syncMetadata.lastFeedBlockIndex;

    // Detect blockchain reset: if server block height is lower than our last sync block,
    // the database was reset and we need to clear all local cached data
    if (currentBlockHeight > 0 && blockIndex > 0 && currentBlockHeight < blockIndex) {
      console.log('[FeedsSyncable] Blockchain reset detected!');
      console.log(`  - Server block height: ${currentBlockHeight}`);
      console.log(`  - Client last sync block: ${blockIndex}`);
      console.log('[FeedsSyncable] Clearing local feeds cache and resyncing from scratch...');
      useFeedsStore.getState().reset();
      blockIndex = 0;
      // Re-fetch state after reset
      this.isFirstSync = true;
    }

    // Check if any feed is missing its AES key - if so, force a full refresh from block 0
    const currentFeeds = useFeedsStore.getState().feeds;
    const feedsMissingKey = currentFeeds.filter((f) => f.encryptedFeedKey && !f.aesKey);
    const feedsNoEncryptedKey = currentFeeds.filter((f) => !f.encryptedFeedKey && !f.aesKey);

    if (feedsMissingKey.length > 0 || feedsNoEncryptedKey.length > 0) {
      console.log(`[FeedsSyncable] Feeds missing AES key: ${feedsMissingKey.length}, missing encryptedFeedKey: ${feedsNoEncryptedKey.length}`);
      if (feedsNoEncryptedKey.length > 0) {
        // Force refresh from block 0 to get encryptedFeedKey from server
        console.log('[FeedsSyncable] Forcing full refresh to get encryptedFeedKey');
        blockIndex = 0;
      }
    }

    // Log on first sync or when feeds are empty
    if (currentFeeds.length === 0 || this.isFirstSync) {
      console.log(`[FeedsSyncable] Syncing feeds for address: ${address.substring(0, 20)}...`);
      console.log(`  - Current feed count: ${currentFeeds.length}`);
      console.log(`  - Last sync block: ${blockIndex}`);
    }

    const { feeds: newFeeds, maxBlockIndex } = await fetchFeeds(address, blockIndex);

    if (newFeeds.length > 0) {
      console.log(`[FeedsSyncable] Found ${newFeeds.length} new feed(s)`);
      newFeeds.forEach(f => console.log(`  - Feed: ${f.name} (${f.type}, id: ${f.id})`));
      useFeedsStore.getState().addFeeds(newFeeds);
      useFeedsStore.getState().setSyncMetadata({ lastFeedBlockIndex: maxBlockIndex });

      // Decrypt feed keys for new feeds
      await this.decryptFeedKeys(newFeeds);
    } else if (currentFeeds.length === 0) {
      console.log('[FeedsSyncable] No feeds found for this user');
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
      console.log('[FeedsSyncable] Cannot decrypt feed keys - no encryption private key');
      return;
    }

    for (const feed of feeds) {
      if (feed.encryptedFeedKey && !feed.aesKey) {
        try {
          // Pass hex string directly - eciesDecrypt expects a hex string
          const decryptedKey = await eciesDecrypt(feed.encryptedFeedKey, credentials.encryptionPrivateKey);
          useFeedsStore.getState().updateFeedAesKey(feed.id, decryptedKey);
          console.log(`[FeedsSyncable] Decrypted AES key for feed: ${feed.name}`);
        } catch (error) {
          console.error(`[FeedsSyncable] Failed to decrypt feed key for ${feed.name}:`, error);
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
      console.log(`[FeedsSyncable] ${feedsNeedingDecryption.length} feed(s) need key decryption`);
      await this.decryptFeedKeys(feedsNeedingDecryption);
    }

    // Log status of all feeds
    const allFeeds = useFeedsStore.getState().feeds;
    allFeeds.forEach((f) => {
      if (!f.aesKey) {
        console.log(`[FeedsSyncable] Feed "${f.name}" missing aesKey (hasEncryptedKey: ${!!f.encryptedFeedKey})`);
      }
    });
  }

  /**
   * Sync messages from blockchain
   */
  private async syncMessages(address: string): Promise<void> {
    const { syncMetadata, feeds } = useFeedsStore.getState();
    const blockIndex = syncMetadata.lastMessageBlockIndex;

    const { messages: newMessages, maxBlockIndex } = await fetchMessages(address, blockIndex);

    if (newMessages.length > 0) {
      console.log(`[FeedsSyncable] Found ${newMessages.length} new message(s)`);

      // Group messages by feed ID
      const messagesByFeed = new Map<string, FeedMessage[]>();
      for (const msg of newMessages) {
        const feedMessages = messagesByFeed.get(msg.feedId) || [];
        feedMessages.push(msg);
        messagesByFeed.set(msg.feedId, feedMessages);
      }

      // Decrypt and add messages to each feed
      for (const [feedId, messages] of messagesByFeed) {
        // Get the feed's AES key for decryption
        const feed = feeds.find((f) => f.id === feedId);
        const feedAesKey = feed?.aesKey;

        if (feedAesKey) {
          // Decrypt message content
          const decryptedMessages = await Promise.all(
            messages.map(async (msg) => {
              try {
                const decryptedContent = await aesDecrypt(msg.content, feedAesKey);
                return {
                  ...msg,
                  content: decryptedContent,
                  contentEncrypted: msg.content, // Keep encrypted version
                };
              } catch (error) {
                console.error(`[FeedsSyncable] Failed to decrypt message ${msg.id}:`, error);
                return msg; // Keep original if decryption fails
              }
            })
          );
          useFeedsStore.getState().addMessages(feedId, decryptedMessages);
        } else {
          console.warn(`[FeedsSyncable] No AES key for feed ${feedId}, storing encrypted messages`);
          useFeedsStore.getState().addMessages(feedId, messages);
        }
      }

      useFeedsStore.getState().setSyncMetadata({ lastMessageBlockIndex: maxBlockIndex });
    }
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
      console.log('[FeedsSyncable] Checking personal feed status...');
      console.log(`  - hasPersonalFeed: ${store.hasPersonalFeed()}`);
      console.log(`  - isCreatingPersonalFeed: ${store.isCreatingPersonalFeed}`);
      console.log(`  - isPersonalFeedCreationPending: ${store.syncMetadata.isPersonalFeedCreationPending}`);
      console.log(`  - personalFeedCreationBlockIndex: ${store.syncMetadata.personalFeedCreationBlockIndex}`);
      console.log(`  - currentBlockHeight: ${currentBlockHeight}`);
      console.log(`  - hasMnemonic: ${!!credentials.mnemonic}`);
    }

    // Check if personal feed already exists
    if (store.hasPersonalFeed()) {
      // If we were waiting for it to be created, clear the pending flag
      if (store.syncMetadata.isPersonalFeedCreationPending) {
        console.log('[FeedsSyncable] Personal feed confirmed on blockchain');
        store.setSyncMetadata({
          isPersonalFeedCreationPending: false,
          personalFeedCreationBlockIndex: 0
        });
      }
      return;
    }

    // Don't create if already creating
    if (store.isCreatingPersonalFeed) {
      console.log('[FeedsSyncable] Skipping - already creating personal feed');
      return;
    }

    // If pending, check if enough blocks have passed before resetting
    if (store.syncMetadata.isPersonalFeedCreationPending) {
      const blocksSinceCreation = currentBlockHeight - store.syncMetadata.personalFeedCreationBlockIndex;

      if (blocksSinceCreation < MIN_BLOCKS_BEFORE_RESET) {
        // Still waiting for blockchain confirmation
        console.log(`[FeedsSyncable] Personal feed creation pending, waiting for confirmation (${blocksSinceCreation}/${MIN_BLOCKS_BEFORE_RESET} blocks)`);
        return;
      }

      // Enough blocks have passed, reset and try again
      console.log(`[FeedsSyncable] Personal feed creation timed out after ${blocksSinceCreation} blocks - resetting`);
      store.setSyncMetadata({
        isPersonalFeedCreationPending: false,
        personalFeedCreationBlockIndex: 0
      });
    }

    // Don't create if no mnemonic
    if (!credentials.mnemonic) {
      console.log('[FeedsSyncable] Cannot create personal feed - no mnemonic in credentials');
      return;
    }

    console.log('[FeedsSyncable] No personal feed detected, creating one...');
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
      console.log('[FeedsSyncable] Submitting personal feed transaction...');
      const result = await submitTransaction(signedTransaction);

      if (!result.successful) {
        throw new Error(result.message || 'Failed to create personal feed');
      }

      console.log('[FeedsSyncable] Personal feed creation transaction submitted successfully');
      // Keep isPersonalFeedCreationPending true - it will be cleared when feed appears in sync
    } catch (error) {
      console.error('[FeedsSyncable] Failed to create personal feed:', error);
      store.setSyncMetadata({
        isPersonalFeedCreationPending: false,
        personalFeedCreationBlockIndex: 0
      });
      throw error;
    } finally {
      store.setCreatingPersonalFeed(false);
    }
  }
}

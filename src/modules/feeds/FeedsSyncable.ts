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
import type { Feed, FeedMessage } from '@/types';
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
    if (forceFullSync && currentFeeds.length > 0) {
      const serverFeedIds = new Set(serverFeeds.map(f => f.id));
      const staleFeedIds = currentFeeds.filter(f => !serverFeedIds.has(f.id));

      if (staleFeedIds.length > 0) {
        debugLog(`[FeedsSyncable] Found ${staleFeedIds.length} stale cached feed(s) not on server`);
        staleFeedIds.forEach(f => debugLog(`  - Stale: ${f.name} (${f.type}, id: ${f.id})`));
        debugLog('[FeedsSyncable] Clearing stale feeds from cache...');
        // Reset the store to clear stale data, then add server feeds
        useFeedsStore.getState().reset();
      } else if (serverFeeds.length === 0 && currentFeeds.length > 0) {
        // Server has no feeds but we have cached feeds - they're all stale
        debugLog('[FeedsSyncable] Server has no feeds but client has cached data - clearing stale cache');
        useFeedsStore.getState().reset();
      }
    }

    if (serverFeeds.length > 0) {
      debugLog(`[FeedsSyncable] Found ${serverFeeds.length} feed(s) from server`);
      serverFeeds.forEach(f => debugLog(`  - Feed: ${f.name} (${f.type}, id: ${f.id})`));

      // Detect chat feeds with BlockIndex changes (participant may have updated their name)
      const feedsWithChangedBlockIndex = this.detectBlockIndexChanges(currentFeeds, serverFeeds);

      useFeedsStore.getState().addFeeds(serverFeeds);
      useFeedsStore.getState().setSyncMetadata({ lastFeedBlockIndex: maxBlockIndex });

      // Decrypt feed keys for new feeds
      await this.decryptFeedKeys(serverFeeds);

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
   * Sync messages from blockchain
   */
  private async syncMessages(address: string): Promise<void> {
    const { syncMetadata, feeds } = useFeedsStore.getState();
    const blockIndex = syncMetadata.lastMessageBlockIndex;

    // On new session, reset reaction tally version to get all tallies fresh
    // This ensures we sync all reactions after page reload
    // Use the flag set at start of syncTask (before hasValidatedThisSession was updated)
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
                debugError(`[FeedsSyncable] Failed to decrypt message ${msg.id}:`, error);
                return msg; // Keep original if decryption fails
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

          // Update the store with decrypted counts
          reactionsStore.updateTally(tally.messageId, decryptedCounts);
          // Also update the tally version
          useReactionsStore.setState(state => ({
            reactions: {
              ...state.reactions,
              [tally.messageId]: {
                ...state.reactions[tally.messageId],
                tallyVersion: tally.tallyVersion,
              },
            },
          }));
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
}

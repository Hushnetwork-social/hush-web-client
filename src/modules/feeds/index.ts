/**
 * Feeds Module
 *
 * Handles feeds and messages functionality:
 * - Feed synchronization
 * - Message synchronization
 * - Personal feed creation
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { SyncProviderAPI } from '@/lib/sync';
import { FeedsSyncable } from './FeedsSyncable';

// Re-export public API
export { useFeedsStore, FEED_TYPE_MAP } from './useFeedsStore';
export {
  fetchFeeds,
  fetchMessages,
  checkHasPersonalFeed,
  submitTransaction,
  sendMessage,
  findExistingChatFeed,
  createChatFeed,
} from './FeedsService';

/**
 * Registers the Feeds module with the SyncProvider.
 *
 * Called by registerAllModules during app initialization.
 */
export function registerFeedsModule(api: SyncProviderAPI): void {
  console.log('[FeedsModule] Registering...');

  // Create and register syncables
  const feedsSyncable = new FeedsSyncable();
  api.registerSyncable(feedsSyncable);

  console.log('[FeedsModule] Registration complete');
}

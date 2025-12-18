/**
 * Blockchain Module
 *
 * Handles blockchain-related functionality:
 * - Block height synchronization
 * - Transaction submission
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { SyncProviderAPI } from '@/lib/sync';
import { BlockHeightSyncable } from './BlockHeightSyncable';

// Re-export public API
export { useBlockchainStore } from './useBlockchainStore';
export { submitTransaction } from './BlockchainService';

/**
 * Registers the Blockchain module with the SyncProvider.
 *
 * Called by registerAllModules during app initialization.
 */
export function registerBlockchainModule(api: SyncProviderAPI): void {
  console.log('[BlockchainModule] Registering...');

  // Create and register syncables
  const blockHeightSyncable = new BlockHeightSyncable();
  api.registerSyncable(blockHeightSyncable);

  console.log('[BlockchainModule] Registration complete');
}

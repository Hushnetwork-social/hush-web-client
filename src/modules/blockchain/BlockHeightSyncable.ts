/**
 * Block Height Syncable
 *
 * Syncs the current blockchain height every cycle.
 * This is an always-running syncable (requiresAuth: false).
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { ISyncable } from '@/lib/sync';
import { fetchBlockHeight } from './BlockchainService';
import { useBlockchainStore } from './useBlockchainStore';
import { debugLog, debugError } from '@/lib/debug-logger';

export class BlockHeightSyncable implements ISyncable {
  name = 'BlockHeightSyncable';
  requiresAuth = false; // Runs always, even before login

  async syncTask(): Promise<void> {
    try {
      const height = await fetchBlockHeight();

      // Only update if height changed (avoid unnecessary re-renders)
      const currentHeight = useBlockchainStore.getState().blockHeight;
      if (height !== currentHeight) {
        useBlockchainStore.getState().setBlockHeight(height);
        debugLog(`[BlockHeightSyncable] Block height updated: ${height}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      debugError(`[BlockHeightSyncable] Sync failed: ${message}`);
      useBlockchainStore.getState().setError(message);
      throw error; // Re-throw so SyncProvider can track failures
    }
  }
}

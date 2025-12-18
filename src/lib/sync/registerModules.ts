/**
 * Central Module Registration
 *
 * This file is the single point where all modules register themselves.
 * Each module exports a registration function that is called here.
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import type { SyncProviderAPI } from './types';

// Module imports
import { registerBlockchainModule } from '@/modules/blockchain';
import { registerIdentityModule } from '@/modules/identity';
import { registerFeedsModule } from '@/modules/feeds';
// import { registerBankModule } from '@/modules/bank';

/**
 * Registers all modules with the SyncProvider.
 *
 * Called once during app initialization after SyncProvider is mounted.
 * Each module's registration function is responsible for:
 * - Creating its services and syncables
 * - Registering syncables with the SyncProvider
 *
 * @param api - The SyncProviderAPI for registering syncables
 */
export function registerAllModules(api: SyncProviderAPI): void {
  console.log('[registerAllModules] Starting module registration...');

  // Register modules (order matters: identity before feeds)
  registerBlockchainModule(api);
  registerIdentityModule(api);  // Identity must be registered before Feeds
  registerFeedsModule(api);
  // registerBankModule(api);  // TODO: Implement in Step 4

  console.log('[registerAllModules] Module registration complete');
}

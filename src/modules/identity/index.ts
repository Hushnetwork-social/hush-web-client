/**
 * Identity Module
 *
 * Handles identity synchronization:
 * - Check if identity exists in blockchain
 * - Create identity if missing
 *
 * This module should be registered BEFORE the Feeds module,
 * as feeds depend on having a valid identity.
 */

import type { SyncProviderAPI } from '@/lib/sync';
import { IdentitySyncable, resetIdentitySyncState } from './IdentitySyncable';
import { debugLog } from '@/lib/debug-logger';

// Re-export public API
export { checkIdentityExists, submitTransaction, searchByDisplayName } from './IdentityService';
export { resetIdentitySyncState, markIdentityCreatedByAuthPage } from './IdentitySyncable';

/**
 * Registers the Identity module with the SyncProvider.
 *
 * Called by registerAllModules during app initialization.
 */
export function registerIdentityModule(api: SyncProviderAPI): void {
  debugLog('[IdentityModule] Registering...');

  // Create and register syncables
  const identitySyncable = new IdentitySyncable();
  api.registerSyncable(identitySyncable);

  debugLog('[IdentityModule] Registration complete');
}

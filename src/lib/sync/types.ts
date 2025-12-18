/**
 * Sync Infrastructure Types
 *
 * Based on HushClient's ISyncable pattern.
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

/**
 * ISyncable interface - implemented by each module that needs to sync data.
 *
 * Modules register their syncables with the SyncProvider, which orchestrates
 * the sync loops based on the requiresAuth flag.
 */
export interface ISyncable {
  /**
   * Unique name for logging and debugging.
   * Example: 'BlockHeightSyncable', 'FeedsSyncable'
   */
  name: string;

  /**
   * Determines when this syncable runs:
   * - false: Runs always (even before login) - e.g., BlockHeight
   * - true: Runs only when user is authenticated - e.g., Feeds, Bank
   */
  requiresAuth: boolean;

  /**
   * The sync task that fetches and processes data.
   * Called every sync cycle (3 seconds) by the SyncProvider.
   *
   * Should handle its own error logging internally.
   * Throwing an error will be caught by SyncProvider and counted as a failure.
   */
  syncTask: () => Promise<void>;
}

/**
 * API provided by SyncProvider for module registration.
 */
export interface SyncProviderAPI {
  /**
   * Register a syncable with the SyncProvider.
   * Called during module registration (registerAllModules).
   */
  registerSyncable: (syncable: ISyncable) => void;

  /**
   * Get the current sync status.
   */
  getSyncStatus: () => SyncStatus;
}

/**
 * Current sync status exposed by SyncProvider.
 */
export interface SyncStatus {
  /** Whether any sync is currently running */
  isSyncing: boolean;

  /** Whether the auth-dependent sync loop is active */
  isAuthSyncActive: boolean;

  /** Whether sync is paused due to errors */
  isPaused: boolean;

  /** Number of consecutive failures */
  consecutiveFailures: number;

  /** Last error message, if any */
  lastError: string | null;
}

/**
 * Configuration for the SyncProvider.
 */
export interface SyncConfig {
  /** Interval between sync cycles in milliseconds (default: 3000) */
  intervalMs: number;

  /** Maximum consecutive failures before pausing (default: 5) */
  maxConsecutiveFailures: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  intervalMs: 3000,
  maxConsecutiveFailures: 5,
};

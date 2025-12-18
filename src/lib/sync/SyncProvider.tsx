'use client';

/**
 * SyncProvider - Central orchestrator for all sync operations.
 *
 * Based on HushClient's HushClientWorkflow pattern.
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 *
 * Responsibilities:
 * - Maintains registered syncables from all modules
 * - Runs two sync loops:
 *   1. Always-running loop: syncables where requiresAuth = false
 *   2. Auth-dependent loop: syncables where requiresAuth = true (only when authenticated)
 * - Handles errors and pauses sync after too many consecutive failures
 * - Provides sync status to components via context
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAppStore } from '@/stores';
import {
  type ISyncable,
  type SyncProviderAPI,
  type SyncStatus,
  type SyncConfig,
  DEFAULT_SYNC_CONFIG,
} from './types';
import { registerAllModules } from './registerModules';

// =============================================================================
// Context
// =============================================================================

interface SyncContextValue extends SyncStatus {
  /** Register a syncable (used during module registration) */
  registerSyncable: (syncable: ISyncable) => void;
}

const SyncContext = createContext<SyncContextValue>({
  isSyncing: false,
  isAuthSyncActive: false,
  isPaused: false,
  consecutiveFailures: 0,
  lastError: null,
  registerSyncable: () => {},
});

export function useSyncContext() {
  return useContext(SyncContext);
}

// =============================================================================
// Provider
// =============================================================================

interface SyncProviderProps {
  children: ReactNode;
  config?: Partial<SyncConfig>;
}

export function SyncProvider({ children, config }: SyncProviderProps) {
  const { intervalMs, maxConsecutiveFailures } = {
    ...DEFAULT_SYNC_CONFIG,
    ...config,
  };

  // Get auth state from app store
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  // Syncable registrations
  const syncablesRef = useRef<ISyncable[]>([]);
  const modulesRegisteredRef = useRef(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs for interval management
  const alwaysRunningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authDependentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // =============================================================================
  // Registration
  // =============================================================================

  const registerSyncable = useCallback((syncable: ISyncable) => {
    // Avoid duplicate registrations
    const exists = syncablesRef.current.some((s) => s.name === syncable.name);
    if (!exists) {
      console.log(`[SyncProvider] Registered syncable: ${syncable.name} (requiresAuth: ${syncable.requiresAuth})`);
      syncablesRef.current.push(syncable);
    }
  }, []);

  // =============================================================================
  // Module Registration (runs once on mount)
  // =============================================================================

  useEffect(() => {
    if (modulesRegisteredRef.current) return;
    modulesRegisteredRef.current = true;

    // Create API for module registration
    const api: SyncProviderAPI = {
      registerSyncable,
      getSyncStatus: () => ({
        isSyncing,
        isAuthSyncActive: isAuthenticated,
        isPaused,
        consecutiveFailures,
        lastError,
      }),
    };

    // Register all modules
    registerAllModules(api);
  }, [registerSyncable, isSyncing, isAuthenticated, isPaused, consecutiveFailures, lastError]);

  // =============================================================================
  // Sync Execution
  // =============================================================================

  const runSyncTasks = useCallback(
    async (syncables: ISyncable[], loopName: string) => {
      if (isPaused || !isMountedRef.current) return;

      setIsSyncing(true);

      for (const syncable of syncables) {
        if (!isMountedRef.current || isPaused) break;

        try {
          await syncable.syncTask();
          // Reset failures on success
          if (consecutiveFailures > 0) {
            setConsecutiveFailures(0);
            setLastError(null);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[SyncProvider] ${loopName} - ${syncable.name} failed:`, errorMessage);

          setConsecutiveFailures((prev) => {
            const newCount = prev + 1;
            if (newCount >= maxConsecutiveFailures) {
              console.error(`[SyncProvider] Too many consecutive failures (${newCount}). Sync paused.`);
              setIsPaused(true);
            }
            return newCount;
          });
          setLastError(`${syncable.name}: ${errorMessage}`);
        }
      }

      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    },
    [isPaused, consecutiveFailures, maxConsecutiveFailures]
  );

  // =============================================================================
  // Always-Running Loop (requiresAuth = false)
  // =============================================================================

  useEffect(() => {
    isMountedRef.current = true;

    const alwaysRunningSyncables = syncablesRef.current.filter((s) => !s.requiresAuth);

    if (alwaysRunningSyncables.length === 0) {
      console.log('[SyncProvider] No always-running syncables registered yet');
      return;
    }

    console.log(`[SyncProvider] Starting always-running loop with ${alwaysRunningSyncables.length} syncable(s)`);

    // Initial sync after small delay
    const initialTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        runSyncTasks(alwaysRunningSyncables, 'AlwaysRunning');
      }
    }, 500);

    // Set up interval
    alwaysRunningIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        // Re-filter in case new syncables were registered
        const currentSyncables = syncablesRef.current.filter((s) => !s.requiresAuth);
        runSyncTasks(currentSyncables, 'AlwaysRunning');
      }
    }, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      if (alwaysRunningIntervalRef.current) {
        clearInterval(alwaysRunningIntervalRef.current);
        alwaysRunningIntervalRef.current = null;
      }
    };
  }, [intervalMs, runSyncTasks]);

  // =============================================================================
  // Auth-Dependent Loop (requiresAuth = true)
  // =============================================================================

  useEffect(() => {
    if (!isAuthenticated) {
      // Stop auth-dependent sync when logged out
      if (authDependentIntervalRef.current) {
        console.log('[SyncProvider] Stopping auth-dependent loop (logged out)');
        clearInterval(authDependentIntervalRef.current);
        authDependentIntervalRef.current = null;
      }
      return;
    }

    const authDependentSyncables = syncablesRef.current.filter((s) => s.requiresAuth);

    if (authDependentSyncables.length === 0) {
      console.log('[SyncProvider] No auth-dependent syncables registered yet');
      return;
    }

    console.log(`[SyncProvider] Starting auth-dependent loop with ${authDependentSyncables.length} syncable(s)`);

    // Initial sync after small delay
    const initialTimeout = setTimeout(() => {
      if (isMountedRef.current && isAuthenticated) {
        runSyncTasks(authDependentSyncables, 'AuthDependent');
      }
    }, 500);

    // Set up interval
    authDependentIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && isAuthenticated) {
        // Re-filter in case new syncables were registered
        const currentSyncables = syncablesRef.current.filter((s) => s.requiresAuth);
        runSyncTasks(currentSyncables, 'AuthDependent');
      }
    }, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      if (authDependentIntervalRef.current) {
        clearInterval(authDependentIntervalRef.current);
        authDependentIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, intervalMs, runSyncTasks]);

  // =============================================================================
  // Cleanup on unmount
  // =============================================================================

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // =============================================================================
  // Context Value
  // =============================================================================

  const contextValue: SyncContextValue = {
    isSyncing,
    isAuthSyncActive: isAuthenticated && authDependentIntervalRef.current !== null,
    isPaused,
    consecutiveFailures,
    lastError,
    registerSyncable,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

// =============================================================================
// API for module registration
// =============================================================================

/**
 * Creates a SyncProviderAPI object from the context.
 * Used by registerAllModules to pass to each module's registration function.
 */
export function createSyncProviderAPI(
  registerSyncable: (syncable: ISyncable) => void
): SyncProviderAPI {
  return {
    registerSyncable,
    getSyncStatus: () => ({
      isSyncing: false, // Will be updated by actual context
      isAuthSyncActive: false,
      isPaused: false,
      consecutiveFailures: 0,
      lastError: null,
    }),
  };
}

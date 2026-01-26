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
import { useFeedsStore } from '@/modules/feeds';
import {
  type ISyncable,
  type SyncProviderAPI,
  type SyncStatus,
  type SyncConfig,
  DEFAULT_SYNC_CONFIG,
} from './types';
import { registerAllModules } from './registerModules';
import { debugLog, debugError } from '@/lib/debug-logger';

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
      debugLog(`[SyncProvider] Registered syncable: ${syncable.name} (requiresAuth: ${syncable.requiresAuth})`);
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
          debugError(`[SyncProvider] ${loopName} - ${syncable.name} failed:`, errorMessage);

          setConsecutiveFailures((prev) => {
            const newCount = prev + 1;
            if (newCount >= maxConsecutiveFailures) {
              debugError(`[SyncProvider] Too many consecutive failures (${newCount}). Sync paused.`);
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
      debugLog('[SyncProvider] No always-running syncables registered yet');
      return;
    }

    debugLog(`[SyncProvider] Starting always-running loop with ${alwaysRunningSyncables.length} syncable(s)`);

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
        debugLog('[SyncProvider] Stopping auth-dependent loop (logged out)');
        clearInterval(authDependentIntervalRef.current);
        authDependentIntervalRef.current = null;
      }
      return;
    }

    const authDependentSyncables = syncablesRef.current.filter((s) => s.requiresAuth);

    if (authDependentSyncables.length === 0) {
      debugLog('[SyncProvider] No auth-dependent syncables registered yet');
      return;
    }

    debugLog(`[SyncProvider] Starting auth-dependent loop with ${authDependentSyncables.length} syncable(s)`);

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
  // FEAT-055: Best-effort cleanup on tab close
  // =============================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      // Get currently selected feed from app store
      const selectedFeedId = useAppStore.getState().selectedFeedId;

      if (selectedFeedId) {
        debugLog(`[SyncProvider] beforeunload: triggering cleanup for feedId=${selectedFeedId.substring(0, 8)}...`);
        // Best-effort cleanup - may not complete before tab closes
        // Do NOT return anything (would show confirmation dialog)
        useFeedsStore.getState().cleanupFeed(selectedFeedId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // =============================================================================
  // E2E Testing Support - Manual Sync Trigger
  // =============================================================================

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Expose sync trigger for E2E tests
    // This allows tests to manually trigger sync instead of waiting for interval
    (window as unknown as Record<string, unknown>).__e2e_triggerSync = async (): Promise<boolean> => {
      console.log('[E2E] Manual sync triggered');

      const alwaysSyncables = syncablesRef.current.filter((s) => !s.requiresAuth);
      const authSyncables = syncablesRef.current.filter((s) => s.requiresAuth);

      // Run always-running syncables
      if (alwaysSyncables.length > 0) {
        await runSyncTasks(alwaysSyncables, 'E2E-Manual');
      }

      // Run auth-dependent syncables if authenticated
      if (isAuthenticated && authSyncables.length > 0) {
        await runSyncTasks(authSyncables, 'E2E-Manual');
      }

      // Wait for React to process state updates and re-render
      // This prevents race conditions where the test checks the DOM before
      // React has finished rendering the new state
      // Multiple wait cycles ensure all microtasks and renders complete
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => {
          // requestAnimationFrame ensures we wait for the next paint
          requestAnimationFrame(() => {
            // setTimeout(0) pushes to the end of the macrotask queue
            setTimeout(resolve, 0);
          });
        });
      }

      // Additional wait for Virtuoso (react-virtuoso) to complete scroll animation
      // ChatView uses followOutput="smooth" which triggers animated scroll to new messages
      // Virtuoso only renders items that are in/near the viewport, so we need to wait
      // for the scroll animation to complete before the new message is visible
      await new Promise<void>((resolve) => setTimeout(resolve, 150));

      console.log('[E2E] Manual sync completed');
      return true;
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).__e2e_triggerSync;
    };
  }, [isAuthenticated, runSyncTasks]);

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

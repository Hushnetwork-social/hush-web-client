/**
 * App Store
 *
 * Central store for app-wide state that doesn't belong to specific modules.
 * Module-specific state is in their respective stores:
 * - useBlockchainStore (modules/blockchain)
 * - useFeedsStore (modules/feeds)
 * - useBankStore (modules/bank) - TODO
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Credentials, Balance } from '@/types';
import { debugLog, debugError } from '@/lib/debug-logger';

export type AppId = 'feeds' | 'social' | 'voting';

export interface AppContextState {
  selectedNav: string;
  selectedFeedId: string | null;
  scrollOffset: number;
}

export interface InnerCircleSyncState {
  status: 'idle' | 'syncing' | 'retrying' | 'error';
  message: string | null;
  attemptCount: number;
  nextRetryAt: number | null;
}

export const DEFAULT_ACTIVE_APP: AppId = 'feeds';
export const DEFAULT_APP_CONTEXTS: Record<AppId, AppContextState> = {
  feeds: {
    selectedNav: 'feeds',
    selectedFeedId: null,
    scrollOffset: 0,
  },
  social: {
    selectedNav: 'feed-wall',
    selectedFeedId: null,
    scrollOffset: 0,
  },
  voting: {
    selectedNav: 'open-voting',
    selectedFeedId: null,
    scrollOffset: 0,
  },
};
export const DEFAULT_CROSS_APP_BADGES: Record<AppId, number> = {
  feeds: 0,
  social: 0,
  voting: 0,
};
export const DEFAULT_INNER_CIRCLE_SYNC_STATE: InnerCircleSyncState = {
  status: 'idle',
  message: null,
  attemptCount: 0,
  nextRetryAt: null,
};

function normalizeAppContexts(
  appContexts?: Partial<Record<AppId, Partial<AppContextState>>>
): Record<AppId, AppContextState> {
  return {
    feeds: {
      ...DEFAULT_APP_CONTEXTS.feeds,
      ...(appContexts?.feeds ?? {}),
    },
    social: {
      ...DEFAULT_APP_CONTEXTS.social,
      ...(appContexts?.social ?? {}),
    },
    voting: {
      ...DEFAULT_APP_CONTEXTS.voting,
      ...(appContexts?.voting ?? {}),
    },
  };
}

function normalizeCrossAppBadges(
  crossAppBadges?: Partial<Record<AppId, number>>
): Record<AppId, number> {
  return {
    feeds: Math.max(0, crossAppBadges?.feeds ?? DEFAULT_CROSS_APP_BADGES.feeds),
    social: Math.max(0, crossAppBadges?.social ?? DEFAULT_CROSS_APP_BADGES.social),
    voting: Math.max(0, crossAppBadges?.voting ?? DEFAULT_CROSS_APP_BADGES.voting),
  };
}

interface AppStore {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: User | null;
  credentials: Credentials | null;

  // Bank state (TODO: Move to useBankStore in Step 4)
  balance: Balance;

  // UI state
  selectedFeedId: string | null;
  selectedNav: string;
  activeApp: AppId;
  appContexts: Record<AppId, AppContextState>;
  crossAppBadges: Record<AppId, number>;
  innerCircleSync: InnerCircleSyncState;
  innerCircleRetryNonce: number;

  // Auth actions
  setAuthenticated: (isAuth: boolean) => void;
  setLoading: (loading: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  setCredentials: (creds: Credentials | null) => void;
  logout: () => void;

  // Bank actions (TODO: Move to useBankStore in Step 4)
  setBalance: (balance: Balance) => void;

  // UI actions
  setActiveApp: (app: AppId) => void;
  selectFeed: (feedId: string | null) => void;
  setSelectedNav: (nav: string) => void;
  setAppContextNav: (app: AppId, nav: string) => void;
  setAppContextFeed: (app: AppId, feedId: string | null) => void;
  setAppContextScroll: (app: AppId, scrollOffset: number) => void;
  setCrossAppBadge: (app: AppId, count: number) => void;
  setInnerCircleSync: (state: Partial<InnerCircleSyncState>) => void;
  requestInnerCircleRetry: () => void;
}

// FEAT-059: Expose store to window for E2E test verification (same pattern as useFeedsStore)
const isE2EOrDev = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true';

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial state
      isAuthenticated: false,
      isLoading: false,
      currentUser: null,
      credentials: null,
      balance: { available: 0, pending: 0, currency: 'HUSH' },
      selectedFeedId: null,
      selectedNav: 'feeds',
      activeApp: DEFAULT_ACTIVE_APP,
      appContexts: normalizeAppContexts(),
      crossAppBadges: normalizeCrossAppBadges(),
      innerCircleSync: DEFAULT_INNER_CIRCLE_SYNC_STATE,
      innerCircleRetryNonce: 0,

      // Auth actions
      setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),
      setLoading: (loading) => set({ isLoading: loading }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setCredentials: (creds) => set({ credentials: creds }),
      logout: () => set({
        isAuthenticated: false,
        currentUser: null,
        credentials: null,
        selectedFeedId: null,
        selectedNav: 'feeds',
        activeApp: DEFAULT_ACTIVE_APP,
        appContexts: normalizeAppContexts(),
        crossAppBadges: normalizeCrossAppBadges(),
        innerCircleSync: DEFAULT_INNER_CIRCLE_SYNC_STATE,
        innerCircleRetryNonce: 0,
      }),

      // Bank actions
      setBalance: (balance) => set({ balance }),

      // UI actions
      setActiveApp: (app) => set((state) => {
        const appContexts = normalizeAppContexts(state.appContexts);
        const targetContext = appContexts[app];
        return {
          activeApp: app,
          selectedNav: targetContext.selectedNav,
          selectedFeedId: targetContext.selectedFeedId,
          appContexts,
          crossAppBadges: normalizeCrossAppBadges(state.crossAppBadges),
        };
      }),
      selectFeed: (feedId) => set((state) => {
        const appContexts = normalizeAppContexts(state.appContexts);
        return {
          selectedFeedId: feedId,
          appContexts: {
            ...appContexts,
            [state.activeApp]: {
              ...appContexts[state.activeApp],
              selectedFeedId: feedId,
            },
          },
        };
      }),
      setSelectedNav: (nav) => set((state) => {
        const appContexts = normalizeAppContexts(state.appContexts);
        return {
          selectedNav: nav,
          appContexts: {
            ...appContexts,
            [state.activeApp]: {
              ...appContexts[state.activeApp],
              selectedNav: nav,
            },
          },
        };
      }),
      setAppContextNav: (app, nav) => set((state) => {
        const appContexts = normalizeAppContexts(state.appContexts);
        return {
          appContexts: {
            ...appContexts,
            [app]: {
              ...appContexts[app],
              selectedNav: nav,
            },
          },
          ...(state.activeApp === app ? { selectedNav: nav } : {}),
        };
      }),
      setAppContextFeed: (app, feedId) => set((state) => {
        const appContexts = normalizeAppContexts(state.appContexts);
        return {
          appContexts: {
            ...appContexts,
            [app]: {
              ...appContexts[app],
              selectedFeedId: feedId,
            },
          },
          ...(state.activeApp === app ? { selectedFeedId: feedId } : {}),
        };
      }),
      setAppContextScroll: (app, scrollOffset) => set((state) => {
        const appContexts = normalizeAppContexts(state.appContexts);
        return {
          appContexts: {
            ...appContexts,
            [app]: {
              ...appContexts[app],
              scrollOffset,
            },
          },
        };
      }),
      setCrossAppBadge: (app, count) => set((state) => ({
        crossAppBadges: {
          ...normalizeCrossAppBadges(state.crossAppBadges),
          [app]: Math.max(0, count),
        },
      })),
      setInnerCircleSync: (innerCircleSyncState) => set((state) => {
        const nextInnerCircleSync = {
          ...state.innerCircleSync,
          ...innerCircleSyncState,
        };

        if (
          nextInnerCircleSync.status === state.innerCircleSync.status &&
          nextInnerCircleSync.message === state.innerCircleSync.message &&
          nextInnerCircleSync.attemptCount === state.innerCircleSync.attemptCount &&
          nextInnerCircleSync.nextRetryAt === state.innerCircleSync.nextRetryAt
        ) {
          return state;
        }

        return {
          innerCircleSync: nextInnerCircleSync,
        };
      }),
      requestInnerCircleRetry: () => set((state) => ({
        innerCircleRetryNonce: state.innerCircleRetryNonce + 1,
      })),
    }),
    {
      name: 'hush-app-storage',
      partialize: (state) => ({
        // Persist auth and shell context state.
        // Feeds/messages payloads remain in useFeedsStore.
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        credentials: state.credentials,
        selectedFeedId: state.selectedFeedId,
        selectedNav: state.selectedNav,
        activeApp: state.activeApp,
        appContexts: normalizeAppContexts(state.appContexts),
        crossAppBadges: normalizeCrossAppBadges(state.crossAppBadges),
      }),
      merge: (persistedState, currentState) => {
        const typedPersistedState = (persistedState ?? {}) as Partial<AppStore>;
        const activeApp = typedPersistedState.activeApp ?? currentState.activeApp;
        const appContexts = normalizeAppContexts(typedPersistedState.appContexts);
        const activeContext = appContexts[activeApp];

        return {
          ...currentState,
          ...typedPersistedState,
          activeApp,
          appContexts,
          crossAppBadges: normalizeCrossAppBadges(typedPersistedState.crossAppBadges),
          selectedNav: activeContext.selectedNav,
          selectedFeedId: activeContext.selectedFeedId,
        };
      },
      // Handle corrupt localStorage gracefully
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          debugError('[AppStore] Failed to rehydrate storage:', error);
          // Clear corrupt data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('hush-app-storage');
          }
          return;
        }

        // Log rehydration details
        if (state) {
          const activeApp = state.activeApp ?? DEFAULT_ACTIVE_APP;
          const appContexts = normalizeAppContexts(state.appContexts);
          state.appContexts = appContexts;
          state.crossAppBadges = normalizeCrossAppBadges(state.crossAppBadges);
          state.selectedNav = appContexts[activeApp].selectedNav;
          state.selectedFeedId = appContexts[activeApp].selectedFeedId;

          if (state.isAuthenticated && state.credentials) {
            debugLog('[AppStore] Credentials loaded from localStorage:');
            debugLog(`  - User: ${state.currentUser?.displayName || 'Unknown'}`);
            debugLog('  - Signing key available');
            debugLog(`  - EncryptKey: ${state.credentials.encryptionPublicKey?.substring(0, 20)}...`);
            debugLog(`  - Has mnemonic: ${!!state.credentials.mnemonic}`);
          } else {
            debugLog('[AppStore] No credentials found in localStorage');
          }
        }
      },
    }
  )
);

if (typeof window !== 'undefined' && isE2EOrDev) {
  (window as unknown as { __zustand_stores?: Record<string, unknown> }).__zustand_stores = {
    ...((window as unknown as { __zustand_stores?: Record<string, unknown> }).__zustand_stores || {}),
    appStore: useAppStore,
  };
}

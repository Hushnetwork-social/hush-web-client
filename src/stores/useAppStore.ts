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

  // Auth actions
  setAuthenticated: (isAuth: boolean) => void;
  setLoading: (loading: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  setCredentials: (creds: Credentials | null) => void;
  logout: () => void;

  // Bank actions (TODO: Move to useBankStore in Step 4)
  setBalance: (balance: Balance) => void;

  // UI actions
  selectFeed: (feedId: string | null) => void;
  setSelectedNav: (nav: string) => void;
}

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
      }),

      // Bank actions
      setBalance: (balance) => set({ balance }),

      // UI actions
      selectFeed: (feedId) => set({ selectedFeedId: feedId }),
      setSelectedNav: (nav) => set({ selectedNav: nav }),
    }),
    {
      name: 'hush-app-storage',
      partialize: (state) => ({
        // Persist auth data only
        // Feeds/messages are persisted in useFeedsStore
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        credentials: state.credentials,
      }),
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
          if (state.isAuthenticated && state.credentials) {
            debugLog('[AppStore] Credentials loaded from localStorage:');
            debugLog(`  - User: ${state.currentUser?.displayName || 'Unknown'}`);
            debugLog(`  - SigningKey: ${state.credentials.signingPublicKey?.substring(0, 20)}...`);
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

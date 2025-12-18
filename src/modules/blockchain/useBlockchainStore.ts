/**
 * Blockchain Module Store
 *
 * Zustand store for blockchain-related state.
 * UI components subscribe to this store for reactive updates.
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import { create } from 'zustand';

interface BlockchainState {
  /** Current blockchain height (block index) */
  blockHeight: number;

  /** Whether we're connected to the blockchain node */
  isConnected: boolean;

  /** Last sync error, if any */
  lastError: string | null;

  /** Timestamp of last successful sync */
  lastSyncTime: Date | null;
}

interface BlockchainActions {
  /** Update the block height */
  setBlockHeight: (height: number) => void;

  /** Update connection status */
  setConnected: (connected: boolean) => void;

  /** Set an error state */
  setError: (error: string | null) => void;

  /** Reset store to initial state */
  reset: () => void;
}

type BlockchainStore = BlockchainState & BlockchainActions;

const initialState: BlockchainState = {
  blockHeight: 0,
  isConnected: false,
  lastError: null,
  lastSyncTime: null,
};

export const useBlockchainStore = create<BlockchainStore>((set) => ({
  ...initialState,

  setBlockHeight: (height) =>
    set({
      blockHeight: height,
      isConnected: true,
      lastError: null,
      lastSyncTime: new Date(),
    }),

  setConnected: (connected) =>
    set({ isConnected: connected }),

  setError: (error) =>
    set({
      lastError: error,
      isConnected: error === null,
    }),

  reset: () => set(initialState),
}));

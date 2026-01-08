/**
 * Update Store
 *
 * Manages app update state for Tauri desktop.
 * Only active when running in Tauri context.
 */

import { create } from 'zustand';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;  // Release notes
  date?: string;
}

interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

interface UpdateStore {
  // State
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  showOverlay: boolean;

  // Actions
  setStatus: (status: UpdateStatus) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setProgress: (progress: UpdateProgress | null) => void;
  setError: (error: string | null) => void;
  setShowOverlay: (show: boolean) => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  // Initial state
  status: 'idle',
  updateInfo: null,
  progress: null,
  error: null,
  showOverlay: false,

  // Actions
  setStatus: (status) => set({ status }),
  setUpdateInfo: (updateInfo) => set({ updateInfo }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setShowOverlay: (showOverlay) => set({ showOverlay }),
  reset: () =>
    set({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null,
      showOverlay: false,
    }),
}));

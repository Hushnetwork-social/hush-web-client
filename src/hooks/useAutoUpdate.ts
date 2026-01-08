/**
 * useAutoUpdate Hook
 *
 * Checks for app updates on startup when running in Tauri.
 * Shows overlay when update is available and handles installation.
 *
 * Uses dynamic imports to avoid bundling Tauri code in web builds.
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { isTauri } from '@/lib/platform';
import { debugLog, debugError } from '@/lib/debug-logger';

// Delay before checking for updates (ms)
const UPDATE_CHECK_DELAY = 3000;

export function useAutoUpdate(): void {
  const {
    setStatus,
    setUpdateInfo,
    setProgress,
    setError,
    setShowOverlay,
    reset,
  } = useUpdateStore();

  // Store the update object for later download
  const updateRef = useRef<unknown>(null);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      debugLog('[AutoUpdate] Not in Tauri context, skipping update check');
      return;
    }

    try {
      setStatus('checking');
      debugLog('[AutoUpdate] Checking for updates...');

      // Dynamic import to avoid bundling in web builds
      const { check } = await import('@tauri-apps/plugin-updater');
      const { getVersion } = await import('@tauri-apps/api/app');

      const currentVersion = await getVersion();
      debugLog('[AutoUpdate] Current version:', currentVersion);

      const update = await check();

      if (update) {
        debugLog(`[AutoUpdate] Update available: ${update.version}`);
        updateRef.current = update;
        setUpdateInfo({
          version: update.version,
          currentVersion,
          body: update.body ?? undefined,
          date: update.date ?? undefined,
        });
        setStatus('available');
        setShowOverlay(true);
      } else {
        debugLog('[AutoUpdate] No update available');
        setStatus('idle');
      }
    } catch (error) {
      debugError('[AutoUpdate] Failed to check for updates:', error);
      setError(error instanceof Error ? error.message : 'Update check failed');
      setStatus('error');
    }
  }, [setStatus, setUpdateInfo, setError, setShowOverlay]);

  // Download and install update
  const downloadAndInstall = useCallback(async () => {
    if (!isTauri()) return;

    try {
      setStatus('downloading');
      setProgress({ downloaded: 0, total: null });
      debugLog('[AutoUpdate] Downloading update...');

      const { relaunch } = await import('@tauri-apps/plugin-process');

      // Use the stored update reference
      const update = updateRef.current as {
        downloadAndInstall: (cb: (event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void>;
      } | null;

      if (!update) {
        // Re-check if we lost the reference
        const { check } = await import('@tauri-apps/plugin-updater');
        const freshUpdate = await check();
        if (!freshUpdate) {
          setError('Update no longer available');
          setStatus('error');
          return;
        }
        updateRef.current = freshUpdate;
      }

      const updateToInstall = updateRef.current as {
        downloadAndInstall: (cb: (event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void>;
      };

      let totalBytes = 0;
      let downloadedBytes = 0;

      // Download with progress tracking
      await updateToInstall.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength ?? 0;
            debugLog(`[AutoUpdate] Download started: ${totalBytes} bytes`);
            setProgress({
              downloaded: 0,
              total: totalBytes || null,
            });
            break;
          case 'Progress':
            downloadedBytes += event.data.chunkLength ?? 0;
            setProgress({
              downloaded: downloadedBytes,
              total: totalBytes || null,
            });
            break;
          case 'Finished':
            debugLog('[AutoUpdate] Download finished');
            setStatus('ready');
            break;
        }
      });

      debugLog('[AutoUpdate] Installing and relaunching...');
      await relaunch();
    } catch (error) {
      debugError('[AutoUpdate] Failed to download/install update:', error);
      setError(error instanceof Error ? error.message : 'Update failed');
      setStatus('error');
    }
  }, [setStatus, setProgress, setError]);

  // Dismiss the overlay
  const dismiss = useCallback(() => {
    setShowOverlay(false);
    reset();
  }, [setShowOverlay, reset]);

  // Check for updates on mount (with delay)
  useEffect(() => {
    if (!isTauri()) return;

    const timer = setTimeout(() => {
      checkForUpdates();
    }, UPDATE_CHECK_DELAY);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Expose functions globally for the overlay to use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { __hushUpdateActions?: { downloadAndInstall: () => void; dismiss: () => void } }).__hushUpdateActions = {
        downloadAndInstall,
        dismiss,
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { __hushUpdateActions?: unknown }).__hushUpdateActions;
      }
    };
  }, [downloadAndInstall, dismiss]);
}

/**
 * Trigger update download from overlay component
 */
export function triggerUpdateDownload(): void {
  const win = window as Window & { __hushUpdateActions?: { downloadAndInstall: () => void } };
  if (win.__hushUpdateActions?.downloadAndInstall) {
    win.__hushUpdateActions.downloadAndInstall();
  }
}

/**
 * Dismiss update overlay
 */
export function dismissUpdateOverlay(): void {
  const win = window as Window & { __hushUpdateActions?: { dismiss: () => void } };
  if (win.__hushUpdateActions?.dismiss) {
    win.__hushUpdateActions.dismiss();
  }
}

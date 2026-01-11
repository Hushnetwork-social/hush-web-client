/**
 * useAutoUpdate Hook
 *
 * Checks for app updates on startup when running in Tauri (Desktop or Android).
 * Uses releases.json from downloads.hushnetwork.social to check for new versions.
 * Shows overlay when update is available with download link.
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { isTauri, detectPlatformAsync, Platform } from '@/lib/platform';
import { debugLog, debugError } from '@/lib/debug-logger';

// Delay before checking for updates (ms)
const UPDATE_CHECK_DELAY = 3000;

// Releases JSON endpoint
const RELEASES_JSON_URL = 'https://downloads.hushnetwork.social/releases.json';

// Downloads page fallback
const DOWNLOADS_PAGE = 'https://downloads.hushnetwork.social';

interface PlatformRelease {
  version: string;
  filename: string;
  url: string;
  size: string;
  sha256: string;
}

interface ReleasesJson {
  lastUpdated: string;
  windows?: PlatformRelease;
  android?: PlatformRelease;
}

/**
 * Compare two semver version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  // Remove 'v' or 'V' prefix if present
  const clean1 = v1.replace(/^[vV]/, '');
  const clean2 = v2.replace(/^[vV]/, '');

  const parts1 = clean1.split('.').map(Number);
  const parts2 = clean2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Get the release info for the current platform
 */
function getReleaseForPlatform(releases: ReleasesJson, platform: Platform): PlatformRelease | null {
  if (platform === 'tauri-android') {
    return releases.android || null;
  }
  // Desktop (Windows, macOS, Linux) - currently only Windows
  if (platform === 'tauri') {
    return releases.windows || null;
  }
  return null;
}

/**
 * Get current app version
 */
async function getCurrentVersion(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    // Fallback to env variable
    const envVersion = process.env.NEXT_PUBLIC_APP_VERSION;
    if (envVersion) {
      return envVersion.replace(/^[vV]/, '');
    }
    return '0.0.0';
  }
}

// Store download URL globally for the overlay
let currentDownloadUrl: string | null = null;

export function useAutoUpdate(): void {
  const {
    setStatus,
    setUpdateInfo,
    setShowOverlay,
    reset,
  } = useUpdateStore();

  const hasChecked = useRef(false);

  // Check for updates via releases.json
  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      debugLog('[AutoUpdate] Not in Tauri context, skipping update check');
      return;
    }

    // Only check once per app session
    if (hasChecked.current) {
      debugLog('[AutoUpdate] Already checked this session');
      return;
    }

    try {
      setStatus('checking');
      debugLog('[AutoUpdate] Checking for updates via releases.json...');

      // Detect platform
      const platform = await detectPlatformAsync();
      debugLog('[AutoUpdate] Platform:', platform);

      // Get current version
      const currentVersion = await getCurrentVersion();
      debugLog('[AutoUpdate] Current version:', currentVersion);

      // Fetch releases.json
      const response = await fetch(RELEASES_JSON_URL, {
        cache: 'no-store', // Always fetch fresh
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch releases.json: ${response.status}`);
      }

      const releases: ReleasesJson = await response.json();
      debugLog('[AutoUpdate] Releases:', releases);

      // Get release for current platform
      const platformRelease = getReleaseForPlatform(releases, platform);
      if (!platformRelease) {
        debugLog('[AutoUpdate] No release found for platform:', platform);
        setStatus('idle');
        hasChecked.current = true;
        return;
      }

      const latestVersion = platformRelease.version;
      debugLog('[AutoUpdate] Latest version for platform:', latestVersion);

      // Compare versions
      if (compareVersions(latestVersion, currentVersion) > 0) {
        debugLog(`[AutoUpdate] Update available: ${currentVersion} -> ${latestVersion}`);

        // Store download URL for the overlay
        currentDownloadUrl = platformRelease.url;

        setUpdateInfo({
          version: latestVersion,
          currentVersion,
          body: `Download size: ${platformRelease.size}`,
          date: releases.lastUpdated,
        });
        setStatus('available');
        setShowOverlay(true);
      } else {
        debugLog('[AutoUpdate] Already on latest version');
        setStatus('idle');
      }

      hasChecked.current = true;
    } catch (error) {
      debugError('[AutoUpdate] Failed to check for updates:', error);
      // Don't show error to user - just silently fail
      setStatus('idle');
      hasChecked.current = true;
    }
  }, [setStatus, setUpdateInfo, setShowOverlay]);

  // Open download URL
  const openDownloadPage = useCallback(async () => {
    const url = currentDownloadUrl || DOWNLOADS_PAGE;
    debugLog('[AutoUpdate] Opening download URL:', url);

    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } catch (error) {
        debugError('[AutoUpdate] Failed to open with Tauri shell:', error);
        // Fallback: try window.open
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  }, []);

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
      (window as Window & { __hushUpdateActions?: { openDownloadPage: () => void; dismiss: () => void } }).__hushUpdateActions = {
        openDownloadPage,
        dismiss,
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { __hushUpdateActions?: unknown }).__hushUpdateActions;
      }
    };
  }, [openDownloadPage, dismiss]);
}

/**
 * Open download page from overlay component
 */
export function triggerUpdateDownload(): void {
  const win = window as Window & { __hushUpdateActions?: { openDownloadPage: () => void } };
  if (win.__hushUpdateActions?.openDownloadPage) {
    win.__hushUpdateActions.openDownloadPage();
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

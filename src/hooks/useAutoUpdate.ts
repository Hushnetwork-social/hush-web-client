/**
 * useAutoUpdate Hook
 *
 * Checks for app updates on startup when running in Tauri.
 * Uses GitHub API to check for new releases and shows overlay when available.
 * User can click to open the download page in their browser.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { isTauri } from '@/lib/platform';
import { debugLog, debugError } from '@/lib/debug-logger';

// Delay before checking for updates (ms)
const UPDATE_CHECK_DELAY = 3000;

// GitHub API endpoint for latest release
const GITHUB_RELEASES_API =
  'https://api.github.com/repos/aboimpinto/HushNetwork/releases/latest';

// GitHub releases page URL
const GITHUB_RELEASES_PAGE =
  'https://github.com/aboimpinto/HushNetwork/releases/latest';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

/**
 * Compare two semver version strings
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Extract version from tag name (e.g., "TauriDesktop-v0.2.5" -> "0.2.5")
 */
function extractVersion(tagName: string): string | null {
  const match = tagName.match(/TauriDesktop-v(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

export function useAutoUpdate(): void {
  const {
    setStatus,
    setUpdateInfo,
    setError,
    setShowOverlay,
    reset,
  } = useUpdateStore();

  // Check for updates via GitHub API
  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      debugLog('[AutoUpdate] Not in Tauri context, skipping update check');
      return;
    }

    try {
      setStatus('checking');
      debugLog('[AutoUpdate] Checking for updates via GitHub API...');

      // Get current version from Tauri
      const { getVersion } = await import('@tauri-apps/api/app');
      const currentVersion = await getVersion();
      debugLog('[AutoUpdate] Current version:', currentVersion);

      // Fetch latest release from GitHub
      const response = await fetch(GITHUB_RELEASES_API, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release: GitHubRelease = await response.json();
      debugLog('[AutoUpdate] Latest release:', release.tag_name);

      // Extract version from tag
      const latestVersion = extractVersion(release.tag_name);
      if (!latestVersion) {
        debugLog('[AutoUpdate] Could not parse version from tag:', release.tag_name);
        setStatus('idle');
        return;
      }

      // Compare versions
      if (compareVersions(latestVersion, currentVersion) > 0) {
        debugLog(`[AutoUpdate] Update available: ${currentVersion} -> ${latestVersion}`);
        setUpdateInfo({
          version: latestVersion,
          currentVersion,
          body: release.body || undefined,
          date: release.published_at || undefined,
        });
        setStatus('available');
        setShowOverlay(true);
      } else {
        debugLog('[AutoUpdate] Already on latest version');
        setStatus('idle');
      }
    } catch (error) {
      debugError('[AutoUpdate] Failed to check for updates:', error);
      // Don't show error to user - just silently fail
      setStatus('idle');
    }
  }, [setStatus, setUpdateInfo, setError, setShowOverlay]);

  // Open download page in browser
  const openDownloadPage = useCallback(async () => {
    if (!isTauri()) return;

    try {
      debugLog('[AutoUpdate] Opening download page...');
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(GITHUB_RELEASES_PAGE);
    } catch (error) {
      // Fallback: try window.open
      debugError('[AutoUpdate] Failed to open with Tauri shell, trying window.open:', error);
      window.open(GITHUB_RELEASES_PAGE, '_blank');
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

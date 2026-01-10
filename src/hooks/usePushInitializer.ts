/**
 * Push Initializer Hook
 *
 * Initializes push notifications when the user becomes authenticated.
 * Only runs on mobile platforms (Tauri Android/iOS).
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores';
import { initializePush, cleanupPush, isPushSupported } from '@/lib/push';
import { detectPlatformAsync } from '@/lib/platform';
import { debugLog, debugError } from '@/lib/debug-logger';

export function usePushInitializer(): void {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const credentials = useAppStore((state) => state.credentials);
  const initializingRef = useRef(false);

  useEffect(() => {
    // Skip if not authenticated or no credentials
    if (!isAuthenticated || !credentials?.signingPublicKey) {
      return;
    }

    // Prevent concurrent initialization
    if (initializingRef.current) {
      return;
    }

    const initPush = async () => {
      try {
        // Check if push is supported on this platform
        const supported = await isPushSupported();
        if (!supported) {
          const platform = await detectPlatformAsync();
          debugLog(`[PushInitializer] Push not supported on ${platform}, skipping`);
          return;
        }

        initializingRef.current = true;
        debugLog('[PushInitializer] User authenticated, initializing push notifications');

        const success = await initializePush(credentials.signingPublicKey);

        if (success) {
          debugLog('[PushInitializer] Push notifications initialized successfully');
        } else {
          debugLog('[PushInitializer] Push initialization failed (non-blocking)');
        }
      } catch (error) {
        debugError('[PushInitializer] Error during push initialization:', error);
      } finally {
        initializingRef.current = false;
      }
    };

    initPush();

    // Cleanup on unmount or when user logs out
    return () => {
      if (!isAuthenticated) {
        debugLog('[PushInitializer] User logged out, cleaning up push state');
        cleanupPush();
      }
    };
  }, [isAuthenticated, credentials?.signingPublicKey]);
}

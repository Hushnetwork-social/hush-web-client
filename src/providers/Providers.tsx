'use client';

import { type ReactNode } from 'react';
import { SyncProvider } from '@/lib/sync';
import { useUnreadBadge, useAutoUpdate } from '@/hooks';
import { UpdateOverlay } from '@/components/updates';

// Sync interval in milliseconds (configurable via environment variable)
// Default: 3000ms (3 seconds) - matches blockchain block time
const SYNC_INTERVAL_MS = parseInt(
  process.env.NEXT_PUBLIC_SYNC_INTERVAL_MS || '3000',
  10
);

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Component that initializes the unread badge hook.
 * This must be rendered inside SyncProvider since it depends on feed data.
 */
function UnreadBadgeInitializer(): null {
  useUnreadBadge();
  return null;
}

/**
 * Component that initializes the auto-update check (Tauri desktop only).
 * Checks for updates on app startup and shows overlay when available.
 */
function AutoUpdateInitializer(): null {
  useAutoUpdate();
  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SyncProvider config={{ intervalMs: SYNC_INTERVAL_MS }}>
      <UnreadBadgeInitializer />
      <AutoUpdateInitializer />
      {children}
      <UpdateOverlay />
    </SyncProvider>
  );
}

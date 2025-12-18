'use client';

import { type ReactNode } from 'react';
import { SyncProvider } from '@/lib/sync';

// Sync interval in milliseconds (configurable via environment variable)
// Default: 3000ms (3 seconds) - matches blockchain block time
const SYNC_INTERVAL_MS = parseInt(
  process.env.NEXT_PUBLIC_SYNC_INTERVAL_MS || '3000',
  10
);

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SyncProvider config={{ intervalMs: SYNC_INTERVAL_MS }}>
      {children}
    </SyncProvider>
  );
}

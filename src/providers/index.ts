// Main providers wrapper
export { Providers } from './Providers';

// Re-export sync infrastructure
export { SyncProvider, useSyncContext } from '@/lib/sync';

// Re-export module stores for convenience
export { useBlockchainStore } from '@/modules/blockchain';
export { useFeedsStore } from '@/modules/feeds';

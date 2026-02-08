import type { RetryConfig } from './types';

/**
 * FEAT-058: Default configuration for message retry
 * - Fixed 10 second interval
 * - Maximum 3 attempts
 * - No exponential backoff
 */
export const MESSAGE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  intervalMs: 10_000, // 10 seconds
  backoffType: 'fixed',
};

/**
 * EPIC-005 (future): Configuration for fetch retry
 * Can be customized when EPIC-005 is implemented
 */
export const FETCH_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  intervalMs: 5_000, // 5 seconds
  backoffType: 'exponential',
  backoffMultiplier: 2,
};

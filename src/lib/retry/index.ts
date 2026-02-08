/**
 * FEAT-058: Retry Utilities
 *
 * Reusable retry system for:
 * - FEAT-058: Client Unconfirmed Message Retry
 * - EPIC-005: Notification System Improvements (future)
 *
 * @example
 * ```typescript
 * import { shouldRetry, recordAttempt, MESSAGE_RETRY_CONFIG } from '@/lib/retry';
 *
 * const state = { attemptCount: 1, lastAttemptTime: Date.now() - 15000, status: 'pending' };
 * const result = shouldRetry(state, MESSAGE_RETRY_CONFIG);
 *
 * if (result.shouldRetry) {
 *   const newState = recordAttempt(state);
 *   // Perform retry operation
 * }
 * ```
 */

// Types
export type { RetryConfig, RetryState, RetryCheckResult } from './types';

// Configuration
export { MESSAGE_RETRY_CONFIG, FETCH_RETRY_CONFIG } from './config';

// Utilities
export {
  shouldRetry,
  recordAttempt,
  createRetryState,
  resetRetryState,
  markFailed,
  getTimeUntilNextRetry,
  isMaxAttemptsReached,
} from './utils';

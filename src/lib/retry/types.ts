/**
 * FEAT-058: Retry system types
 * Designed for reuse in EPIC-005 (Notification System)
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (including initial attempt) */
  maxAttempts: number;
  /** Time in milliseconds between retry attempts */
  intervalMs: number;
  /** Type of backoff strategy */
  backoffType: 'fixed' | 'exponential';
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
}

/**
 * Current state of a retry operation
 */
export interface RetryState {
  /** Number of attempts made so far (0 = not yet attempted) */
  attemptCount: number;
  /** Unix timestamp of the last attempt (0 = never attempted) */
  lastAttemptTime: number;
  /** Current status of the retry operation */
  status: 'idle' | 'pending' | 'retrying' | 'failed';
}

/**
 * Result of a retry check
 */
export interface RetryCheckResult {
  /** Whether a retry should be attempted now */
  shouldRetry: boolean;
  /** Time until next retry is due (0 if immediate, negative if overdue) */
  timeUntilRetry: number;
  /** Reason why retry was denied (if shouldRetry is false) */
  reason?: 'max_attempts_reached' | 'too_soon' | 'already_failed' | 'idle';
}

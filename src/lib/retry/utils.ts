import type { RetryConfig, RetryState, RetryCheckResult } from './types';

/**
 * Check if a retry should be attempted now
 *
 * @param state Current retry state
 * @param config Retry configuration
 * @param currentTime Optional current time for testing (default: Date.now())
 * @returns RetryCheckResult with shouldRetry flag and timing info
 */
export function shouldRetry(
  state: RetryState,
  config: RetryConfig,
  currentTime: number = Date.now()
): RetryCheckResult {
  // Never retry if already failed
  if (state.status === 'failed') {
    return {
      shouldRetry: false,
      timeUntilRetry: Infinity,
      reason: 'already_failed',
    };
  }

  // Never retry if idle (not started)
  if (state.status === 'idle') {
    return {
      shouldRetry: false,
      timeUntilRetry: 0,
      reason: 'idle',
    };
  }

  // Check max attempts
  if (state.attemptCount >= config.maxAttempts) {
    return {
      shouldRetry: false,
      timeUntilRetry: Infinity,
      reason: 'max_attempts_reached',
    };
  }

  // Calculate interval based on backoff type
  const interval = calculateInterval(state.attemptCount, config);
  const nextRetryTime = state.lastAttemptTime + interval;
  const timeUntilRetry = nextRetryTime - currentTime;

  if (timeUntilRetry > 0) {
    return {
      shouldRetry: false,
      timeUntilRetry,
      reason: 'too_soon',
    };
  }

  return {
    shouldRetry: true,
    timeUntilRetry: 0,
  };
}

/**
 * Calculate interval for the current attempt based on backoff strategy
 */
function calculateInterval(attemptCount: number, config: RetryConfig): number {
  if (config.backoffType === 'fixed') {
    return config.intervalMs;
  }

  // Exponential backoff: interval * multiplier^(attemptCount - 1)
  const multiplier = config.backoffMultiplier ?? 2;
  return config.intervalMs * Math.pow(multiplier, Math.max(0, attemptCount - 1));
}

/**
 * Record a retry attempt and return updated state
 *
 * @param state Current retry state
 * @param currentTime Optional current time for testing
 * @returns Updated retry state
 */
export function recordAttempt(
  state: RetryState,
  currentTime: number = Date.now()
): RetryState {
  return {
    ...state,
    attemptCount: state.attemptCount + 1,
    lastAttemptTime: currentTime,
    status: 'retrying',
  };
}

/**
 * Create a fresh retry state (for new operations or manual retry)
 *
 * @returns Initial retry state with status 'pending'
 */
export function createRetryState(): RetryState {
  return {
    attemptCount: 0,
    lastAttemptTime: 0,
    status: 'pending',
  };
}

/**
 * Reset retry state (for manual retry by user)
 * Resets attemptCount but keeps status as 'pending'
 *
 * @returns Reset retry state
 */
export function resetRetryState(): RetryState {
  return {
    attemptCount: 0,
    lastAttemptTime: 0,
    status: 'pending',
  };
}

/**
 * Mark retry as failed (max attempts reached or explicit failure)
 *
 * @param state Current retry state
 * @returns State with status 'failed'
 */
export function markFailed(state: RetryState): RetryState {
  return {
    ...state,
    status: 'failed',
  };
}

/**
 * Get the time until next retry is due
 *
 * @param state Current retry state
 * @param config Retry configuration
 * @param currentTime Optional current time for testing
 * @returns Milliseconds until next retry (0 if due, Infinity if no more retries)
 */
export function getTimeUntilNextRetry(
  state: RetryState,
  config: RetryConfig,
  currentTime: number = Date.now()
): number {
  const result = shouldRetry(state, config, currentTime);
  return result.timeUntilRetry;
}

/**
 * Check if max attempts have been reached
 *
 * @param state Current retry state
 * @param config Retry configuration
 * @returns True if no more retries are allowed
 */
export function isMaxAttemptsReached(
  state: RetryState,
  config: RetryConfig
): boolean {
  return state.attemptCount >= config.maxAttempts;
}

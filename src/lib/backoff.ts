/**
 * Exponential backoff utility for stream reconnection.
 *
 * Pure function - no side effects. Used by useNotifications.ts
 * to calculate reconnection delays with conservative backoff.
 */

export interface BackoffConfig {
  /** Initial delay in milliseconds (first reconnection attempt) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (cap) */
  maxDelayMs: number;
  /** Multiplier for exponential growth (e.g., 2 = doubling) */
  multiplier: number;
}

/**
 * Default backoff configuration for gRPC notification stream reconnection.
 *
 * Progression: 5s -> 10s -> 20s -> 30s -> 30s (capped)
 *
 * Conservative because the 3-second FeedsSyncable loop already covers
 * message delivery during stream disconnection. Aggressive reconnection
 * adds no user value and wastes server resources.
 */
export const STREAM_RECONNECT_CONFIG: BackoffConfig = {
  initialDelayMs: 5000,
  maxDelayMs: 30000,
  multiplier: 2,
};

/**
 * Calculate the next reconnection delay based on attempt count.
 *
 * Formula: Math.min(initialDelayMs * multiplier^attemptCount, maxDelayMs)
 *
 * @param attemptCount - Number of consecutive failed attempts (0-based)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds, clamped to [0, maxDelayMs]
 */
export function getNextDelay(attemptCount: number, config: BackoffConfig = STREAM_RECONNECT_CONFIG): number {
  const safeAttempt = Math.max(0, attemptCount);
  const delay = config.initialDelayMs * Math.pow(config.multiplier, safeAttempt);

  // Guard against Infinity/NaN from very large exponents
  if (!Number.isFinite(delay) || delay > config.maxDelayMs) {
    return config.maxDelayMs;
  }

  return Math.max(0, delay);
}

/**
 * FEAT-058: Retry Utilities Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  shouldRetry,
  recordAttempt,
  createRetryState,
  resetRetryState,
  markFailed,
  getTimeUntilNextRetry,
  isMaxAttemptsReached,
  MESSAGE_RETRY_CONFIG,
} from './index';

describe('FEAT-058: Retry Utilities', () => {
  describe('shouldRetry', () => {
    const config = MESSAGE_RETRY_CONFIG; // 3 attempts, 10s interval, fixed
    const now = 1700000000000; // Fixed timestamp for testing

    it('should return false for idle status', () => {
      const state = { attemptCount: 0, lastAttemptTime: 0, status: 'idle' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('idle');
    });

    it('should return false for failed status', () => {
      const state = { attemptCount: 2, lastAttemptTime: now - 15000, status: 'failed' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('already_failed');
    });

    it('should return false if max attempts reached', () => {
      const state = { attemptCount: 3, lastAttemptTime: now - 15000, status: 'pending' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('max_attempts_reached');
    });

    it('should return false if too soon since last attempt', () => {
      const state = { attemptCount: 1, lastAttemptTime: now - 5000, status: 'pending' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toBe('too_soon');
      expect(result.timeUntilRetry).toBe(5000); // 10s - 5s = 5s remaining
    });

    it('should return true if interval elapsed and attempts remaining', () => {
      const state = { attemptCount: 1, lastAttemptTime: now - 15000, status: 'pending' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(true);
      expect(result.timeUntilRetry).toBe(0);
    });

    it('should return true for first attempt with pending status and 0 lastAttemptTime', () => {
      const state = { attemptCount: 0, lastAttemptTime: 0, status: 'pending' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(true);
      expect(result.timeUntilRetry).toBe(0);
    });

    it('should handle exponential backoff correctly', () => {
      const exponentialConfig = { maxAttempts: 5, intervalMs: 1000, backoffType: 'exponential' as const };

      // After 1st attempt, wait 1000ms (1000 * 2^0)
      let state = { attemptCount: 1, lastAttemptTime: now - 500, status: 'pending' as const };
      let result = shouldRetry(state, exponentialConfig, now);
      expect(result.timeUntilRetry).toBe(500);

      // After 2nd attempt, wait 2000ms (1000 * 2^1)
      state = { attemptCount: 2, lastAttemptTime: now - 1000, status: 'pending' as const };
      result = shouldRetry(state, exponentialConfig, now);
      expect(result.timeUntilRetry).toBe(1000);

      // After 3rd attempt, wait 4000ms (1000 * 2^2)
      state = { attemptCount: 3, lastAttemptTime: now - 2000, status: 'pending' as const };
      result = shouldRetry(state, exponentialConfig, now);
      expect(result.timeUntilRetry).toBe(2000);
    });

    it('should handle retrying status the same as pending', () => {
      const state = { attemptCount: 1, lastAttemptTime: now - 15000, status: 'retrying' as const };
      const result = shouldRetry(state, config, now);
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe('recordAttempt', () => {
    it('should increment attemptCount', () => {
      const state = { attemptCount: 1, lastAttemptTime: 0, status: 'pending' as const };
      const result = recordAttempt(state, 1000);
      expect(result.attemptCount).toBe(2);
    });

    it('should update lastAttemptTime', () => {
      const state = { attemptCount: 0, lastAttemptTime: 0, status: 'pending' as const };
      const result = recordAttempt(state, 5000);
      expect(result.lastAttemptTime).toBe(5000);
    });

    it('should set status to retrying', () => {
      const state = { attemptCount: 0, lastAttemptTime: 0, status: 'pending' as const };
      const result = recordAttempt(state);
      expect(result.status).toBe('retrying');
    });

    it('should not mutate original state', () => {
      const state = { attemptCount: 1, lastAttemptTime: 0, status: 'pending' as const };
      const result = recordAttempt(state, 1000);
      expect(state.attemptCount).toBe(1);
      expect(result.attemptCount).toBe(2);
    });
  });

  describe('createRetryState', () => {
    it('should create initial state with pending status', () => {
      const state = createRetryState();
      expect(state.attemptCount).toBe(0);
      expect(state.lastAttemptTime).toBe(0);
      expect(state.status).toBe('pending');
    });
  });

  describe('resetRetryState', () => {
    it('should reset to initial state', () => {
      const state = resetRetryState();
      expect(state.attemptCount).toBe(0);
      expect(state.lastAttemptTime).toBe(0);
      expect(state.status).toBe('pending');
    });
  });

  describe('markFailed', () => {
    it('should set status to failed', () => {
      const state = { attemptCount: 3, lastAttemptTime: 1000, status: 'retrying' as const };
      const result = markFailed(state);
      expect(result.status).toBe('failed');
      expect(result.attemptCount).toBe(3); // Preserved
      expect(result.lastAttemptTime).toBe(1000); // Preserved
    });

    it('should not mutate original state', () => {
      const state = { attemptCount: 3, lastAttemptTime: 1000, status: 'retrying' as const };
      const result = markFailed(state);
      expect(state.status).toBe('retrying');
      expect(result.status).toBe('failed');
    });
  });

  describe('isMaxAttemptsReached', () => {
    const config = MESSAGE_RETRY_CONFIG; // maxAttempts: 3

    it('should return false if under max', () => {
      const state = { attemptCount: 2, lastAttemptTime: 0, status: 'pending' as const };
      expect(isMaxAttemptsReached(state, config)).toBe(false);
    });

    it('should return true if at max', () => {
      const state = { attemptCount: 3, lastAttemptTime: 0, status: 'pending' as const };
      expect(isMaxAttemptsReached(state, config)).toBe(true);
    });

    it('should return true if over max', () => {
      const state = { attemptCount: 5, lastAttemptTime: 0, status: 'pending' as const };
      expect(isMaxAttemptsReached(state, config)).toBe(true);
    });

    it('should return false for attemptCount 0', () => {
      const state = { attemptCount: 0, lastAttemptTime: 0, status: 'pending' as const };
      expect(isMaxAttemptsReached(state, config)).toBe(false);
    });
  });

  describe('getTimeUntilNextRetry', () => {
    const config = MESSAGE_RETRY_CONFIG;
    const now = 1700000000000;

    it('should return 0 if retry is due', () => {
      const state = { attemptCount: 1, lastAttemptTime: now - 15000, status: 'pending' as const };
      expect(getTimeUntilNextRetry(state, config, now)).toBe(0);
    });

    it('should return remaining time if not due', () => {
      const state = { attemptCount: 1, lastAttemptTime: now - 3000, status: 'pending' as const };
      expect(getTimeUntilNextRetry(state, config, now)).toBe(7000);
    });

    it('should return Infinity if max attempts reached', () => {
      const state = { attemptCount: 3, lastAttemptTime: now, status: 'pending' as const };
      expect(getTimeUntilNextRetry(state, config, now)).toBe(Infinity);
    });

    it('should return Infinity if status is failed', () => {
      const state = { attemptCount: 1, lastAttemptTime: now - 15000, status: 'failed' as const };
      expect(getTimeUntilNextRetry(state, config, now)).toBe(Infinity);
    });

    it('should return 0 if status is idle', () => {
      const state = { attemptCount: 0, lastAttemptTime: 0, status: 'idle' as const };
      expect(getTimeUntilNextRetry(state, config, now)).toBe(0);
    });
  });

  describe('MESSAGE_RETRY_CONFIG', () => {
    it('should have correct default values', () => {
      expect(MESSAGE_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(MESSAGE_RETRY_CONFIG.intervalMs).toBe(10000);
      expect(MESSAGE_RETRY_CONFIG.backoffType).toBe('fixed');
    });
  });
});

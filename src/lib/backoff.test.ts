import { describe, it, expect } from 'vitest';
import { getNextDelay, STREAM_RECONNECT_CONFIG, type BackoffConfig } from './backoff';

describe('backoff', () => {
  describe('STREAM_RECONNECT_CONFIG', () => {
    it('has correct default values', () => {
      expect(STREAM_RECONNECT_CONFIG.initialDelayMs).toBe(5000);
      expect(STREAM_RECONNECT_CONFIG.maxDelayMs).toBe(30000);
      expect(STREAM_RECONNECT_CONFIG.multiplier).toBe(2);
    });
  });

  describe('getNextDelay', () => {
    describe('F1-002: backoff progression with default config', () => {
      it.each([
        { attempt: 0, expected: 5000 },
        { attempt: 1, expected: 10000 },
        { attempt: 2, expected: 20000 },
        { attempt: 3, expected: 30000 },
        { attempt: 4, expected: 30000 },
        { attempt: 5, expected: 30000 },
        { attempt: 10, expected: 30000 },
      ])('returns $expected ms for attempt $attempt', ({ attempt, expected }) => {
        expect(getNextDelay(attempt)).toBe(expected);
      });
    });

    describe('custom configuration', () => {
      const custom: BackoffConfig = {
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        multiplier: 3,
      };

      it('returns initial delay for attempt 0', () => {
        expect(getNextDelay(0, custom)).toBe(1000);
      });

      it('returns 3000 for attempt 1 (1000 * 3^1)', () => {
        expect(getNextDelay(1, custom)).toBe(3000);
      });

      it('returns 5000 (capped) for attempt 2 (1000 * 3^2 = 9000 > 5000)', () => {
        expect(getNextDelay(2, custom)).toBe(5000);
      });
    });

    describe('edge cases', () => {
      it('returns maxDelayMs for very large attempt count (no overflow)', () => {
        const result = getNextDelay(100);
        expect(result).toBe(30000);
        expect(Number.isFinite(result)).toBe(true);
      });

      it('returns maxDelayMs for extremely large attempt count', () => {
        const result = getNextDelay(Number.MAX_SAFE_INTEGER);
        expect(result).toBe(30000);
        expect(Number.isFinite(result)).toBe(true);
      });

      it('returns initialDelayMs for attempt 0 with any config', () => {
        const config: BackoffConfig = { initialDelayMs: 7777, maxDelayMs: 99999, multiplier: 5 };
        expect(getNextDelay(0, config)).toBe(7777);
      });

      it('returns constant delay when multiplier is 1', () => {
        const config: BackoffConfig = { initialDelayMs: 5000, maxDelayMs: 30000, multiplier: 1 };
        expect(getNextDelay(0, config)).toBe(5000);
        expect(getNextDelay(1, config)).toBe(5000);
        expect(getNextDelay(5, config)).toBe(5000);
        expect(getNextDelay(100, config)).toBe(5000);
      });

      it('returns constant delay when maxDelayMs equals initialDelayMs', () => {
        const config: BackoffConfig = { initialDelayMs: 5000, maxDelayMs: 5000, multiplier: 2 };
        expect(getNextDelay(0, config)).toBe(5000);
        expect(getNextDelay(1, config)).toBe(5000);
        expect(getNextDelay(10, config)).toBe(5000);
      });

      it('treats negative attempt count as 0', () => {
        expect(getNextDelay(-1)).toBe(5000);
        expect(getNextDelay(-100)).toBe(5000);
      });

      it('never returns NaN', () => {
        expect(Number.isNaN(getNextDelay(0))).toBe(false);
        expect(Number.isNaN(getNextDelay(1000))).toBe(false);
        expect(Number.isNaN(getNextDelay(-1))).toBe(false);
      });

      it('never returns Infinity', () => {
        expect(Number.isFinite(getNextDelay(0))).toBe(true);
        expect(Number.isFinite(getNextDelay(1000))).toBe(true);
        expect(Number.isFinite(getNextDelay(Number.MAX_SAFE_INTEGER))).toBe(true);
      });

      it('uses default config when none provided', () => {
        // Should use STREAM_RECONNECT_CONFIG by default
        expect(getNextDelay(0)).toBe(5000);
        expect(getNextDelay(1)).toBe(10000);
      });

      it('handles fractional attempt count without error', () => {
        const result = getNextDelay(1.5);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(5000);
        expect(result).toBeLessThanOrEqual(30000);
      });

      it('caps immediately with very large multiplier', () => {
        const config: BackoffConfig = { initialDelayMs: 1000, maxDelayMs: 5000, multiplier: 100 };
        expect(getNextDelay(0, config)).toBe(1000);
        expect(getNextDelay(1, config)).toBe(5000);
      });

      it('handles multiplier less than 1 (decreasing delays)', () => {
        const config: BackoffConfig = { initialDelayMs: 10000, maxDelayMs: 30000, multiplier: 0.5 };
        expect(getNextDelay(0, config)).toBe(10000);
        expect(getNextDelay(1, config)).toBe(5000);
        expect(getNextDelay(2, config)).toBe(2500);
      });

      it('validates complete progression for default config', () => {
        const progression = Array.from({ length: 11 }, (_, i) => getNextDelay(i));
        expect(progression).toEqual([
          5000, 10000, 20000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000,
        ]);
      });
    });
  });
});

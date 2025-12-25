/**
 * useCopyToClipboard Hook Tests
 *
 * Tests for:
 * 1. Initial state
 * 2. Successful copy operation
 * 3. Timeout reset behavior
 * 4. Error handling when clipboard unavailable
 * 5. Multiple sequential copies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

describe('useCopyToClipboard', () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
    mockWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with isCopied as false', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      expect(result.current.isCopied).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Successful Copy', () => {
    it('should copy text to clipboard and set isCopied to true', async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success!).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('test text');
      expect(result.current.isCopied).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should reset isCopied to false after 2 seconds', async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.isCopied).toBe(true);

      // Advance time by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isCopied).toBe(false);
    });

    it('should not reset isCopied before 2 seconds', async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.isCopied).toBe(true);

      // Advance time by 1.9 seconds (just before reset)
      act(() => {
        vi.advanceTimersByTime(1900);
      });

      expect(result.current.isCopied).toBe(true);
    });
  });

  describe('Multiple Copies', () => {
    it('should reset timer when copying again before timeout', async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      // First copy
      await act(async () => {
        await result.current.copy('first text');
      });

      expect(result.current.isCopied).toBe(true);

      // Advance time by 1.5 seconds
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(result.current.isCopied).toBe(true);

      // Second copy (should reset timer)
      await act(async () => {
        await result.current.copy('second text');
      });

      expect(result.current.isCopied).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('second text');

      // Advance time by 1.5 seconds (total 3 seconds from first copy, but only 1.5 from second)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Should still be copied because timer was reset
      expect(result.current.isCopied).toBe(true);

      // Advance another 0.5 seconds to complete 2 seconds from second copy
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isCopied).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle clipboard write failure', async () => {
      mockWriteText.mockRejectedValue(new Error('Copy failed'));

      const { result } = renderHook(() => useCopyToClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success!).toBe(false);
      expect(result.current.isCopied).toBe(false);
      expect(result.current.error).toBe('Copy failed');
    });

    it('should handle clipboard API not available', async () => {
      // Remove clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success!).toBe(false);
      expect(result.current.isCopied).toBe(false);
      expect(result.current.error).toBe('Clipboard API not available');
    });

    it('should clear error on successful copy after error', async () => {
      // First, cause an error
      mockWriteText.mockRejectedValueOnce(new Error('First copy failed'));

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.error).toBe('First copy failed');

      // Then, copy successfully
      mockWriteText.mockResolvedValueOnce(undefined);

      await act(async () => {
        await result.current.copy('second text');
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isCopied).toBe(true);
    });
  });
});

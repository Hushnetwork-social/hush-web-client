/**
 * Unit tests for useMentionDataLossCheck hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMentionDataLossCheck } from './useMentionDataLossCheck';
import * as mentionTracker from '@/lib/mentions';

// Mock the mention tracker module
vi.mock('@/lib/mentions', () => ({
  checkForDataLoss: vi.fn(),
  clearDataLossFlag: vi.fn(),
}));

describe('useMentionDataLossCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty toasts when no data loss detected', async () => {
    vi.mocked(mentionTracker.checkForDataLoss).mockReturnValue(false);

    const { result } = renderHook(() => useMentionDataLossCheck());

    // Initial state
    expect(result.current.toasts).toEqual([]);

    // Advance timer past the delay
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Should still be empty
    expect(result.current.toasts).toEqual([]);
    expect(mentionTracker.clearDataLossFlag).not.toHaveBeenCalled();
  });

  it('shows toast when data loss detected', async () => {
    vi.mocked(mentionTracker.checkForDataLoss).mockReturnValue(true);

    const { result } = renderHook(() => useMentionDataLossCheck());

    // Initial state
    expect(result.current.toasts).toEqual([]);

    // Advance timer past the delay
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Should show toast
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe('mention-data-loss');
    expect(result.current.toasts[0].message).toContain('Mention tracking data was reset');
  });

  it('clears data loss flag after showing toast', async () => {
    vi.mocked(mentionTracker.checkForDataLoss).mockReturnValue(true);

    renderHook(() => useMentionDataLossCheck());

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mentionTracker.clearDataLossFlag).toHaveBeenCalledTimes(1);
  });

  it('dismissToast removes toast from list', async () => {
    vi.mocked(mentionTracker.checkForDataLoss).mockReturnValue(true);

    const { result } = renderHook(() => useMentionDataLossCheck());

    // Trigger data loss detection
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.toasts).toHaveLength(1);

    // Dismiss the toast
    act(() => {
      result.current.dismissToast('mention-data-loss');
    });

    expect(result.current.toasts).toEqual([]);
  });

  it('does not check for data loss before delay', async () => {
    vi.mocked(mentionTracker.checkForDataLoss).mockReturnValue(true);

    renderHook(() => useMentionDataLossCheck());

    // Before delay
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mentionTracker.checkForDataLoss).not.toHaveBeenCalled();

    // After delay
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(mentionTracker.checkForDataLoss).toHaveBeenCalledTimes(1);
  });
});

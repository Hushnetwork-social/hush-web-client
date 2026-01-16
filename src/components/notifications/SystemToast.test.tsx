/**
 * Unit tests for SystemToast component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SystemToast, SystemToastContainer } from './SystemToast';

describe('SystemToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders with message', () => {
      const onDismiss = vi.fn();
      render(
        <SystemToast
          message="Test system message"
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByText('Test system message')).toBeInTheDocument();
    });

    it('has alert role for accessibility', () => {
      const onDismiss = vi.fn();
      render(
        <SystemToast
          message="Test message"
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders dismiss button', () => {
      const onDismiss = vi.fn();
      render(
        <SystemToast
          message="Test message"
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });
  });

  describe('Dismiss Behavior', () => {
    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(
        <SystemToast
          message="Test message"
          onDismiss={onDismiss}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('auto-dismisses after default timeout (5s)', () => {
      const onDismiss = vi.fn();
      render(
        <SystemToast
          message="Test message"
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('auto-dismisses after custom timeout', () => {
      const onDismiss = vi.fn();
      render(
        <SystemToast
          message="Test message"
          onDismiss={onDismiss}
          autoDismissMs={3000}
        />
      );

      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(onDismiss).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});

describe('SystemToastContainer', () => {
  it('renders nothing when toasts array is empty', () => {
    const { container } = render(
      <SystemToastContainer toasts={[]} onDismiss={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      { id: '1', message: 'First message' },
      { id: '2', message: 'Second message' },
    ];

    render(
      <SystemToastContainer toasts={toasts} onDismiss={vi.fn()} />
    );

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('calls onDismiss with correct id when toast dismissed', () => {
    const onDismiss = vi.fn();
    const toasts = [
      { id: 'toast-1', message: 'Test message' },
    ];

    render(
      <SystemToastContainer toasts={toasts} onDismiss={onDismiss} />
    );

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });
});

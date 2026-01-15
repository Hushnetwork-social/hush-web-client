/**
 * useVirtualKeyboard Hook Tests
 *
 * Tests for:
 * 1. Initial state (keyboard not visible)
 * 2. Platform detection (Android only)
 * 3. visualViewport API detection path
 * 4. Focus/blur fallback path
 * 5. Threshold boundary testing
 * 6. Cleanup on unmount
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualKeyboard } from './useVirtualKeyboard';

describe('useVirtualKeyboard', () => {
  const originalNavigator = global.navigator;

  // Mock resize event listeners for visualViewport
  let resizeListeners: Array<() => void> = [];
  let mockVisualViewport: {
    height: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  } | null = null;

  function setupAndroidWithVisualViewport(initialHeight: number = 800) {
    // Mock Android user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0',
      configurable: true,
    });

    // Mock window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      value: initialHeight,
      configurable: true,
    });

    // Mock visualViewport
    resizeListeners = [];
    mockVisualViewport = {
      height: initialHeight,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'resize') {
          resizeListeners.push(handler);
        }
      }),
      removeEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'resize') {
          resizeListeners = resizeListeners.filter(h => h !== handler);
        }
      }),
    };

    Object.defineProperty(window, 'visualViewport', {
      value: mockVisualViewport,
      configurable: true,
    });
  }

  function setupAndroidWithoutVisualViewport() {
    // Mock Android user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0',
      configurable: true,
    });

    // Remove visualViewport
    Object.defineProperty(window, 'visualViewport', {
      value: null,
      configurable: true,
    });
  }

  function setupiOS() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
  }

  function setupDesktop() {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0',
      configurable: true,
    });
  }

  function simulateViewportResize(newHeight: number) {
    if (mockVisualViewport) {
      mockVisualViewport.height = newHeight;
      resizeListeners.forEach(listener => listener());
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    resizeListeners = [];
    mockVisualViewport = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    // Restore original navigator/window properties
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  describe('Initial State', () => {
    it('should initialize with isKeyboardVisible as false', () => {
      setupAndroidWithVisualViewport();
      const { result } = renderHook(() => useVirtualKeyboard());

      expect(result.current.isKeyboardVisible).toBe(false);
    });
  });

  describe('Platform Detection', () => {
    it('should always return false on iOS', () => {
      setupiOS();
      const { result } = renderHook(() => useVirtualKeyboard());

      expect(result.current.isKeyboardVisible).toBe(false);
    });

    it('should always return false on desktop', () => {
      setupDesktop();
      const { result } = renderHook(() => useVirtualKeyboard());

      expect(result.current.isKeyboardVisible).toBe(false);
    });

    it('should not attach event listeners on non-Android platforms', () => {
      setupiOS();
      Object.defineProperty(window, 'visualViewport', {
        value: {
          height: 800,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        configurable: true,
      });

      renderHook(() => useVirtualKeyboard());

      expect(window.visualViewport?.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('visualViewport API Detection', () => {
    it('should detect keyboard open when viewport height decreases by more than 150px', () => {
      setupAndroidWithVisualViewport(800);
      const { result } = renderHook(() => useVirtualKeyboard());

      expect(result.current.isKeyboardVisible).toBe(false);

      // Simulate keyboard opening (300px keyboard)
      act(() => {
        simulateViewportResize(500);
      });

      expect(result.current.isKeyboardVisible).toBe(true);
    });

    it('should detect keyboard close when viewport height returns to normal', () => {
      setupAndroidWithVisualViewport(800);
      const { result } = renderHook(() => useVirtualKeyboard());

      // Open keyboard
      act(() => {
        simulateViewportResize(500);
      });

      expect(result.current.isKeyboardVisible).toBe(true);

      // Close keyboard
      act(() => {
        simulateViewportResize(800);
      });

      expect(result.current.isKeyboardVisible).toBe(false);
    });

    it('should NOT detect keyboard when height decreases by exactly 150px (boundary)', () => {
      setupAndroidWithVisualViewport(800);
      const { result } = renderHook(() => useVirtualKeyboard());

      // 150px decrease - should NOT trigger keyboard detection
      act(() => {
        simulateViewportResize(650);
      });

      expect(result.current.isKeyboardVisible).toBe(false);
    });

    it('should detect keyboard when height decreases by 151px (just over threshold)', () => {
      setupAndroidWithVisualViewport(800);
      const { result } = renderHook(() => useVirtualKeyboard());

      // 151px decrease - should trigger keyboard detection
      act(() => {
        simulateViewportResize(649);
      });

      expect(result.current.isKeyboardVisible).toBe(true);
    });

    it('should attach resize listener to visualViewport', () => {
      setupAndroidWithVisualViewport();
      renderHook(() => useVirtualKeyboard());

      expect(mockVisualViewport?.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should remove resize listener on unmount', () => {
      setupAndroidWithVisualViewport();
      const { unmount } = renderHook(() => useVirtualKeyboard());

      unmount();

      expect(mockVisualViewport?.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('Focus/Blur Fallback', () => {
    it('should detect keyboard open on focusin event for input elements', () => {
      setupAndroidWithoutVisualViewport();
      const { result } = renderHook(() => useVirtualKeyboard());

      expect(result.current.isKeyboardVisible).toBe(false);

      // Simulate focusin on an input
      const input = document.createElement('input');
      act(() => {
        document.body.appendChild(input);
        input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      expect(result.current.isKeyboardVisible).toBe(true);

      // Cleanup
      document.body.removeChild(input);
    });

    it('should detect keyboard open on focusin event for textarea elements', () => {
      setupAndroidWithoutVisualViewport();
      const { result } = renderHook(() => useVirtualKeyboard());

      const textarea = document.createElement('textarea');
      act(() => {
        document.body.appendChild(textarea);
        textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      expect(result.current.isKeyboardVisible).toBe(true);

      // Cleanup
      document.body.removeChild(textarea);
    });

    it('should NOT detect keyboard on focusin for non-text elements', () => {
      setupAndroidWithoutVisualViewport();
      const { result } = renderHook(() => useVirtualKeyboard());

      const button = document.createElement('button');
      act(() => {
        document.body.appendChild(button);
        button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      expect(result.current.isKeyboardVisible).toBe(false);

      // Cleanup
      document.body.removeChild(button);
    });

    it('should detect keyboard close on focusout after 100ms delay', () => {
      setupAndroidWithoutVisualViewport();
      const { result } = renderHook(() => useVirtualKeyboard());

      const input = document.createElement('input');
      document.body.appendChild(input);

      // Focus
      act(() => {
        input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      expect(result.current.isKeyboardVisible).toBe(true);

      // Blur
      act(() => {
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });

      // Should still be visible before 100ms
      expect(result.current.isKeyboardVisible).toBe(true);

      // Advance by 100ms
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.isKeyboardVisible).toBe(false);

      // Cleanup
      document.body.removeChild(input);
    });

    it('should cancel blur timeout if another focusin occurs', () => {
      setupAndroidWithoutVisualViewport();
      const { result } = renderHook(() => useVirtualKeyboard());

      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      document.body.appendChild(input1);
      document.body.appendChild(input2);

      // Focus first input
      act(() => {
        input1.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      expect(result.current.isKeyboardVisible).toBe(true);

      // Blur first input
      act(() => {
        input1.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });

      // Focus second input before 100ms
      act(() => {
        vi.advanceTimersByTime(50);
        input2.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      // Advance past the original blur timeout
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should still be visible because we focused another input
      expect(result.current.isKeyboardVisible).toBe(true);

      // Cleanup
      document.body.removeChild(input1);
      document.body.removeChild(input2);
    });

    it('should cleanup event listeners on unmount', () => {
      setupAndroidWithoutVisualViewport();
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useVirtualKeyboard());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('focusin', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('focusout', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should clear pending blur timeout on unmount', () => {
      setupAndroidWithoutVisualViewport();
      const { unmount } = renderHook(() => useVirtualKeyboard());

      const input = document.createElement('input');
      document.body.appendChild(input);

      // Focus then blur to start timeout
      act(() => {
        input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });

      // Unmount before timeout completes
      unmount();

      // Advance timers - should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Cleanup
      document.body.removeChild(input);
    });
  });
});

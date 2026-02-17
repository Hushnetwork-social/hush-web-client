/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock localStorage (only in browser-like environments)
if (typeof window !== 'undefined') {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Reset all mocks between tests
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });
} else {
  // Node environment - just clear mocks
  beforeEach(() => {
    vi.clearAllMocks();
  });
}

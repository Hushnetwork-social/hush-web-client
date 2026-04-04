/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

type MockStorage = Storage & {
  __reset: () => void;
};

function createStorageMock(): MockStorage {
  let store: Record<string, string> = {};

  const storage = {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
    clear: vi.fn<() => void>(),
    key: vi.fn<(index: number) => string | null>(),
    __reset: () => {
      store = {};

      storage.getItem.mockReset();
      storage.getItem.mockImplementation((key: string) =>
        Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
      );

      storage.setItem.mockReset();
      storage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = String(value);
      });

      storage.removeItem.mockReset();
      storage.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });

      storage.clear.mockReset();
      storage.clear.mockImplementation(() => {
        store = {};
      });

      storage.key.mockReset();
      storage.key.mockImplementation((index: number) => Object.keys(store)[index] ?? null);
    },
  };

  Object.defineProperty(storage, 'length', {
    get: () => Object.keys(store).length,
  });

  storage.__reset();
  return storage as MockStorage;
}

if (typeof window !== 'undefined') {
  const localStorageMock = createStorageMock();
  const sessionStorageMock = createStorageMock();

  Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true });

  // Reset all mocks between tests
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.__reset();
    sessionStorageMock.__reset();
  });
} else {
  // Node environment - just clear mocks
  beforeEach(() => {
    vi.clearAllMocks();
  });
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedMetadata,
  setCachedMetadata,
  removeCachedMetadata,
  isCached,
  getCachedMetadataBatch,
  cleanupExpiredEntries,
  clearAllCachedMetadata,
  type UrlMetadata,
} from './urlMetadataCache';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

// Helper to create test metadata
function createTestMetadata(url: string, overrides?: Partial<UrlMetadata>): UrlMetadata {
  return {
    url,
    domain: new URL(url).hostname,
    title: 'Test Title',
    description: 'Test Description',
    imageUrl: null,
    imageBase64: null,
    success: true,
    errorMessage: null,
    ...overrides,
  };
}

describe('urlMetadataCache', () => {
  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('getCachedMetadata', () => {
    it('should return null for cache miss', () => {
      const result = getCachedMetadata('https://example.com');
      expect(result).toBeNull();
    });

    it('should return metadata for cache hit', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      const result = getCachedMetadata('https://example.com');
      expect(result).toEqual(metadata);
    });

    it('should return null for expired entry', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      // Advance time by 25 hours (past 24-hour TTL)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = getCachedMetadata('https://example.com');
      expect(result).toBeNull();
    });

    it('should remove expired entry from storage', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      // Advance time by 25 hours
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      // Get should return null and remove entry
      getCachedMetadata('https://example.com');

      // Verify removeItem was called
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it('should return metadata just before expiration', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      // Advance time by 23 hours 59 minutes (just under 24-hour TTL)
      vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 59 * 60 * 1000);

      const result = getCachedMetadata('https://example.com');
      expect(result).toEqual(metadata);
    });

    it('should return null for invalid JSON in storage', () => {
      localStorageMock.setItem('hush-url-meta:abc123', 'not valid json');

      const result = getCachedMetadata('https://example.com');
      expect(result).toBeNull();
    });
  });

  describe('setCachedMetadata', () => {
    it('should store metadata with timestamp', () => {
      const now = Date.now();
      const metadata = createTestMetadata('https://example.com');

      setCachedMetadata('https://example.com', metadata);

      // Find the call that stored the actual metadata (not the availability check)
      const metadataCall = localStorageMock.setItem.mock.calls.find(
        (call: [string, string]) => call[0].startsWith('hush-url-meta:')
      );
      expect(metadataCall).toBeDefined();

      const storedValue = metadataCall![1];
      const parsed = JSON.parse(storedValue);

      expect(parsed.metadata).toEqual(metadata);
      expect(parsed.cachedAt).toBe(now);
    });

    it('should overwrite existing entry', () => {
      const metadata1 = createTestMetadata('https://example.com', { title: 'Title 1' });
      const metadata2 = createTestMetadata('https://example.com', { title: 'Title 2' });

      setCachedMetadata('https://example.com', metadata1);
      setCachedMetadata('https://example.com', metadata2);

      const result = getCachedMetadata('https://example.com');
      expect(result?.title).toBe('Title 2');
    });

    it('should store different URLs separately', () => {
      const metadata1 = createTestMetadata('https://example.com', { title: 'Example' });
      const metadata2 = createTestMetadata('https://other.com', { title: 'Other' });

      setCachedMetadata('https://example.com', metadata1);
      setCachedMetadata('https://other.com', metadata2);

      expect(getCachedMetadata('https://example.com')?.title).toBe('Example');
      expect(getCachedMetadata('https://other.com')?.title).toBe('Other');
    });
  });

  describe('removeCachedMetadata', () => {
    it('should remove cached entry', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      removeCachedMetadata('https://example.com');

      const result = getCachedMetadata('https://example.com');
      expect(result).toBeNull();
    });

    it('should not throw for non-existent entry', () => {
      expect(() => removeCachedMetadata('https://nonexistent.com')).not.toThrow();
    });
  });

  describe('isCached', () => {
    it('should return true for cached URL', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      expect(isCached('https://example.com')).toBe(true);
    });

    it('should return false for non-cached URL', () => {
      expect(isCached('https://example.com')).toBe(false);
    });

    it('should return false for expired URL', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      expect(isCached('https://example.com')).toBe(false);
    });
  });

  describe('getCachedMetadataBatch', () => {
    it('should return map of cached URLs', () => {
      const metadata1 = createTestMetadata('https://a.com');
      const metadata2 = createTestMetadata('https://b.com');

      setCachedMetadata('https://a.com', metadata1);
      setCachedMetadata('https://b.com', metadata2);

      const result = getCachedMetadataBatch(['https://a.com', 'https://b.com', 'https://c.com']);

      expect(result.size).toBe(2);
      expect(result.get('https://a.com')).toEqual(metadata1);
      expect(result.get('https://b.com')).toEqual(metadata2);
      expect(result.has('https://c.com')).toBe(false);
    });

    it('should return empty map for empty input', () => {
      const result = getCachedMetadataBatch([]);
      expect(result.size).toBe(0);
    });

    it('should skip expired entries', () => {
      const metadata1 = createTestMetadata('https://a.com');
      setCachedMetadata('https://a.com', metadata1);

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const metadata2 = createTestMetadata('https://b.com');
      setCachedMetadata('https://b.com', metadata2);

      const result = getCachedMetadataBatch(['https://a.com', 'https://b.com']);

      expect(result.size).toBe(1);
      expect(result.has('https://a.com')).toBe(false);
      expect(result.get('https://b.com')).toEqual(metadata2);
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should remove expired entries', () => {
      const metadata1 = createTestMetadata('https://old.com');
      setCachedMetadata('https://old.com', metadata1);

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const metadata2 = createTestMetadata('https://new.com');
      setCachedMetadata('https://new.com', metadata2);

      cleanupExpiredEntries();

      expect(getCachedMetadata('https://old.com')).toBeNull();
      expect(getCachedMetadata('https://new.com')).toEqual(metadata2);
    });

    it('should not remove non-expired entries', () => {
      const metadata = createTestMetadata('https://example.com');
      setCachedMetadata('https://example.com', metadata);

      cleanupExpiredEntries();

      expect(getCachedMetadata('https://example.com')).toEqual(metadata);
    });
  });

  describe('clearAllCachedMetadata', () => {
    it('should remove all cached entries', () => {
      setCachedMetadata('https://a.com', createTestMetadata('https://a.com'));
      setCachedMetadata('https://b.com', createTestMetadata('https://b.com'));
      setCachedMetadata('https://c.com', createTestMetadata('https://c.com'));

      clearAllCachedMetadata();

      expect(getCachedMetadata('https://a.com')).toBeNull();
      expect(getCachedMetadata('https://b.com')).toBeNull();
      expect(getCachedMetadata('https://c.com')).toBeNull();
    });

    it('should not throw when cache is empty', () => {
      expect(() => clearAllCachedMetadata()).not.toThrow();
    });
  });

  describe('localStorage unavailable', () => {
    it('should handle localStorage being unavailable gracefully', () => {
      // Mock localStorage to throw
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('localStorage unavailable');
        },
        setItem: () => {
          throw new Error('localStorage unavailable');
        },
        removeItem: () => {
          throw new Error('localStorage unavailable');
        },
      });

      // These should not throw
      expect(() => setCachedMetadata('https://example.com', createTestMetadata('https://example.com'))).not.toThrow();
      expect(getCachedMetadata('https://example.com')).toBeNull();
      expect(() => removeCachedMetadata('https://example.com')).not.toThrow();
    });
  });
});

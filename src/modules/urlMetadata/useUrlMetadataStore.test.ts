import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUrlMetadataStore } from './useUrlMetadataStore';
import * as urlMetadataCache from '@/lib/urlDetector/urlMetadataCache';
import * as urlMetadataService from './urlMetadataService';
import type { UrlMetadata } from '@/lib/urlDetector/urlMetadataCache';

// Mock the cache and service modules
vi.mock('@/lib/urlDetector/urlMetadataCache', () => ({
  getCachedMetadata: vi.fn(),
  getCachedMetadataBatch: vi.fn(),
}));

vi.mock('./urlMetadataService', () => ({
  fetchUrlMetadataBatch: vi.fn(),
}));

// Helper to create test metadata
function createTestMetadata(url: string, overrides?: Partial<UrlMetadata>): UrlMetadata {
  const domain = new URL(url).hostname;
  return {
    url,
    domain,
    title: `Title for ${domain}`,
    description: `Description for ${domain}`,
    imageUrl: null,
    imageBase64: null,
    success: true,
    errorMessage: null,
    ...overrides,
  };
}

describe('useUrlMetadataStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
    });

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getMetadata', () => {
    it('should return null for unknown URL', () => {
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(null);

      const result = useUrlMetadataStore.getState().getMetadata('https://unknown.com');

      expect(result).toBeNull();
    });

    it('should return metadata from store if available', () => {
      const metadata = createTestMetadata('https://example.com');
      useUrlMetadataStore.setState({
        metadata: new Map([['https://example.com', metadata]]),
        loading: new Set(),
        errors: new Map(),
      });

      const result = useUrlMetadataStore.getState().getMetadata('https://example.com');

      expect(result).toEqual(metadata);
      // Should not check localStorage if already in store
      expect(urlMetadataCache.getCachedMetadata).not.toHaveBeenCalled();
    });

    it('should check localStorage cache if not in store', () => {
      const metadata = createTestMetadata('https://example.com');
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(metadata);

      const result = useUrlMetadataStore.getState().getMetadata('https://example.com');

      expect(result).toEqual(metadata);
      expect(urlMetadataCache.getCachedMetadata).toHaveBeenCalledWith('https://example.com');
    });

    it('should hydrate store from localStorage cache', () => {
      const metadata = createTestMetadata('https://example.com');
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(metadata);

      // First call - should hydrate from localStorage
      useUrlMetadataStore.getState().getMetadata('https://example.com');

      // Check that store was updated
      const storeMetadata = useUrlMetadataStore.getState().metadata.get('https://example.com');
      expect(storeMetadata).toEqual(metadata);
    });
  });

  describe('isLoading', () => {
    it('should return false for non-loading URL', () => {
      const result = useUrlMetadataStore.getState().isLoading('https://example.com');
      expect(result).toBe(false);
    });

    it('should return true for loading URL', () => {
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(['https://example.com']),
        errors: new Map(),
      });

      const result = useUrlMetadataStore.getState().isLoading('https://example.com');
      expect(result).toBe(true);
    });
  });

  describe('fetchMetadata', () => {
    it('should not fetch if URLs array is empty', async () => {
      await useUrlMetadataStore.getState().fetchMetadata([]);

      expect(urlMetadataService.fetchUrlMetadataBatch).not.toHaveBeenCalled();
    });

    it('should skip URLs already in store', async () => {
      const metadata = createTestMetadata('https://example.com');
      useUrlMetadataStore.setState({
        metadata: new Map([['https://example.com', metadata]]),
        loading: new Set(),
        errors: new Map(),
      });
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(null);
      vi.mocked(urlMetadataService.fetchUrlMetadataBatch).mockResolvedValue(new Map());

      await useUrlMetadataStore.getState().fetchMetadata(['https://example.com']);

      expect(urlMetadataService.fetchUrlMetadataBatch).not.toHaveBeenCalled();
    });

    it('should skip URLs currently loading', async () => {
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(['https://example.com']),
        errors: new Map(),
      });
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(null);
      vi.mocked(urlMetadataService.fetchUrlMetadataBatch).mockResolvedValue(new Map());

      await useUrlMetadataStore.getState().fetchMetadata(['https://example.com']);

      expect(urlMetadataService.fetchUrlMetadataBatch).not.toHaveBeenCalled();
    });

    it('should hydrate from localStorage cache before fetching', async () => {
      const metadata = createTestMetadata('https://cached.com');
      vi.mocked(urlMetadataCache.getCachedMetadata).mockImplementation((url) =>
        url === 'https://cached.com' ? metadata : null
      );
      vi.mocked(urlMetadataService.fetchUrlMetadataBatch).mockResolvedValue(new Map());

      await useUrlMetadataStore.getState().fetchMetadata([
        'https://cached.com',
        'https://uncached.com',
      ]);

      // Should only fetch the uncached URL
      expect(urlMetadataService.fetchUrlMetadataBatch).toHaveBeenCalledWith(['https://uncached.com']);

      // Cached URL should be in store
      const cachedMeta = useUrlMetadataStore.getState().metadata.get('https://cached.com');
      expect(cachedMeta).toEqual(metadata);
    });

    it('should set loading state while fetching', async () => {
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(null);

      // Create a promise we can control
      let resolvePromise: (value: Map<string, UrlMetadata>) => void;
      const fetchPromise = new Promise<Map<string, UrlMetadata>>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(urlMetadataService.fetchUrlMetadataBatch).mockReturnValue(fetchPromise);

      // Start the fetch
      const fetchCall = useUrlMetadataStore.getState().fetchMetadata(['https://example.com']);

      // Check loading state is set
      expect(useUrlMetadataStore.getState().loading.has('https://example.com')).toBe(true);

      // Resolve the fetch
      resolvePromise!(new Map([['https://example.com', createTestMetadata('https://example.com')]]));
      await fetchCall;

      // Loading state should be cleared
      expect(useUrlMetadataStore.getState().loading.has('https://example.com')).toBe(false);
    });

    it('should store fetched metadata in store', async () => {
      const metadata = createTestMetadata('https://example.com');
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(null);
      vi.mocked(urlMetadataService.fetchUrlMetadataBatch).mockResolvedValue(
        new Map([['https://example.com', metadata]])
      );

      await useUrlMetadataStore.getState().fetchMetadata(['https://example.com']);

      const storeMetadata = useUrlMetadataStore.getState().metadata.get('https://example.com');
      expect(storeMetadata).toEqual(metadata);
    });

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(urlMetadataCache.getCachedMetadata).mockReturnValue(null);
      vi.mocked(urlMetadataService.fetchUrlMetadataBatch).mockRejectedValue(
        new Error('Network error')
      );

      await useUrlMetadataStore.getState().fetchMetadata(['https://example.com']);

      // Loading should be cleared
      expect(useUrlMetadataStore.getState().loading.has('https://example.com')).toBe(false);

      // Error should be recorded
      const error = useUrlMetadataStore.getState().errors.get('https://example.com');
      expect(error).toBe('Network error');
    });
  });

  describe('getLoadingUrls', () => {
    it('should return empty set when no URLs are loading', () => {
      const result = useUrlMetadataStore.getState().getLoadingUrls([
        'https://a.com',
        'https://b.com',
      ]);

      expect(result.size).toBe(0);
    });

    it('should return set of loading URLs', () => {
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(['https://a.com', 'https://c.com']),
        errors: new Map(),
      });

      const result = useUrlMetadataStore.getState().getLoadingUrls([
        'https://a.com',
        'https://b.com',
        'https://c.com',
      ]);

      expect(result.size).toBe(2);
      expect(result.has('https://a.com')).toBe(true);
      expect(result.has('https://c.com')).toBe(true);
      expect(result.has('https://b.com')).toBe(false);
    });
  });

  describe('getMetadataBatch', () => {
    it('should return metadata for multiple URLs', () => {
      const metadataA = createTestMetadata('https://a.com');
      const metadataB = createTestMetadata('https://b.com');

      useUrlMetadataStore.setState({
        metadata: new Map([
          ['https://a.com', metadataA],
          ['https://b.com', metadataB],
        ]),
        loading: new Set(),
        errors: new Map(),
      });

      const result = useUrlMetadataStore.getState().getMetadataBatch([
        'https://a.com',
        'https://b.com',
        'https://c.com',
      ]);

      expect(result.get('https://a.com')).toEqual(metadataA);
      expect(result.get('https://b.com')).toEqual(metadataB);
      expect(result.get('https://c.com')).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should remove error for specific URL', () => {
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(),
        errors: new Map([
          ['https://a.com', 'Error A'],
          ['https://b.com', 'Error B'],
        ]),
      });

      useUrlMetadataStore.getState().clearError('https://a.com');

      expect(useUrlMetadataStore.getState().errors.has('https://a.com')).toBe(false);
      expect(useUrlMetadataStore.getState().errors.has('https://b.com')).toBe(true);
    });
  });
});

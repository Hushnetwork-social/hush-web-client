import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLinkPreviews, useBatchLinkPreviewFetch } from './useLinkPreviews';
import { useUrlMetadataStore } from '@/modules/urlMetadata';
import type { UrlMetadata } from '@/lib/urlDetector/urlMetadataCache';

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

describe('useLinkPreviews', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('URL detection', () => {
    it('should detect URLs in content', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      expect(result.current.urls).toHaveLength(1);
      expect(result.current.urls[0].url).toBe('https://example.com');
      expect(result.current.hasUrls).toBe(true);
    });

    it('should detect multiple URLs', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('Visit https://a.com and https://b.com')
      );

      expect(result.current.urls).toHaveLength(2);
      expect(result.current.hasUrls).toBe(true);
    });

    it('should return empty array for content without URLs', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('No URLs here')
      );

      expect(result.current.urls).toHaveLength(0);
      expect(result.current.hasUrls).toBe(false);
    });

    it('should return empty array when disabled', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com', false)
      );

      expect(result.current.urls).toHaveLength(0);
      expect(result.current.hasUrls).toBe(false);
    });

    it('should return empty array for empty content', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('')
      );

      expect(result.current.urls).toHaveLength(0);
      expect(result.current.hasUrls).toBe(false);
    });
  });

  describe('metadata access', () => {
    it('should return null for URLs without metadata', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      const metadata = result.current.metadataMap.get('https://example.com');
      expect(metadata).toBeNull();
    });

    it('should return metadata from store', () => {
      const testMetadata = createTestMetadata('https://example.com');
      useUrlMetadataStore.setState({
        metadata: new Map([['https://example.com', testMetadata]]),
        loading: new Set(),
        errors: new Map(),
      });

      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      const metadata = result.current.metadataMap.get('https://example.com');
      expect(metadata).toEqual(testMetadata);
    });
  });

  describe('loading state', () => {
    it('should return empty loading set for content without URLs', () => {
      const { result } = renderHook(() =>
        useLinkPreviews('No URLs here')
      );

      expect(result.current.loadingUrls.size).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return empty loading set when metadata already cached', () => {
      // Pre-populate the store with metadata
      const testMetadata = createTestMetadata('https://example.com');
      useUrlMetadataStore.setState({
        metadata: new Map([['https://example.com', testMetadata]]),
        loading: new Set(),
        errors: new Map(),
      });

      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      expect(result.current.loadingUrls.size).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return loading URLs from store', () => {
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(['https://example.com']),
        errors: new Map(),
      });

      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      expect(result.current.loadingUrls.has('https://example.com')).toBe(true);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('fetch triggering', () => {
    it('should trigger fetch for uncached URLs', async () => {
      const fetchMetadata = vi.fn().mockResolvedValue(undefined);
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(),
        errors: new Map(),
        fetchMetadata,
      });

      renderHook(() => useLinkPreviews('Check out https://example.com'));

      await waitFor(() => {
        expect(fetchMetadata).toHaveBeenCalledWith(['https://example.com']);
      });
    });

    it('should not fetch for URLs already in store', async () => {
      const testMetadata = createTestMetadata('https://example.com');
      const fetchMetadata = vi.fn().mockResolvedValue(undefined);
      useUrlMetadataStore.setState({
        metadata: new Map([['https://example.com', testMetadata]]),
        loading: new Set(),
        errors: new Map(),
        fetchMetadata,
      });

      renderHook(() => useLinkPreviews('Check out https://example.com'));

      // Wait a tick to ensure effect has run
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetchMetadata).not.toHaveBeenCalled();
    });

    it('should not fetch when disabled', async () => {
      const fetchMetadata = vi.fn().mockResolvedValue(undefined);
      useUrlMetadataStore.setState({
        metadata: new Map(),
        loading: new Set(),
        errors: new Map(),
        fetchMetadata,
      });

      renderHook(() => useLinkPreviews('Check out https://example.com', false));

      // Wait a tick to ensure effect has run
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetchMetadata).not.toHaveBeenCalled();
    });
  });

  describe('reactivity', () => {
    it('should update when store metadata changes', async () => {
      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      // Initially null
      expect(result.current.metadataMap.get('https://example.com')).toBeNull();

      // Update store
      const testMetadata = createTestMetadata('https://example.com');
      act(() => {
        useUrlMetadataStore.setState({
          metadata: new Map([['https://example.com', testMetadata]]),
          loading: new Set(),
          errors: new Map(),
        });
      });

      // Should reflect new metadata
      await waitFor(() => {
        expect(result.current.metadataMap.get('https://example.com')).toEqual(testMetadata);
      });
    });

    it('should update when store loading state changes', async () => {
      const { result } = renderHook(() =>
        useLinkPreviews('Check out https://example.com')
      );

      // Initially not loading
      expect(result.current.isLoading).toBe(false);

      // Update store to loading
      act(() => {
        useUrlMetadataStore.setState({
          metadata: new Map(),
          loading: new Set(['https://example.com']),
          errors: new Map(),
        });
      });

      // Should reflect loading state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
        expect(result.current.loadingUrls.has('https://example.com')).toBe(true);
      });
    });
  });
});

describe('useBatchLinkPreviewFetch', () => {
  beforeEach(() => {
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch URLs from multiple messages', async () => {
    const fetchMetadata = vi.fn().mockResolvedValue(undefined);
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
      fetchMetadata,
    });

    renderHook(() =>
      useBatchLinkPreviewFetch([
        'Check out https://a.com',
        'Visit https://b.com and https://c.com',
      ])
    );

    await waitFor(() => {
      expect(fetchMetadata).toHaveBeenCalled();
      const calledUrls = fetchMetadata.mock.calls[0][0];
      expect(calledUrls).toContain('https://a.com');
      expect(calledUrls).toContain('https://b.com');
      expect(calledUrls).toContain('https://c.com');
    });
  });

  it('should deduplicate URLs across messages', async () => {
    const fetchMetadata = vi.fn().mockResolvedValue(undefined);
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
      fetchMetadata,
    });

    renderHook(() =>
      useBatchLinkPreviewFetch([
        'Check out https://example.com',
        'Also visit https://example.com',
        'Don\'t forget https://example.com',
      ])
    );

    await waitFor(() => {
      expect(fetchMetadata).toHaveBeenCalled();
      const calledUrls = fetchMetadata.mock.calls[0][0];
      // Should only have one instance of the URL
      expect(calledUrls.filter((url: string) => url === 'https://example.com')).toHaveLength(1);
    });
  });

  it('should not fetch when disabled', async () => {
    const fetchMetadata = vi.fn().mockResolvedValue(undefined);
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
      fetchMetadata,
    });

    renderHook(() =>
      useBatchLinkPreviewFetch(['Check out https://example.com'], false)
    );

    // Wait a tick
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetchMetadata).not.toHaveBeenCalled();
  });

  it('should handle empty messages array', async () => {
    const fetchMetadata = vi.fn().mockResolvedValue(undefined);
    useUrlMetadataStore.setState({
      metadata: new Map(),
      loading: new Set(),
      errors: new Map(),
      fetchMetadata,
    });

    renderHook(() => useBatchLinkPreviewFetch([]));

    // Wait a tick
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetchMetadata).not.toHaveBeenCalled();
  });
});

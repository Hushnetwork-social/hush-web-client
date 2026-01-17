/**
 * URL Metadata Store
 *
 * Zustand store for managing URL metadata state across the application.
 * Provides centralized access to cached metadata and loading states.
 */

import { create } from 'zustand';
import type { UrlMetadata } from '@/lib/urlDetector/urlMetadataCache';
import { getCachedMetadata } from '@/lib/urlDetector/urlMetadataCache';
import { fetchUrlMetadataBatch } from './urlMetadataService';

/**
 * URL Metadata Store State
 */
interface UrlMetadataState {
  /** Metadata indexed by normalized URL */
  metadata: Map<string, UrlMetadata>;

  /** Set of URLs currently being fetched */
  loading: Set<string>;

  /** Errors indexed by normalized URL (for internal tracking) */
  errors: Map<string, string>;

  /** Get cached metadata for a URL (checks store, then localStorage) */
  getMetadata: (normalizedUrl: string) => UrlMetadata | null;

  /** Check if a URL is currently being fetched */
  isLoading: (normalizedUrl: string) => boolean;

  /** Fetch metadata for multiple URLs (checks cache first) */
  fetchMetadata: (normalizedUrls: string[]) => Promise<void>;

  /** Clear error for a specific URL */
  clearError: (normalizedUrl: string) => void;

  /** Batch check loading status for multiple URLs */
  getLoadingUrls: (normalizedUrls: string[]) => Set<string>;

  /** Batch get metadata for multiple URLs */
  getMetadataBatch: (normalizedUrls: string[]) => Map<string, UrlMetadata | null>;
}

export const useUrlMetadataStore = create<UrlMetadataState>((set, get) => ({
  metadata: new Map(),
  loading: new Set(),
  errors: new Map(),

  getMetadata: (normalizedUrl: string): UrlMetadata | null => {
    const state = get();

    // Check Zustand store first
    const storeMetadata = state.metadata.get(normalizedUrl);
    if (storeMetadata) {
      return storeMetadata;
    }

    // Check localStorage cache
    const cachedMetadata = getCachedMetadata(normalizedUrl);
    if (cachedMetadata) {
      // Hydrate into Zustand store for future access
      set((state) => {
        const newMetadata = new Map(state.metadata);
        newMetadata.set(normalizedUrl, cachedMetadata);
        return { metadata: newMetadata };
      });
      return cachedMetadata;
    }

    return null;
  },

  isLoading: (normalizedUrl: string): boolean => {
    return get().loading.has(normalizedUrl);
  },

  fetchMetadata: async (normalizedUrls: string[]): Promise<void> => {
    if (normalizedUrls.length === 0) {
      return;
    }

    // Deduplicate and filter already loaded/loading URLs
    const state = get();
    const urlsToFetch = normalizedUrls.filter((url) => {
      // Skip if already in store
      if (state.metadata.has(url)) {
        return false;
      }
      // Skip if currently loading
      if (state.loading.has(url)) {
        return false;
      }
      // Check localStorage cache
      const cached = getCachedMetadata(url);
      if (cached) {
        // Hydrate into store synchronously
        set((s) => {
          const newMetadata = new Map(s.metadata);
          newMetadata.set(url, cached);
          return { metadata: newMetadata };
        });
        return false;
      }
      return true;
    });

    if (urlsToFetch.length === 0) {
      return;
    }

    // Mark URLs as loading
    set((state) => {
      const newLoading = new Set(state.loading);
      for (const url of urlsToFetch) {
        newLoading.add(url);
      }
      return { loading: newLoading };
    });

    try {
      // Fetch from server (handles batching and caching internally)
      const results = await fetchUrlMetadataBatch(urlsToFetch);

      // Update store with results
      set((state) => {
        const newMetadata = new Map(state.metadata);
        const newLoading = new Set(state.loading);
        const newErrors = new Map(state.errors);

        for (const url of urlsToFetch) {
          // Remove from loading
          newLoading.delete(url);

          const result = results.get(url);
          if (result) {
            newMetadata.set(url, result);
            // Clear any previous error
            newErrors.delete(url);
          } else {
            // No result - server didn't return data for this URL
            newErrors.set(url, 'No metadata returned');
          }
        }

        return {
          metadata: newMetadata,
          loading: newLoading,
          errors: newErrors,
        };
      });
    } catch (error) {
      // Handle fetch error - clear loading state
      set((state) => {
        const newLoading = new Set(state.loading);
        const newErrors = new Map(state.errors);

        for (const url of urlsToFetch) {
          newLoading.delete(url);
          newErrors.set(
            url,
            error instanceof Error ? error.message : 'Failed to fetch metadata'
          );
        }

        return { loading: newLoading, errors: newErrors };
      });
    }
  },

  clearError: (normalizedUrl: string): void => {
    set((state) => {
      const newErrors = new Map(state.errors);
      newErrors.delete(normalizedUrl);
      return { errors: newErrors };
    });
  },

  getLoadingUrls: (normalizedUrls: string[]): Set<string> => {
    const state = get();
    const result = new Set<string>();
    for (const url of normalizedUrls) {
      if (state.loading.has(url)) {
        result.add(url);
      }
    }
    return result;
  },

  getMetadataBatch: (normalizedUrls: string[]): Map<string, UrlMetadata | null> => {
    const state = get();
    const result = new Map<string, UrlMetadata | null>();

    for (const url of normalizedUrls) {
      // Check Zustand store first
      const storeMetadata = state.metadata.get(url);
      if (storeMetadata) {
        result.set(url, storeMetadata);
        continue;
      }

      // Check localStorage cache
      const cachedMetadata = getCachedMetadata(url);
      if (cachedMetadata) {
        result.set(url, cachedMetadata);
        // Note: We don't hydrate here to avoid triggering re-render loops
        // The single getMetadata call will hydrate when accessed directly
      } else {
        result.set(url, null);
      }
    }

    return result;
  },
}));

/**
 * Selector for getting metadata for a single URL.
 * Use this in components for reactive updates.
 *
 * @example
 * const metadata = useUrlMetadataStore(selectMetadata("https://example.com"));
 */
export function selectMetadata(normalizedUrl: string) {
  return (state: UrlMetadataState) => state.metadata.get(normalizedUrl) ?? null;
}

/**
 * Selector for checking if a URL is loading.
 *
 * @example
 * const isLoading = useUrlMetadataStore(selectIsLoading("https://example.com"));
 */
export function selectIsLoading(normalizedUrl: string) {
  return (state: UrlMetadataState) => state.loading.has(normalizedUrl);
}

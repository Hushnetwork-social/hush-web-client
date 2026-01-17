/**
 * Link Previews Hook
 *
 * React hook for managing link previews in messages.
 * Handles URL detection, caching, and metadata fetching.
 */

import { useEffect, useMemo, useRef } from 'react';
import { detectUrls, type ParsedUrl } from '@/lib/urlDetector/urlDetector';
import { useUrlMetadataStore } from '@/modules/urlMetadata';
import type { UrlMetadata } from '@/lib/urlDetector/urlMetadataCache';

interface UseLinkPreviewsResult {
  /** Parsed URLs found in the content */
  urls: ParsedUrl[];

  /** Map of normalized URL to metadata (null if not yet loaded) */
  metadataMap: Map<string, UrlMetadata | null>;

  /** Set of URLs currently being fetched */
  loadingUrls: Set<string>;

  /** Whether any URLs are still loading */
  isLoading: boolean;

  /** Whether there are any URLs to display previews for */
  hasUrls: boolean;
}

/**
 * Hook for managing link previews in a message.
 *
 * @param content - The message content to parse for URLs
 * @param enabled - Whether to enable link preview fetching (default: true)
 * @returns Object containing URLs, metadata, and loading states
 *
 * @example
 * function MessageBubble({ content }: { content: string }) {
 *   const { urls, metadataMap, loadingUrls, hasUrls } = useLinkPreviews(content);
 *
 *   if (!hasUrls) return null;
 *
 *   return (
 *     <LinkPreviewCarousel
 *       urls={urls}
 *       metadataMap={metadataMap}
 *       loadingUrls={loadingUrls}
 *     />
 *   );
 * }
 */
export function useLinkPreviews(
  content: string,
  enabled: boolean = true
): UseLinkPreviewsResult {
  // Parse URLs from content (memoized)
  const urls = useMemo(() => {
    if (!enabled || !content) {
      return [];
    }
    return detectUrls(content);
  }, [content, enabled]);

  // Get store actions
  const fetchMetadata = useUrlMetadataStore((state) => state.fetchMetadata);

  // Subscribe to store changes for these specific URLs
  const normalizedUrls = useMemo(
    () => urls.map((u) => u.normalizedUrl),
    [urls]
  );

  // Track which URLs we've already triggered fetching for
  const fetchedUrlsRef = useRef<Set<string>>(new Set());

  // Subscribe to store state for reactivity
  const storeMetadata = useUrlMetadataStore((state) => state.metadata);
  const storeLoading = useUrlMetadataStore((state) => state.loading);

  // Compute metadata map from store (reactive)
  const reactiveMetadataMap = useMemo(() => {
    if (normalizedUrls.length === 0) {
      return new Map<string, UrlMetadata | null>();
    }
    const result = new Map<string, UrlMetadata | null>();
    for (const url of normalizedUrls) {
      result.set(url, storeMetadata.get(url) ?? null);
    }
    return result;
  }, [normalizedUrls, storeMetadata]);

  const reactiveLoadingUrls = useMemo(() => {
    const result = new Set<string>();
    for (const url of normalizedUrls) {
      if (storeLoading.has(url)) {
        result.add(url);
      }
    }
    return result;
  }, [normalizedUrls, storeLoading]);

  // Trigger fetch for uncached URLs
  useEffect(() => {
    if (!enabled || normalizedUrls.length === 0) {
      return;
    }

    // Filter URLs that haven't been fetched yet
    const urlsToFetch = normalizedUrls.filter((url) => {
      // Skip if we've already triggered a fetch for this URL in this component
      if (fetchedUrlsRef.current.has(url)) {
        return false;
      }
      // Skip if already in store
      if (storeMetadata.has(url)) {
        return false;
      }
      // Skip if currently loading
      if (storeLoading.has(url)) {
        return false;
      }
      return true;
    });

    if (urlsToFetch.length > 0) {
      // Mark as fetched to prevent duplicate requests
      for (const url of urlsToFetch) {
        fetchedUrlsRef.current.add(url);
      }
      // Trigger async fetch
      fetchMetadata(urlsToFetch);
    }
  }, [enabled, normalizedUrls, fetchMetadata, storeMetadata, storeLoading]);

  // Compute derived values
  const isLoading = reactiveLoadingUrls.size > 0;
  const hasUrls = urls.length > 0;

  return {
    urls,
    metadataMap: reactiveMetadataMap,
    loadingUrls: reactiveLoadingUrls,
    isLoading,
    hasUrls,
  };
}

/**
 * Hook for batch fetching link previews for multiple messages.
 * Useful for virtualization scenarios where multiple messages become visible.
 *
 * @param messageContents - Array of message contents to parse
 * @param enabled - Whether to enable fetching
 *
 * @example
 * // In a virtualized list
 * const visibleMessages = messages.slice(startIndex, endIndex);
 * useBatchLinkPreviewFetch(visibleMessages.map(m => m.content));
 */
export function useBatchLinkPreviewFetch(
  messageContents: string[],
  enabled: boolean = true
): void {
  const fetchMetadata = useUrlMetadataStore((state) => state.fetchMetadata);
  const storeMetadata = useUrlMetadataStore((state) => state.metadata);
  const storeLoading = useUrlMetadataStore((state) => state.loading);

  // Track which URLs we've already triggered fetching for
  const fetchedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || messageContents.length === 0) {
      return;
    }

    // Parse all URLs from all messages
    const allUrls: string[] = [];
    for (const content of messageContents) {
      if (content) {
        const parsed = detectUrls(content);
        for (const url of parsed) {
          allUrls.push(url.normalizedUrl);
        }
      }
    }

    // Deduplicate
    const uniqueUrls = [...new Set(allUrls)];

    // Filter URLs that need fetching
    const urlsToFetch = uniqueUrls.filter((url) => {
      if (fetchedUrlsRef.current.has(url)) return false;
      if (storeMetadata.has(url)) return false;
      if (storeLoading.has(url)) return false;
      return true;
    });

    if (urlsToFetch.length > 0) {
      // Mark as fetched
      for (const url of urlsToFetch) {
        fetchedUrlsRef.current.add(url);
      }
      // Trigger fetch
      fetchMetadata(urlsToFetch);
    }
  }, [enabled, messageContents, fetchMetadata, storeMetadata, storeLoading]);
}

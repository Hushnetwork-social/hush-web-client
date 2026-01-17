/**
 * URL Metadata Service
 *
 * High-level service for fetching URL metadata with caching.
 * Coordinates gRPC calls and localStorage cache.
 */

import {
  getUrlMetadataBatch as grpcGetUrlMetadataBatch,
  getUrlMetadata as grpcGetUrlMetadata,
} from '@/lib/grpc/services/urlMetadata-binary';
import {
  getCachedMetadata,
  setCachedMetadata,
  getCachedMetadataBatch,
  type UrlMetadata,
} from '@/lib/urlDetector/urlMetadataCache';

/**
 * Fetch metadata for multiple URLs.
 * Checks localStorage cache first, then fetches missing URLs from server.
 *
 * @param normalizedUrls - Array of normalized URLs to fetch metadata for
 * @returns Map of URL to metadata (includes both cached and freshly fetched)
 *
 * @example
 * const metadata = await fetchUrlMetadataBatch([
 *   "https://example.com",
 *   "https://other.com/page"
 * ]);
 * const exampleMeta = metadata.get("https://example.com");
 */
export async function fetchUrlMetadataBatch(
  normalizedUrls: string[]
): Promise<Map<string, UrlMetadata>> {
  if (normalizedUrls.length === 0) {
    return new Map();
  }

  // Check cache first
  const cachedResults = getCachedMetadataBatch(normalizedUrls);
  const urlsToFetch = normalizedUrls.filter((url) => !cachedResults.has(url));

  // If all URLs are cached, return immediately
  if (urlsToFetch.length === 0) {
    return cachedResults;
  }

  // Fetch missing URLs from server (max 10 per batch)
  const results = new Map(cachedResults);

  try {
    // Split into batches of 10 (server limit)
    const batches: string[][] = [];
    for (let i = 0; i < urlsToFetch.length; i += 10) {
      batches.push(urlsToFetch.slice(i, i + 10));
    }

    // Fetch all batches in parallel
    const batchResponses = await Promise.all(
      batches.map((batch) => grpcGetUrlMetadataBatch(batch))
    );

    // Process responses
    for (const batchResults of batchResponses) {
      for (const result of batchResults) {
        const metadata: UrlMetadata = {
          url: result.url,
          domain: result.domain,
          title: result.title || null,
          description: result.description || null,
          imageUrl: result.imageUrl || null,
          imageBase64: result.imageBase64 || null,
          success: result.success,
          errorMessage: result.errorMessage || null,
        };

        // Store in results
        results.set(result.url, metadata);

        // Only cache successful results - don't cache failures so they can be retried
        if (metadata.success) {
          setCachedMetadata(result.url, metadata);
        }
      }
    }
  } catch (error) {
    console.error('[UrlMetadataService] Failed to fetch URL metadata:', error);
    // Return what we have (cached results)
  }

  return results;
}

/**
 * Fetch metadata for a single URL.
 * Checks localStorage cache first, then fetches from server if needed.
 *
 * @param normalizedUrl - The normalized URL to fetch metadata for
 * @returns The URL metadata, or null if fetch failed
 *
 * @example
 * const metadata = await fetchUrlMetadata("https://example.com");
 * if (metadata?.success) {
 *   console.log(metadata.title);
 * }
 */
export async function fetchUrlMetadata(
  normalizedUrl: string
): Promise<UrlMetadata | null> {
  // Check cache first
  const cached = getCachedMetadata(normalizedUrl);
  if (cached) {
    return cached;
  }

  // Fetch from server
  try {
    const response = await grpcGetUrlMetadata(normalizedUrl);

    const metadata: UrlMetadata = {
      url: normalizedUrl,
      domain: response.domain,
      title: response.title || null,
      description: response.description || null,
      imageUrl: response.imageUrl || null,
      imageBase64: response.imageBase64 || null,
      success: response.success,
      errorMessage: response.errorMessage || null,
    };

    // Only cache successful results - don't cache failures so they can be retried
    if (metadata.success) {
      setCachedMetadata(normalizedUrl, metadata);
    }

    return metadata;
  } catch (error) {
    console.error('[UrlMetadataService] Failed to fetch URL metadata:', error);
    return null;
  }
}

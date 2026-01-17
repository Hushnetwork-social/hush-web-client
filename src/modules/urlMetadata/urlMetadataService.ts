/**
 * URL Metadata Service
 *
 * High-level service for fetching URL metadata with caching.
 * Coordinates gRPC calls and localStorage cache.
 */

import { urlMetadataService } from '@/lib/grpc/services/urlMetadata';
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
      batches.map((batch) => urlMetadataService.getUrlMetadataBatch(batch))
    );

    // Process responses
    for (const response of batchResponses) {
      if (!response.Results) {
        continue;
      }

      for (const result of response.Results) {
        const metadata: UrlMetadata = {
          url: result.Url,
          domain: result.Domain,
          title: result.Title || null,
          description: result.Description || null,
          imageUrl: result.ImageUrl || null,
          imageBase64: result.ImageBase64 || null,
          success: result.Success,
          errorMessage: result.ErrorMessage || null,
        };

        // Store in results
        results.set(result.Url, metadata);

        // Cache the result (even failures, to avoid repeated requests)
        setCachedMetadata(result.Url, metadata);
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
    const response = await urlMetadataService.getUrlMetadata(normalizedUrl);

    const metadata: UrlMetadata = {
      url: normalizedUrl,
      domain: response.Domain,
      title: response.Title || null,
      description: response.Description || null,
      imageUrl: response.ImageUrl || null,
      imageBase64: response.ImageBase64 || null,
      success: response.Success,
      errorMessage: response.ErrorMessage || null,
    };

    // Cache the result
    setCachedMetadata(normalizedUrl, metadata);

    return metadata;
  } catch (error) {
    console.error('[UrlMetadataService] Failed to fetch URL metadata:', error);
    return null;
  }
}

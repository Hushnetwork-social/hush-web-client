/**
 * URL Metadata Cache Module
 *
 * Client-side cache for URL metadata using localStorage.
 * Enables fast loading of previously fetched link previews.
 */

/**
 * Metadata for a URL, returned from the server
 */
export interface UrlMetadata {
  /** The URL this metadata is for */
  url: string;
  /** Domain name (e.g., "example.com") */
  domain: string;
  /** Page title from og:title or <title> tag */
  title: string | null;
  /** Page description from og:description or meta description */
  description: string | null;
  /** Image URL from og:image */
  imageUrl: string | null;
  /** Base64 encoded thumbnail image (resized by server) */
  imageBase64: string | null;
  /** Whether the fetch was successful */
  success: boolean;
  /** Error message if fetch failed */
  errorMessage: string | null;
}

/**
 * Internal structure for a cache entry
 */
interface CacheEntry {
  metadata: UrlMetadata;
  cachedAt: number; // Unix timestamp in milliseconds
}

// Storage key prefix for URL metadata cache
const STORAGE_KEY_PREFIX = 'hush-url-meta:';

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Simple hash function for generating cache keys.
 * Uses a fast FNV-1a inspired algorithm instead of MD5 for simplicity.
 *
 * @param str - The string to hash
 * @returns A hexadecimal hash string
 */
function simpleHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, keep as 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Generates the localStorage key for a URL.
 *
 * @param normalizedUrl - The normalized URL to generate a key for
 * @returns The localStorage key
 */
function getCacheKey(normalizedUrl: string): string {
  return STORAGE_KEY_PREFIX + simpleHash(normalizedUrl);
}

/**
 * Checks if localStorage is available.
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets cached metadata for a URL.
 * Returns null if not found or expired.
 * Automatically removes expired entries.
 *
 * @param normalizedUrl - The normalized URL to look up
 * @returns The cached metadata, or null if not found/expired
 *
 * @example
 * const metadata = getCachedMetadata("https://example.com");
 * if (metadata) {
 *   // Use cached data
 * } else {
 *   // Fetch from server
 * }
 */
export function getCachedMetadata(normalizedUrl: string): UrlMetadata | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const key = getCacheKey(normalizedUrl);
    const data = localStorage.getItem(key);

    if (!data) {
      return null;
    }

    const entry = JSON.parse(data) as CacheEntry;
    const now = Date.now();

    // Check if expired
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      // Remove expired entry
      localStorage.removeItem(key);
      return null;
    }

    return entry.metadata;
  } catch {
    return null;
  }
}

/**
 * Stores metadata in the cache.
 * Silently fails if localStorage is full or unavailable.
 *
 * @param normalizedUrl - The normalized URL as the cache key
 * @param metadata - The metadata to cache
 *
 * @example
 * setCachedMetadata("https://example.com", {
 *   url: "https://example.com",
 *   domain: "example.com",
 *   title: "Example Page",
 *   description: "An example description",
 *   imageUrl: null,
 *   imageBase64: null,
 *   success: true,
 *   errorMessage: null,
 * });
 */
export function setCachedMetadata(normalizedUrl: string, metadata: UrlMetadata): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const key = getCacheKey(normalizedUrl);
    const entry: CacheEntry = {
      metadata,
      cachedAt: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    // Silently fail if localStorage is full
    // Could implement LRU eviction here if needed
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      // Try to clean up some old entries
      cleanupExpiredEntries();
    }
  }
}

/**
 * Removes a specific URL from the cache.
 *
 * @param normalizedUrl - The normalized URL to remove
 */
export function removeCachedMetadata(normalizedUrl: string): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const key = getCacheKey(normalizedUrl);
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

/**
 * Checks if a URL is cached (and not expired).
 *
 * @param normalizedUrl - The normalized URL to check
 * @returns True if the URL is cached and not expired
 */
export function isCached(normalizedUrl: string): boolean {
  return getCachedMetadata(normalizedUrl) !== null;
}

/**
 * Gets cached metadata for multiple URLs at once.
 *
 * @param normalizedUrls - Array of normalized URLs to look up
 * @returns Map of URL to metadata (only includes cached entries)
 */
export function getCachedMetadataBatch(normalizedUrls: string[]): Map<string, UrlMetadata> {
  const result = new Map<string, UrlMetadata>();

  for (const url of normalizedUrls) {
    const metadata = getCachedMetadata(url);
    if (metadata) {
      result.set(url, metadata);
    }
  }

  return result;
}

/**
 * Cleans up expired entries from the cache.
 * Called automatically when storage quota is exceeded.
 */
export function cleanupExpiredEntries(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const entry = JSON.parse(data) as CacheEntry;
            if (now - entry.cachedAt > CACHE_TTL_MS) {
              keysToRemove.push(key);
            }
          } catch {
            // Invalid entry, remove it
            keysToRemove.push(key);
          }
        }
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Clears all URL metadata from the cache.
 * Useful for testing or manual cache invalidation.
 */
export function clearAllCachedMetadata(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Silently fail
  }
}

/**
 * URL Detector Module
 *
 * Utility functions for detecting and extracting URLs from message content.
 * Used to enable link previews for URLs in chat messages.
 */

/**
 * Represents a detected URL from message content
 */
export interface ParsedUrl {
  /** The detected URL as it appears in text */
  url: string;
  /** Normalized URL for caching (lowercase, no trailing slash) */
  normalizedUrl: string;
  /** Start position of the URL in the original text */
  startIndex: number;
  /** End position of the URL in the original text */
  endIndex: number;
  /** The raw matched text */
  raw: string;
}

/**
 * Regex pattern to match URLs with http://, https://, or www. prefix
 *
 * Matches:
 * - https://example.com
 * - http://example.com
 * - www.example.com
 * - URLs with paths, query strings, fragments
 * - URLs with parentheses (e.g., Wikipedia links)
 *
 * Does NOT match:
 * - example.com (bare domain without protocol or www)
 * - localhost URLs (no TLD)
 *
 * URL character class includes: alphanumerics, dots, hyphens, underscores,
 * tildes, percent encoding, slashes, query strings, fragments, parentheses, etc.
 */
const URL_PATTERN = /(?:https?:\/\/|www\.)[a-zA-Z0-9][-a-zA-Z0-9@:%._+~#=]{0,255}\.[a-zA-Z]{2,}[-a-zA-Z0-9@:%_+.~#?&/=()']*/gi;

/**
 * Characters that commonly appear at the end of URLs in sentences
 * but are not actually part of the URL
 */
const TRAILING_PUNCTUATION = /[.,;:!?>\]}"']+$/;

/**
 * Normalizes a URL for use as a cache key.
 * Converts to lowercase and removes trailing slashes.
 *
 * @param url - The URL to normalize
 * @returns The normalized URL
 *
 * @example
 * normalizeUrl("https://Example.Com/Page/")
 * // Returns: "https://example.com/page"
 */
export function normalizeUrl(url: string): string {
  let normalized = url.toLowerCase();

  // Add https:// protocol if URL starts with www.
  if (normalized.startsWith('www.')) {
    normalized = 'https://' + normalized;
  }

  // Remove trailing slash
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Cleans trailing punctuation from a matched URL.
 * Handles cases like "Visit https://example.com." where the period
 * is part of the sentence, not the URL.
 *
 * @param url - The matched URL that may have trailing punctuation
 * @returns The cleaned URL
 */
function cleanTrailingPunctuation(url: string): string {
  let result = url;

  // First, remove standard trailing punctuation (not including parentheses)
  result = result.replace(TRAILING_PUNCTUATION, '');

  // Special handling for parentheses - only remove trailing ) if unbalanced
  // Count open and close parens in the URL
  const openParens = (result.match(/\(/g) || []).length;
  const closeParens = (result.match(/\)/g) || []).length;

  // If more closing parens than opening, the extra ones are likely sentence punctuation
  let excessClose = closeParens - openParens;
  while (excessClose > 0 && result.endsWith(')')) {
    result = result.slice(0, -1);
    excessClose--;
  }

  return result;
}

/**
 * Detects and extracts all URLs from message text.
 *
 * @param text - The message text to search for URLs
 * @returns Array of parsed URLs with positions and normalized versions
 *
 * @example
 * detectUrls("Check out https://example.com/article today")
 * // Returns: [{
 * //   url: "https://example.com/article",
 * //   normalizedUrl: "https://example.com/article",
 * //   startIndex: 10,
 * //   endIndex: 38,
 * //   raw: "https://example.com/article"
 * // }]
 */
export function detectUrls(text: string): ParsedUrl[] {
  const urls: ParsedUrl[] = [];

  // Create a new regex instance to ensure fresh lastIndex
  const pattern = new RegExp(URL_PATTERN.source, 'gi');

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const rawMatch = match[0];
    const cleanedUrl = cleanTrailingPunctuation(rawMatch);

    // Skip if the cleaned URL is empty or too short
    if (cleanedUrl.length < 4) {
      continue;
    }

    // Calculate the actual end index after cleaning
    const startIndex = match.index;
    const endIndex = startIndex + cleanedUrl.length;

    urls.push({
      url: cleanedUrl,
      normalizedUrl: normalizeUrl(cleanedUrl),
      startIndex,
      endIndex,
      raw: cleanedUrl,
    });
  }

  return urls;
}

/**
 * Removes duplicate URLs from an array, keeping the first occurrence.
 * Comparison is done using the normalized URL.
 *
 * @param urls - Array of parsed URLs
 * @returns Array with duplicates removed
 *
 * @example
 * const urls = detectUrls("Check https://Example.com and https://example.com/")
 * deduplicateUrls(urls)
 * // Returns only one URL (first occurrence)
 */
export function deduplicateUrls(urls: ParsedUrl[]): ParsedUrl[] {
  const seen = new Set<string>();
  const unique: ParsedUrl[] = [];

  for (const url of urls) {
    if (!seen.has(url.normalizedUrl)) {
      seen.add(url.normalizedUrl);
      unique.push(url);
    }
  }

  return unique;
}

/**
 * Checks if a string contains any detectable URLs.
 *
 * @param text - The text to check
 * @returns True if the text contains at least one URL
 */
export function hasUrls(text: string): boolean {
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  return pattern.test(text);
}

/**
 * Extracts unique normalized URLs from text.
 * Convenience function combining detectUrls and deduplicateUrls.
 *
 * @param text - The text to extract URLs from
 * @returns Array of unique normalized URLs (strings only)
 *
 * @example
 * extractUniqueUrls("Visit https://a.com and https://b.com and https://a.com")
 * // Returns: ["https://a.com", "https://b.com"]
 */
export function extractUniqueUrls(text: string): string[] {
  const urls = detectUrls(text);
  const unique = deduplicateUrls(urls);
  return unique.map(u => u.normalizedUrl);
}

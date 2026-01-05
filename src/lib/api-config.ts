/**
 * API Configuration
 *
 * Determines the correct API base URL based on the environment:
 * - Browser (development): Relative URLs (/api/...)
 * - Browser (production): Relative URLs (/api/...)
 * - Tauri (desktop app): Uses NEXT_PUBLIC_API_URL or falls back to production URL
 */

// Check if running in Tauri
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

// API URL for Tauri desktop app - configurable via environment variable
// Falls back to production URL if not set
// NOTE: process.env.NEXT_PUBLIC_* values are inlined at build time by Next.js
const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL;
const DEFAULT_PRODUCTION_URL = 'https://chat.hushnetwork.social';

// Log configuration on first load (client-side only)
if (typeof window !== 'undefined') {
  console.log('[api-config] NEXT_PUBLIC_API_URL:', CONFIGURED_API_URL || '(not set)');
  console.log('[api-config] isTauri:', isTauri());
}

/**
 * Get the base URL for API calls
 * - Returns empty string for browser (uses relative URLs)
 * - Returns configured URL for Tauri (from NEXT_PUBLIC_API_URL or default)
 */
export function getApiBaseUrl(): string {
  if (isTauri()) {
    // In Tauri, we need an absolute URL
    // Use configured URL, or fallback to production
    return CONFIGURED_API_URL || DEFAULT_PRODUCTION_URL;
  }
  // In browser, use relative URLs (works with same-origin)
  return '';
}

/**
 * Build a full API URL
 * @param path - API path starting with /api/...
 * @returns Full URL for the API endpoint
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const fullUrl = `${baseUrl}${path}`;

  // Debug logging for Tauri troubleshooting
  if (typeof window !== 'undefined' && isTauri()) {
    console.log(`[api-config] buildApiUrl: ${path} -> ${fullUrl}`);
  }

  return fullUrl;
}

/**
 * Build a full URL for static assets (files in public directory)
 * @param path - Asset path starting with / (e.g., /crypto/bsgs-table.bin)
 * @returns Full URL for the static asset
 */
export function buildAssetUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  const fullUrl = `${baseUrl}${path}`;

  // Debug logging for Tauri troubleshooting
  if (typeof window !== 'undefined' && isTauri()) {
    console.log(`[api-config] buildAssetUrl: ${path} -> ${fullUrl}`);
  }

  return fullUrl;
}

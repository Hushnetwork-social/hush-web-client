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
const TAURI_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chat.hushnetwork.social';

/**
 * Get the base URL for API calls
 * - Returns empty string for browser (uses relative URLs)
 * - Returns configured URL for Tauri (from NEXT_PUBLIC_API_URL or default)
 */
export function getApiBaseUrl(): string {
  if (isTauri()) {
    return TAURI_API_URL;
  }
  return '';
}

/**
 * Build a full API URL
 * @param path - API path starting with /api/...
 * @returns Full URL for the API endpoint
 */
export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path}`;
}

/**
 * API Configuration
 *
 * Determines the correct API base URL based on the environment:
 * - Browser (development): Relative URLs (/api/...)
 * - Browser (production): Relative URLs (/api/...)
 * - Tauri (desktop app): Hosted API URL (https://chat.hushnetwork.social)
 */

// Check if running in Tauri
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

// Hosted API URL for Tauri desktop app
const HOSTED_API_URL = 'https://chat.hushnetwork.social';

/**
 * Get the base URL for API calls
 * - Returns empty string for browser (uses relative URLs)
 * - Returns hosted URL for Tauri
 */
export function getApiBaseUrl(): string {
  if (isTauri()) {
    return HOSTED_API_URL;
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

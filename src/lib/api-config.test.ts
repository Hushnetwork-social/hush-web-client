/**
 * API Configuration Tests
 *
 * Tests for the api-config module that handles API URL construction
 * for both browser and Tauri desktop environments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock window before importing the module
const originalWindow = global.window;

describe('api-config', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure fresh state
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original window
    global.window = originalWindow;
  });

  describe('isTauri', () => {
    it('returns false when window is undefined (SSR)', async () => {
      // @ts-expect-error - Simulating SSR environment
      global.window = undefined;

      const { isTauri } = await import('./api-config');
      expect(isTauri()).toBe(false);
    });

    it('returns false when not in Tauri environment', async () => {
      // Mock window without Tauri markers
      global.window = {} as Window & typeof globalThis;

      const { isTauri } = await import('./api-config');
      expect(isTauri()).toBe(false);
    });

    it('returns true when __TAURI__ is present', async () => {
      // Mock window with __TAURI__
      global.window = {
        __TAURI__: {},
      } as unknown as Window & typeof globalThis;

      const { isTauri } = await import('./api-config');
      expect(isTauri()).toBe(true);
    });

    it('returns true when __TAURI_INTERNALS__ is present', async () => {
      // Mock window with __TAURI_INTERNALS__
      global.window = {
        __TAURI_INTERNALS__: {},
      } as unknown as Window & typeof globalThis;

      const { isTauri } = await import('./api-config');
      expect(isTauri()).toBe(true);
    });
  });

  describe('getApiBaseUrl', () => {
    it('returns empty string for browser environment', async () => {
      // Mock browser window (no Tauri markers)
      global.window = {} as Window & typeof globalThis;

      const { getApiBaseUrl } = await import('./api-config');
      expect(getApiBaseUrl()).toBe('');
    });

    it('returns default production URL for Tauri when NEXT_PUBLIC_API_URL is not set', async () => {
      // Mock Tauri environment
      global.window = {
        __TAURI__: {},
      } as unknown as Window & typeof globalThis;

      // Ensure env var is not set
      vi.stubEnv('NEXT_PUBLIC_API_URL', '');

      vi.resetModules();
      const { getApiBaseUrl } = await import('./api-config');

      // Should return the default production URL
      expect(getApiBaseUrl()).toBe('https://chat.hushnetwork.social');
    });
  });

  describe('buildApiUrl', () => {
    it('returns relative URL for browser environment', async () => {
      // Mock browser window
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      expect(buildApiUrl('/api/identity/search')).toBe('/api/identity/search');
    });

    it('returns relative URL with query params for browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      expect(buildApiUrl('/api/identity/search?name=test')).toBe('/api/identity/search?name=test');
    });

    it('returns absolute URL for Tauri with production fallback', async () => {
      // Mock Tauri environment
      global.window = {
        __TAURI__: {},
      } as unknown as Window & typeof globalThis;

      vi.stubEnv('NEXT_PUBLIC_API_URL', '');
      vi.resetModules();

      const { buildApiUrl } = await import('./api-config');
      expect(buildApiUrl('/api/identity/search')).toBe('https://chat.hushnetwork.social/api/identity/search');
    });

    it('handles paths without leading slash', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      // buildApiUrl expects path to start with /
      expect(buildApiUrl('api/identity/search')).toBe('api/identity/search');
    });
  });

  describe('URL construction for API routes', () => {
    it('constructs correct identity search URL for browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const query = 'john';
      const url = buildApiUrl(`/api/identity/search?name=${encodeURIComponent(query)}`);

      expect(url).toBe('/api/identity/search?name=john');
    });

    it('constructs correct identity check URL for browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const address = 'abc123';
      const url = buildApiUrl(`/api/identity/check?address=${encodeURIComponent(address)}`);

      expect(url).toBe('/api/identity/check?address=abc123');
    });

    it('constructs correct groups add-member URL for browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const url = buildApiUrl('/api/groups/add-member');

      expect(url).toBe('/api/groups/add-member');
    });

    it('constructs correct groups members URL for browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const feedId = 'feed-123';
      const url = buildApiUrl(`/api/groups/members?feedId=${encodeURIComponent(feedId)}`);

      expect(url).toBe('/api/groups/members?feedId=feed-123');
    });

    it('constructs correct groups key-generations URL for browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const feedId = 'feed-123';
      const userAddress = 'user-456';
      const url = buildApiUrl(`/api/groups/key-generations?feedId=${encodeURIComponent(feedId)}&userAddress=${encodeURIComponent(userAddress)}`);

      expect(url).toBe('/api/groups/key-generations?feedId=feed-123&userAddress=user-456');
    });

    it('constructs absolute URLs for Tauri with default production URL', async () => {
      global.window = {
        __TAURI__: {},
      } as unknown as Window & typeof globalThis;

      vi.stubEnv('NEXT_PUBLIC_API_URL', '');
      vi.resetModules();

      const { buildApiUrl } = await import('./api-config');
      const query = 'john';
      const url = buildApiUrl(`/api/identity/search?name=${encodeURIComponent(query)}`);

      expect(url).toBe('https://chat.hushnetwork.social/api/identity/search?name=john');
    });
  });

  describe('special characters handling', () => {
    it('handles URL-encoded characters correctly', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const nameWithSpaces = 'John Doe';
      const url = buildApiUrl(`/api/identity/search?name=${encodeURIComponent(nameWithSpaces)}`);

      expect(url).toBe('/api/identity/search?name=John%20Doe');
    });

    it('handles special characters in feed IDs', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildApiUrl } = await import('./api-config');
      const feedId = 'feed+id/with=chars';
      const url = buildApiUrl(`/api/groups/members?feedId=${encodeURIComponent(feedId)}`);

      expect(url).toBe('/api/groups/members?feedId=feed%2Bid%2Fwith%3Dchars');
    });
  });

  describe('buildAssetUrl', () => {
    it('returns relative URL for static assets in browser', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildAssetUrl } = await import('./api-config');
      expect(buildAssetUrl('/crypto/bsgs-table.bin')).toBe('/crypto/bsgs-table.bin');
    });

    it('returns absolute URL for static assets in Tauri', async () => {
      global.window = {
        __TAURI__: {},
      } as unknown as Window & typeof globalThis;

      vi.stubEnv('NEXT_PUBLIC_API_URL', '');
      vi.resetModules();

      const { buildAssetUrl } = await import('./api-config');
      expect(buildAssetUrl('/crypto/bsgs-table.bin')).toBe('https://chat.hushnetwork.social/crypto/bsgs-table.bin');
    });

    it('handles circuit files path correctly', async () => {
      global.window = {} as Window & typeof globalThis;

      const { buildAssetUrl } = await import('./api-config');
      const circuitVersion = 'omega-v1.0.0';
      const url = buildAssetUrl(`/circuits/${circuitVersion}/reaction.wasm`);

      expect(url).toBe('/circuits/omega-v1.0.0/reaction.wasm');
    });

    it('uses configured API URL for Tauri when available', async () => {
      global.window = {
        __TAURI__: {},
      } as unknown as Window & typeof globalThis;

      vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3100');
      vi.resetModules();

      const { buildAssetUrl } = await import('./api-config');
      expect(buildAssetUrl('/crypto/bsgs-table.bin')).toBe('http://localhost:3100/crypto/bsgs-table.bin');
    });
  });
});

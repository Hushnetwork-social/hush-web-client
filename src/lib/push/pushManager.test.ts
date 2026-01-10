/**
 * Push Manager Tests
 *
 * Tests for the push notification manager that handles
 * FCM/APNs token registration and initialization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock platform detection
vi.mock('@/lib/platform', () => ({
  detectPlatformAsync: vi.fn(),
}));

// Mock gRPC notification service
vi.mock('@/lib/grpc/services/notification', () => ({
  registerDeviceToken: vi.fn(),
  PushPlatform: {
    UNSPECIFIED: 0,
    ANDROID: 1,
    IOS: 2,
    WEB: 3,
  },
}));

// Mock debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import {
  isPushSupported,
  getNotificationPermission,
  initializePush,
  handleTokenRefresh,
  cleanupPush,
  getCurrentToken,
} from './pushManager';
import { detectPlatformAsync } from '@/lib/platform';
import { registerDeviceToken, PushPlatform } from '@/lib/grpc/services/notification';
import { invoke } from '@tauri-apps/api/core';

describe('pushManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by cleaning up
    cleanupPush();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isPushSupported', () => {
    it('returns true for tauri-android platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');

      const result = await isPushSupported();

      expect(result).toBe(true);
    });

    it('returns true for tauri-ios platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-ios');

      const result = await isPushSupported();

      expect(result).toBe(true);
    });

    it('returns false for tauri desktop platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri');

      const result = await isPushSupported();

      expect(result).toBe(false);
    });

    it('returns false for browser platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('browser');

      const result = await isPushSupported();

      expect(result).toBe(false);
    });

    it('returns false for mobile-pwa platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('mobile-pwa');

      const result = await isPushSupported();

      expect(result).toBe(false);
    });
  });

  describe('getNotificationPermission', () => {
    it('returns granted for non-mobile platforms', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('browser');

      const result = await getNotificationPermission();

      expect(result).toEqual({ granted: true, can_request: false });
    });

    it('calls native permission check on Android', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockResolvedValue({ granted: true, can_request: false });

      const result = await getNotificationPermission();

      expect(invoke).toHaveBeenCalledWith('has_notification_permission');
      expect(result).toEqual({ granted: true, can_request: false });
    });

    it('handles permission check errors gracefully', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockRejectedValue(new Error('Native error'));

      const result = await getNotificationPermission();

      expect(result).toEqual({ granted: false, can_request: true });
    });
  });

  describe('initializePush', () => {
    const mockUserId = 'test-user-public-key-address';
    const mockToken = 'fcm-token-123456789';

    it('skips initialization on non-mobile platforms', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('browser');

      const result = await initializePush(mockUserId);

      expect(result).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
      expect(registerDeviceToken).not.toHaveBeenCalled();
    });

    it('initializes push successfully on Android', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: mockToken, error: null });
          case 'get_device_name':
            return Promise.resolve('Test Device');
          default:
            return Promise.reject(new Error(`Unknown command: ${cmd}`));
        }
      });
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: true, message: null });

      const result = await initializePush(mockUserId);

      expect(result).toBe(true);
      expect(registerDeviceToken).toHaveBeenCalledWith(
        mockUserId,
        PushPlatform.ANDROID,
        mockToken,
        'Test Device'
      );
    });

    it('fails when permission is not granted', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockResolvedValue({ granted: false, can_request: true });

      const result = await initializePush(mockUserId);

      expect(result).toBe(false);
      expect(registerDeviceToken).not.toHaveBeenCalled();
    });

    it('fails when token retrieval fails', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: null, error: 'Token not available' });
          default:
            return Promise.resolve(null);
        }
      });

      const result = await initializePush(mockUserId);

      expect(result).toBe(false);
      expect(registerDeviceToken).not.toHaveBeenCalled();
    });

    it('fails when server registration fails', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: mockToken, error: null });
          case 'get_device_name':
            return Promise.resolve('Test Device');
          default:
            return Promise.resolve(null);
        }
      });
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: false, message: 'Server error' });

      const result = await initializePush(mockUserId);

      expect(result).toBe(false);
    });

    it('returns true and skips if already initialized', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: mockToken, error: null });
          case 'get_device_name':
            return Promise.resolve('Test Device');
          default:
            return Promise.resolve(null);
        }
      });
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: true, message: null });

      // First initialization
      await initializePush(mockUserId);

      // Clear mock calls
      vi.clearAllMocks();

      // Second initialization should skip
      const result = await initializePush(mockUserId);

      expect(result).toBe(true);
      expect(registerDeviceToken).not.toHaveBeenCalled();
    });
  });

  describe('handleTokenRefresh', () => {
    const mockUserId = 'test-user-public-key-address';
    const mockToken = 'fcm-token-123456789';
    const mockNewToken = 'fcm-token-new-987654321';

    it('registers new token when token changes', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockResolvedValue('Test Device');
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: true, message: null });

      const result = await handleTokenRefresh(mockUserId, mockNewToken);

      expect(result).toBe(true);
      expect(registerDeviceToken).toHaveBeenCalledWith(
        mockUserId,
        PushPlatform.ANDROID,
        mockNewToken,
        'Test Device'
      );
    });

    it('skips registration when token is unchanged', async () => {
      // First, set up current token by initializing
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: mockToken, error: null });
          case 'get_device_name':
            return Promise.resolve('Test Device');
          default:
            return Promise.resolve(null);
        }
      });
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: true, message: null });

      await initializePush(mockUserId);
      vi.clearAllMocks();

      // Try to refresh with same token
      const result = await handleTokenRefresh(mockUserId, mockToken);

      expect(result).toBe(true);
      expect(registerDeviceToken).not.toHaveBeenCalled();
    });
  });

  describe('cleanupPush', () => {
    it('resets initialization state', async () => {
      // First initialize
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: 'test-token', error: null });
          case 'get_device_name':
            return Promise.resolve('Test Device');
          default:
            return Promise.resolve(null);
        }
      });
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: true, message: null });

      await initializePush('test-user');

      // Clean up
      cleanupPush();

      // Verify token is cleared
      expect(getCurrentToken()).toBe(null);
    });
  });

  describe('getCurrentToken', () => {
    it('returns null when not initialized', () => {
      expect(getCurrentToken()).toBe(null);
    });

    it('returns token after successful initialization', async () => {
      const mockToken = 'fcm-token-123';
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'has_notification_permission':
            return Promise.resolve({ granted: true, can_request: false });
          case 'get_fcm_token':
            return Promise.resolve({ token: mockToken, error: null });
          case 'get_device_name':
            return Promise.resolve('Test Device');
          default:
            return Promise.resolve(null);
        }
      });
      vi.mocked(registerDeviceToken).mockResolvedValue({ success: true, message: null });

      await initializePush('test-user');

      expect(getCurrentToken()).toBe(mockToken);
    });
  });
});

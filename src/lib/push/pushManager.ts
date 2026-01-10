/**
 * Push Manager
 *
 * Handles push notification initialization and token registration for mobile platforms.
 * This module provides a unified interface for FCM (Android) and APNs (iOS) push notifications.
 *
 * Architecture:
 * - On Android: Uses JavaScript bridge (window.HushNative) to communicate with Kotlin
 * - On iOS: Uses Tauri commands to communicate with Swift (future)
 * - Registers tokens with the server via gRPC
 * - Handles token refresh automatically
 */

import { detectPlatformAsync, type Platform } from '@/lib/platform';
import { registerDeviceToken, PushPlatform, type PushPlatformType } from '@/lib/grpc/services/notification';
import { debugLog, debugError } from '@/lib/debug-logger';

// Types for Tauri command responses (matching Rust types)
interface FcmTokenResult {
  token: string | null;
  error: string | null;
}

interface PermissionResult {
  granted: boolean;
  can_request: boolean;
}

/**
 * HushNative JavaScript bridge interface.
 * This interface is injected by Kotlin on Android via WebView.addJavascriptInterface().
 * Methods are synchronous because JavascriptInterface methods are synchronous.
 */
interface HushNativeBridge {
  getFcmToken(): string;
  getDeviceName(): string;
  hasNotificationPermission(): boolean;
  isPushSupported(): boolean;
  getPlatform(): string;
  getPendingNavigation(): string;
  clearPendingNavigation(): void;
}

// Extend Window interface to include the native bridge
declare global {
  interface Window {
    HushNative?: HushNativeBridge;
  }
}

/**
 * Check if the HushNative JavaScript bridge is available.
 * This is only available on Android when running in Tauri WebView.
 */
function hasNativeBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.HushNative !== 'undefined';
}

// Push registration state
let isInitialized = false;
let currentToken: string | null = null;

/**
 * Check if push notifications are supported on the current platform.
 * On Android: Uses the JavaScript bridge.
 * On iOS: Will use Tauri commands (future).
 */
export async function isPushSupported(): Promise<boolean> {
  // First try the JavaScript bridge (Android)
  if (hasNativeBridge()) {
    debugLog('[PushManager] Using HushNative bridge for isPushSupported');
    return window.HushNative!.isPushSupported();
  }

  // Fall back to platform detection
  const platform = await detectPlatformAsync();
  return platform === 'tauri-android' || platform === 'tauri-ios';
}

/**
 * Get the current notification permission status.
 * On desktop, returns granted: true (no permission needed for local notifications).
 * On Android: Uses the JavaScript bridge.
 * On iOS: Will use Tauri commands (future).
 */
export async function getNotificationPermission(): Promise<PermissionResult> {
  // First try the JavaScript bridge (Android)
  if (hasNativeBridge()) {
    debugLog('[PushManager] Using HushNative bridge for hasNotificationPermission');
    const granted = window.HushNative!.hasNotificationPermission();
    return { granted, can_request: !granted };
  }

  // Fall back to platform check
  const platform = await detectPlatformAsync();

  if (platform !== 'tauri-android' && platform !== 'tauri-ios') {
    return { granted: true, can_request: false };
  }

  // iOS fallback - use Tauri commands
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<PermissionResult>('has_notification_permission');
  } catch (error) {
    debugError('[PushManager] Failed to get permission status:', error);
    return { granted: false, can_request: true };
  }
}

/**
 * Get the device name for token registration.
 * On Android: Uses the JavaScript bridge.
 * On iOS: Will use Tauri commands (future).
 */
async function getDeviceName(): Promise<string> {
  // First try the JavaScript bridge (Android)
  if (hasNativeBridge()) {
    debugLog('[PushManager] Using HushNative bridge for getDeviceName');
    return window.HushNative!.getDeviceName();
  }

  // iOS fallback - use Tauri commands
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('get_device_name');
  } catch (error) {
    debugError('[PushManager] Failed to get device name:', error);
    return 'Unknown Device';
  }
}

/**
 * Get the FCM/APNs token from native code.
 * Returns null if not available (e.g., on desktop or if not initialized).
 * On Android: Uses the JavaScript bridge to get token from Kotlin.
 * On iOS: Will use Tauri commands (future).
 */
async function getNativeToken(): Promise<FcmTokenResult> {
  // First try the JavaScript bridge (Android)
  if (hasNativeBridge()) {
    debugLog('[PushManager] Using HushNative bridge for getFcmToken');
    const token = window.HushNative!.getFcmToken();
    if (token && token.length > 0) {
      debugLog('[PushManager] Got FCM token from bridge:', token.substring(0, 20) + '...');
      return { token, error: null };
    } else {
      debugLog('[PushManager] No FCM token from bridge (empty string)');
      return { token: null, error: 'FCM token not available yet' };
    }
  }

  // iOS fallback - use Tauri commands
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<FcmTokenResult>('get_fcm_token');
  } catch (error) {
    debugError('[PushManager] Failed to get FCM token:', error);
    return { token: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Map platform to PushPlatform enum value.
 */
function platformToPushPlatform(platform: Platform): PushPlatformType {
  switch (platform) {
    case 'tauri-android':
      return PushPlatform.ANDROID;
    case 'tauri-ios':
      return PushPlatform.IOS;
    default:
      return PushPlatform.UNSPECIFIED;
  }
}

/**
 * Register the push token with the server.
 *
 * @param userId - The user's public signing address
 * @param token - The FCM/APNs token
 * @returns Promise resolving to success status
 */
async function registerTokenWithServer(userId: string, token: string): Promise<boolean> {
  const platform = await detectPlatformAsync();
  const pushPlatform = platformToPushPlatform(platform);
  const deviceName = await getDeviceName();

  debugLog(`[PushManager] Registering token with server:`, {
    userId: userId.substring(0, 20) + '...',
    platform: platform,
    pushPlatform: pushPlatform,
    deviceName: deviceName,
    token: token.substring(0, 20) + '...',
  });

  const result = await registerDeviceToken(userId, pushPlatform, token, deviceName);

  if (result.success) {
    debugLog('[PushManager] Token registered successfully');
    currentToken = token;
  } else {
    debugError('[PushManager] Token registration failed:', result.message);
  }

  return result.success;
}

/**
 * Initialize push notifications for the current user.
 * This should be called after the user logs in.
 *
 * @param userId - The user's public signing address
 * @returns Promise resolving to success status
 */
export async function initializePush(userId: string): Promise<boolean> {
  if (isInitialized) {
    debugLog('[PushManager] Already initialized, skipping');
    return true;
  }

  debugLog('[PushManager] Initializing push notifications');

  // Check if push is supported
  const supported = await isPushSupported();
  if (!supported) {
    debugLog('[PushManager] Push notifications not supported on this platform');
    return false;
  }

  // Check permission status
  const permission = await getNotificationPermission();
  if (!permission.granted) {
    debugLog('[PushManager] Notification permission not granted');
    // Permission request is handled by native code on app startup
    return false;
  }

  // Get the FCM token
  const tokenResult = await getNativeToken();
  if (!tokenResult.token) {
    debugError('[PushManager] Failed to get FCM token:', tokenResult.error);
    return false;
  }

  // Register with server
  const success = await registerTokenWithServer(userId, tokenResult.token);

  if (success) {
    isInitialized = true;
    debugLog('[PushManager] Push notifications initialized successfully');
  }

  return success;
}

/**
 * Handle token refresh. This should be called when the FCM service
 * reports a new token.
 *
 * @param userId - The user's public signing address
 * @param newToken - The new FCM token
 * @returns Promise resolving to success status
 */
export async function handleTokenRefresh(userId: string, newToken: string): Promise<boolean> {
  debugLog('[PushManager] Handling token refresh');

  if (newToken === currentToken) {
    debugLog('[PushManager] Token unchanged, skipping registration');
    return true;
  }

  return await registerTokenWithServer(userId, newToken);
}

/**
 * Cleanup push notifications (e.g., on logout).
 * This resets the initialization state but does not unregister the token
 * from the server (token will be invalidated on next login with new user).
 */
export function cleanupPush(): void {
  debugLog('[PushManager] Cleaning up push state');
  isInitialized = false;
  currentToken = null;
}

/**
 * Get the currently registered token (if any).
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Get pending feed navigation from a notification tap.
 * When a user taps a push notification, the feedId is stored by native code.
 * This retrieves that feedId so the app can navigate to the correct feed.
 *
 * @returns The feedId to navigate to, or null if none pending
 */
export function getPendingNavigation(): string | null {
  if (hasNativeBridge()) {
    const feedId = window.HushNative!.getPendingNavigation();
    if (feedId && feedId.length > 0) {
      debugLog('[PushManager] Got pending navigation:', feedId.substring(0, 8) + '...');
      return feedId;
    }
  }
  return null;
}

/**
 * Clear pending feed navigation after the app has processed it.
 * Call this after navigating to the feed to prevent re-navigation on next app open.
 */
export function clearPendingNavigation(): void {
  if (hasNativeBridge()) {
    debugLog('[PushManager] Clearing pending navigation');
    window.HushNative!.clearPendingNavigation();
  }
}

export const pushManager = {
  isPushSupported,
  getNotificationPermission,
  initializePush,
  handleTokenRefresh,
  cleanupPush,
  getCurrentToken,
  getPendingNavigation,
  clearPendingNavigation,
};

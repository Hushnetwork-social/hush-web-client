/**
 * Push Notifications Module
 *
 * Provides push notification functionality for mobile platforms (Android/iOS).
 */

export {
  pushManager,
  isPushSupported,
  getNotificationPermission,
  initializePush,
  handleTokenRefresh,
  cleanupPush,
  getCurrentToken,
} from './pushManager';

export {
  pushHandler,
  checkPendingNavigation,
  setupVisibilityChangeListener,
} from './pushHandler';

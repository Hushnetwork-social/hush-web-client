/**
 * Debug Logger Utility
 *
 * Provides conditional logging based on environment variables.
 * In development (npm run dev), all debug logs are shown.
 * In production, debug logs are hidden unless NEXT_PUBLIC_DEBUG_LOGGING is set to 'true'.
 *
 * Usage:
 *   import { debugLog, debugWarn, debugError } from '@/lib/debug-logger';
 *   debugLog('[MyModule]', 'Some debug message', { data });
 *
 * To enable debug logging in production:
 *   - Set environment variable: NEXT_PUBLIC_DEBUG_LOGGING=true
 *   - Rebuild and redeploy the application
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true';

/**
 * Check if debug logging is enabled at runtime.
 * Can be enabled via:
 * - NODE_ENV=development
 * - NEXT_PUBLIC_DEBUG_LOGGING=true (build-time)
 * - localStorage.setItem('HUSH_DEBUG', 'true') (runtime override)
 */
function checkDebugEnabled(): boolean {
  if (isDevelopment || isDebugEnabled) return true;

  // Runtime override via localStorage (useful for debugging production)
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('HUSH_DEBUG') === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Whether debug logging is currently enabled.
 * True in development mode, when NEXT_PUBLIC_DEBUG_LOGGING=true, or when localStorage HUSH_DEBUG=true
 */
export const isDebugLoggingEnabled = isDevelopment || isDebugEnabled;

// Use function for runtime checks
const shouldLog = (): boolean => checkDebugEnabled();

/**
 * Log a debug message to the console.
 * Only outputs when debug logging is enabled.
 */
export function debugLog(...args: unknown[]): void {
  if (shouldLog()) {
    console.log(...args);
  }
}

/**
 * Log a debug warning to the console.
 * Only outputs when debug logging is enabled.
 */
export function debugWarn(...args: unknown[]): void {
  if (shouldLog()) {
    console.warn(...args);
  }
}

/**
 * Log a debug error to the console.
 * Always outputs (errors should always be logged).
 */
export function debugError(...args: unknown[]): void {
  console.error(...args);
}

/**
 * Log an info message to the console.
 * Always outputs (important info should always be logged).
 */
export function infoLog(...args: unknown[]): void {
  console.log(...args);
}

/**
 * Create a namespaced logger for a specific module.
 *
 * Usage:
 *   const log = createLogger('[NotificationService]');
 *   log.debug('Connecting...');
 *   log.info('Connected successfully');
 */
export function createLogger(namespace: string) {
  return {
    debug: (...args: unknown[]) => debugLog(namespace, ...args),
    info: (...args: unknown[]) => infoLog(namespace, ...args),
    warn: (...args: unknown[]) => debugWarn(namespace, ...args),
    error: (...args: unknown[]) => debugError(namespace, ...args),
  };
}

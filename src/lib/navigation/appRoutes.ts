import type { AppId } from '@/stores/useAppStore';

export const FEEDS_HOME_ROUTE = '/feeds';
export const SOCIAL_HOME_ROUTE = '/social';
export const AUTH_ROUTE = '/auth';
export const LEGACY_DASHBOARD_ROUTE = '/dashboard';
export const LEGACY_COMMUNITY_ROUTE = '/community';

export function getAppHomeRoute(app: AppId): string {
  return app === 'social' ? SOCIAL_HOME_ROUTE : FEEDS_HOME_ROUTE;
}

export function getAppDisplayName(app: AppId): string {
  return app === 'social' ? 'HushSocial!' : 'HushFeeds!';
}

export function getFeedNavigationRoute(feedId: string): string {
  return `${FEEDS_HOME_ROUTE}?feed=${encodeURIComponent(feedId)}`;
}

export function resolveEntryRoute(isAuthenticated: boolean): string {
  return isAuthenticated ? FEEDS_HOME_ROUTE : AUTH_ROUTE;
}

export function normalizeLegacyAppRoute(pathname: string): string {
  if (pathname === LEGACY_DASHBOARD_ROUTE || pathname === LEGACY_COMMUNITY_ROUTE) {
    return FEEDS_HOME_ROUTE;
  }
  return pathname;
}

export function getActiveAppFromPath(pathname: string): AppId {
  if (pathname.startsWith(`${SOCIAL_HOME_ROUTE}/`) || pathname === SOCIAL_HOME_ROUTE) {
    return 'social';
  }
  return 'feeds';
}

export function shouldClearBadgesOnAppSwitch(): boolean {
  return false;
}

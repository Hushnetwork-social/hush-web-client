import type { AppId } from '@/stores/useAppStore';

export const FEEDS_HOME_ROUTE = '/feeds';
export const SOCIAL_HOME_ROUTE = '/social';
export const SOCIAL_POST_ROUTE = `${SOCIAL_HOME_ROUTE}/post`;
export const VOTING_HOME_ROUTE = '/elections';
export const AUTH_ROUTE = '/auth';
export const LEGACY_DASHBOARD_ROUTE = '/dashboard';

export function getAppHomeRoute(app: AppId): string {
  if (app === 'social') {
    return SOCIAL_HOME_ROUTE;
  }

  if (app === 'voting') {
    return VOTING_HOME_ROUTE;
  }

  return FEEDS_HOME_ROUTE;
}

export function getAppDisplayName(app: AppId): string {
  if (app === 'social') {
    return 'HushSocial!';
  }

  if (app === 'voting') {
    return 'HushVoting!';
  }

  return 'HushFeeds!';
}

export function getFeedNavigationRoute(feedId: string): string {
  return `${FEEDS_HOME_ROUTE}?feed=${encodeURIComponent(feedId)}`;
}

export function getSocialPostRoute(postId: string): string {
  return `${SOCIAL_POST_ROUTE}/${encodeURIComponent(postId)}`;
}

export function getAuthRoute(returnTo?: string | null): string {
  if (!isSafeSocialReturnRoute(returnTo)) {
    return AUTH_ROUTE;
  }

  return `${AUTH_ROUTE}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function resolveEntryRoute(isAuthenticated: boolean): string {
  return isAuthenticated ? FEEDS_HOME_ROUTE : AUTH_ROUTE;
}

export function isSafeSocialReturnRoute(returnTo: string | null | undefined): returnTo is string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) {
    return false;
  }

  try {
    const baseUrl = new URL('https://hushnetwork.local');
    const candidateUrl = new URL(returnTo, baseUrl);
    return candidateUrl.origin === baseUrl.origin && candidateUrl.pathname.startsWith(SOCIAL_HOME_ROUTE);
  } catch {
    return false;
  }
}

export function resolveAuthSuccessRoute(returnTo: string | null | undefined): string {
  return isSafeSocialReturnRoute(returnTo) ? returnTo : FEEDS_HOME_ROUTE;
}

export function normalizeLegacyAppRoute(pathname: string): string {
  if (pathname === LEGACY_DASHBOARD_ROUTE) {
    return FEEDS_HOME_ROUTE;
  }
  return pathname;
}

export function getActiveAppFromPath(pathname: string): AppId {
  if (pathname.startsWith(`${SOCIAL_HOME_ROUTE}/`) || pathname === SOCIAL_HOME_ROUTE) {
    return 'social';
  }
  if (
    pathname.startsWith(`${VOTING_HOME_ROUTE}/`) ||
    pathname === VOTING_HOME_ROUTE ||
    pathname === '/account/elections' ||
    pathname.startsWith('/account/elections/')
  ) {
    return 'voting';
  }
  return 'feeds';
}

export function shouldClearBadgesOnAppSwitch(): boolean {
  return false;
}

import { describe, expect, it } from 'vitest';
import {
  AUTH_ROUTE,
  FEEDS_HOME_ROUTE,
  LEGACY_COMMUNITY_ROUTE,
  LEGACY_DASHBOARD_ROUTE,
  SOCIAL_HOME_ROUTE,
  getActiveAppFromPath,
  getAppHomeRoute,
  getFeedNavigationRoute,
  normalizeLegacyAppRoute,
  resolveEntryRoute,
  shouldClearBadgesOnAppSwitch,
} from './appRoutes';

describe('appRoutes', () => {
  it('resolves app home routes by app id', () => {
    expect(getAppHomeRoute('feeds')).toBe(FEEDS_HOME_ROUTE);
    expect(getAppHomeRoute('social')).toBe(SOCIAL_HOME_ROUTE);
  });

  it('builds feed navigation route with encoded feed id', () => {
    expect(getFeedNavigationRoute('abc 123')).toBe('/feeds?feed=abc%20123');
  });

  it('resolves entry route from auth state', () => {
    expect(resolveEntryRoute(true)).toBe(FEEDS_HOME_ROUTE);
    expect(resolveEntryRoute(false)).toBe(AUTH_ROUTE);
  });

  it('normalizes legacy dashboard/community to feeds home', () => {
    expect(normalizeLegacyAppRoute(LEGACY_DASHBOARD_ROUTE)).toBe(FEEDS_HOME_ROUTE);
    expect(normalizeLegacyAppRoute(LEGACY_COMMUNITY_ROUTE)).toBe(FEEDS_HOME_ROUTE);
    expect(normalizeLegacyAppRoute('/social')).toBe('/social');
  });

  it('detects active app from route path', () => {
    expect(getActiveAppFromPath('/social')).toBe('social');
    expect(getActiveAppFromPath('/social/post/1')).toBe('social');
    expect(getActiveAppFromPath('/feeds')).toBe('feeds');
    expect(getActiveAppFromPath('/unknown')).toBe('feeds');
  });

  it('does not clear cross-app badges on app switch', () => {
    expect(shouldClearBadgesOnAppSwitch()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  AUTH_ROUTE,
  FEEDS_HOME_ROUTE,
  getAuthRoute,
  getAppDisplayName,
  LEGACY_DASHBOARD_ROUTE,
  getSocialPostRoute,
  isSafeSocialReturnRoute,
  resolveAuthSuccessRoute,
  SOCIAL_HOME_ROUTE,
  SOCIAL_POST_ROUTE,
  getActiveAppFromPath,
  getAppHomeRoute,
  getFeedNavigationRoute,
  normalizeLegacyAppRoute,
  resolveEntryRoute,
  shouldClearBadgesOnAppSwitch,
  VOTING_HOME_ROUTE,
} from './appRoutes';

describe('appRoutes', () => {
  it('resolves app home routes by app id', () => {
    expect(getAppHomeRoute('feeds')).toBe(FEEDS_HOME_ROUTE);
    expect(getAppHomeRoute('social')).toBe(SOCIAL_HOME_ROUTE);
    expect(getAppHomeRoute('voting')).toBe(VOTING_HOME_ROUTE);
  });

  it('returns exact app display names', () => {
    expect(getAppDisplayName('feeds')).toBe('HushFeeds!');
    expect(getAppDisplayName('social')).toBe('HushSocial!');
    expect(getAppDisplayName('voting')).toBe('HushVoting!');
  });

  it('builds feed navigation route with encoded feed id', () => {
    expect(getFeedNavigationRoute('abc 123')).toBe('/feeds?feed=abc%20123');
  });

  it('builds canonical social post routes with encoded post ids', () => {
    expect(getSocialPostRoute('abc 123')).toBe(`${SOCIAL_POST_ROUTE}/abc%20123`);
  });

  it('builds auth routes with optional safe social return targets', () => {
    expect(getAuthRoute('/social/post/post-123')).toBe('/auth?returnTo=%2Fsocial%2Fpost%2Fpost-123');
    expect(getAuthRoute('/feeds')).toBe(AUTH_ROUTE);
    expect(getAuthRoute(null)).toBe(AUTH_ROUTE);
  });

  it('resolves entry route from auth state', () => {
    expect(resolveEntryRoute(true)).toBe(FEEDS_HOME_ROUTE);
    expect(resolveEntryRoute(false)).toBe(AUTH_ROUTE);
  });

  it('allows only safe relative social return routes', () => {
    expect(isSafeSocialReturnRoute('/social')).toBe(true);
    expect(isSafeSocialReturnRoute('/social/post/post-123?resume=1')).toBe(true);
    expect(isSafeSocialReturnRoute('/feeds')).toBe(false);
    expect(isSafeSocialReturnRoute('https://example.com/social/post/post-123')).toBe(false);
    expect(isSafeSocialReturnRoute('//example.com/social/post/post-123')).toBe(false);
    expect(isSafeSocialReturnRoute('/\\evil')).toBe(false);
  });

  it('resolves auth success to safe social return routes or feeds fallback', () => {
    expect(resolveAuthSuccessRoute('/social/post/post-123')).toBe('/social/post/post-123');
    expect(resolveAuthSuccessRoute('/feeds')).toBe(FEEDS_HOME_ROUTE);
    expect(resolveAuthSuccessRoute('https://example.com/social/post/post-123')).toBe(FEEDS_HOME_ROUTE);
    expect(resolveAuthSuccessRoute(null)).toBe(FEEDS_HOME_ROUTE);
  });

  it('normalizes legacy dashboard to feeds home only', () => {
    expect(normalizeLegacyAppRoute(LEGACY_DASHBOARD_ROUTE)).toBe(FEEDS_HOME_ROUTE);
    expect(normalizeLegacyAppRoute('/community')).toBe('/community');
    expect(normalizeLegacyAppRoute('/social')).toBe('/social');
  });

  it('detects active app from route path', () => {
    expect(getActiveAppFromPath('/social')).toBe('social');
    expect(getActiveAppFromPath('/social/post/1')).toBe('social');
    expect(getActiveAppFromPath('/elections')).toBe('voting');
    expect(getActiveAppFromPath('/account/elections')).toBe('voting');
    expect(getActiveAppFromPath('/feeds')).toBe('feeds');
    expect(getActiveAppFromPath('/unknown')).toBe('feeds');
  });

  it('does not clear cross-app badges on app switch', () => {
    expect(shouldClearBadgesOnAppSwitch()).toBe(false);
  });
});

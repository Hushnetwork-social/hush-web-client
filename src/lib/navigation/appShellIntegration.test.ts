import { beforeEach, describe, expect, it } from 'vitest';
import {
  FEEDS_HOME_ROUTE,
  getActiveAppFromPath,
  getAppHomeRoute,
  getFeedNavigationRoute,
  normalizeLegacyAppRoute,
  resolveEntryRoute,
  shouldClearBadgesOnAppSwitch,
  SOCIAL_HOME_ROUTE,
} from './appRoutes';
import {
  DEFAULT_ACTIVE_APP,
  DEFAULT_APP_CONTEXTS,
  DEFAULT_CROSS_APP_BADGES,
  useAppStore,
} from '@/stores/useAppStore';

function resetStore(): void {
  useAppStore.setState({
    isAuthenticated: false,
    isLoading: false,
    currentUser: null,
    credentials: null,
    balance: { available: 0, pending: 0, currency: 'HUSH' },
    selectedFeedId: null,
    selectedNav: 'feeds',
    activeApp: DEFAULT_ACTIVE_APP,
    appContexts: {
      feeds: { ...DEFAULT_APP_CONTEXTS.feeds },
      social: { ...DEFAULT_APP_CONTEXTS.social },
    },
    crossAppBadges: { ...DEFAULT_CROSS_APP_BADGES },
  });
}

describe('app shell integration', () => {
  beforeEach(() => {
    resetStore();
  });

  it('restores per-app menu/feed/scroll state across repeated app switches', () => {
    const store = useAppStore.getState();

    store.setSelectedNav('new-chat');
    store.selectFeed('feed-001');
    store.setAppContextScroll('feeds', 240);
    store.setCrossAppBadge('social', 4);

    store.setActiveApp('social');
    store.setSelectedNav('following');
    store.selectFeed('social-feed-9');
    store.setAppContextScroll('social', 980);
    store.setCrossAppBadge('feeds', 7);

    store.setActiveApp('feeds');

    let state = useAppStore.getState();
    expect(state.activeApp).toBe('feeds');
    expect(state.selectedNav).toBe('new-chat');
    expect(state.selectedFeedId).toBe('feed-001');
    expect(state.appContexts.feeds.scrollOffset).toBe(240);
    expect(state.crossAppBadges.social).toBe(4);
    expect(state.crossAppBadges.feeds).toBe(7);

    store.setActiveApp('social');

    state = useAppStore.getState();
    expect(state.activeApp).toBe('social');
    expect(state.selectedNav).toBe('following');
    expect(state.selectedFeedId).toBe('social-feed-9');
    expect(state.appContexts.social.scrollOffset).toBe(980);
    expect(shouldClearBadgesOnAppSwitch()).toBe(false);
    expect(state.crossAppBadges.social).toBe(4);
    expect(state.crossAppBadges.feeds).toBe(7);
  });

  it('keeps route hand-off stable for root, dashboard legacy, and app trees', () => {
    expect(resolveEntryRoute(true)).toBe(FEEDS_HOME_ROUTE);
    expect(resolveEntryRoute(false)).toBe('/auth');

    expect(normalizeLegacyAppRoute('/dashboard')).toBe(FEEDS_HOME_ROUTE);
    expect(normalizeLegacyAppRoute('/community')).toBe('/community');
    expect(normalizeLegacyAppRoute('/social')).toBe('/social');

    expect(getActiveAppFromPath('/social')).toBe('social');
    expect(getActiveAppFromPath('/social/post/1')).toBe('social');
    expect(getActiveAppFromPath('/feeds')).toBe('feeds');

    expect(getAppHomeRoute('social')).toBe(SOCIAL_HOME_ROUTE);
    expect(getAppHomeRoute('feeds')).toBe(FEEDS_HOME_ROUTE);
    expect(getFeedNavigationRoute('feed id')).toBe('/feeds?feed=feed%20id');
  });
});

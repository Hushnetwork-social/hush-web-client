import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVE_APP,
  DEFAULT_APP_CONTEXTS,
  DEFAULT_CROSS_APP_BADGES,
  useAppStore,
} from './useAppStore';

const STORAGE_KEY = 'hush-app-storage';

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

describe('useAppStore FEAT-084 app context contract', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    resetStore();
  });

  it('uses expected defaults for first-time users', () => {
    const state = useAppStore.getState();

    expect(state.activeApp).toBe('feeds');
    expect(state.selectedNav).toBe('feeds');
    expect(state.selectedFeedId).toBeNull();
    expect(state.appContexts.feeds.selectedNav).toBe('feeds');
    expect(state.appContexts.social.selectedNav).toBe('feed-wall');
    expect(state.crossAppBadges).toEqual({ feeds: 0, social: 0 });
  });

  it('persists app-specific nav/feed state independently', () => {
    const store = useAppStore.getState();

    store.setSelectedNav('new-chat');
    store.selectFeed('feed-1');

    store.setActiveApp('social');
    store.setSelectedNav('following');
    store.selectFeed('social-feed-1');

    store.setActiveApp('feeds');

    const state = useAppStore.getState();
    expect(state.selectedNav).toBe('new-chat');
    expect(state.selectedFeedId).toBe('feed-1');
    expect(state.appContexts.social.selectedNav).toBe('following');
    expect(state.appContexts.social.selectedFeedId).toBe('social-feed-1');
  });

  it('keeps cross-app badges without auto-clear on app switch', () => {
    const store = useAppStore.getState();

    store.setCrossAppBadge('feeds', 5);
    store.setCrossAppBadge('social', 2);
    store.setActiveApp('social');
    store.setActiveApp('feeds');

    const state = useAppStore.getState();
    expect(state.crossAppBadges.feeds).toBe(5);
    expect(state.crossAppBadges.social).toBe(2);
  });

  it('does not allow negative badge values', () => {
    const store = useAppStore.getState();
    store.setCrossAppBadge('social', -3);
    expect(useAppStore.getState().crossAppBadges.social).toBe(0);
  });

  it('includes app context contract fields in persistence payload', () => {
    const store = useAppStore.getState();

    store.setActiveApp('social');
    store.setSelectedNav('notifications');
    store.setAppContextScroll('social', 1280);
    store.setCrossAppBadge('feeds', 7);

    const partialize = useAppStore.persist.getOptions().partialize as (state: ReturnType<typeof useAppStore.getState>) => {
      activeApp: string;
      appContexts: { social: { selectedNav: string; scrollOffset: number } };
      crossAppBadges: { feeds: number };
    };
    const persistedState = partialize(useAppStore.getState());

    expect(persistedState.activeApp).toBe('social');
    expect(persistedState.appContexts.social.selectedNav).toBe('notifications');
    expect(persistedState.appContexts.social.scrollOffset).toBe(1280);
    expect(persistedState.crossAppBadges.feeds).toBe(7);
  });
});

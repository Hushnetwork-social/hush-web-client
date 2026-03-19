import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackButton } from './useBackButton';

let mockPathname = '/social';
let selectedFeedId: string | null = null;
let selectedNav = 'feed-wall';
let activeApp: 'feeds' | 'social' = 'social';

const selectFeedMock = vi.fn();
const setSelectedNavMock = vi.fn();
const setActiveAppMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/stores', () => ({
  useAppStore: (
    selector?: (state: {
      selectedFeedId: string | null;
      selectedNav: string;
      activeApp: 'feeds' | 'social';
      selectFeed: (feedId: string | null) => void;
      setSelectedNav: (nav: string) => void;
      setActiveApp: (app: 'feeds' | 'social') => void;
    }) => unknown
  ) => {
    const state = {
      selectedFeedId,
      selectedNav,
      activeApp,
      selectFeed: selectFeedMock,
      setSelectedNav: setSelectedNavMock,
      setActiveApp: setActiveAppMock,
    };

    return selector ? selector(state) : state;
  },
}));

describe('useBackButton', () => {
  beforeEach(() => {
    mockPathname = '/social';
    selectedFeedId = null;
    selectedNav = 'feed-wall';
    activeApp = 'social';
    selectFeedMock.mockReset();
    setSelectedNavMock.mockReset();
    setActiveAppMock.mockReset();
    window.history.replaceState(null, '', '/social');
  });

  it('navigates social subviews back to Feed Wall on popstate', () => {
    selectedNav = 'search';

    renderHook(() => useBackButton());

    window.dispatchEvent(
      new PopStateEvent('popstate', {
        state: { app: 'social', view: 'feed-wall', socialNav: 'feed-wall' },
      })
    );

    expect(setActiveAppMock).toHaveBeenCalledWith('social');
    expect(selectFeedMock).toHaveBeenCalledWith(null);
    expect(setSelectedNavMock).toHaveBeenCalledWith('feed-wall');
  });

  it('navigates social Feed Wall back to HushFeeds on popstate', () => {
    renderHook(() => useBackButton());

    window.dispatchEvent(
      new PopStateEvent('popstate', {
        state: { app: 'feeds', view: 'feeds' },
      })
    );

    expect(setActiveAppMock).toHaveBeenCalledWith('feeds');
    expect(selectFeedMock).toHaveBeenCalledWith(null);
    expect(setSelectedNavMock).toHaveBeenCalledWith('feeds');
  });
});

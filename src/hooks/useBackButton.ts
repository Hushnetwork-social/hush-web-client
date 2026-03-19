/**
 * useBackButton Hook
 *
 * Handles device back button navigation across HushFeeds and HushSocial.
 * It keeps transient in-app views on the history stack so Android back
 * returns to the previous in-app surface instead of getting stuck.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores';
import { debugLog } from '@/lib/debug-logger';
import { getActiveAppFromPath } from '@/lib/navigation/appRoutes';

interface NavigationState {
  app: 'feeds' | 'social';
  view: 'feeds' | 'chat' | 'new-chat' | 'feed-wall' | 'social-subview' | 'post-detail';
  feedId?: string;
  socialNav?: string;
  postId?: string;
}

export function useBackButton() {
  const pathname = usePathname();
  const {
    selectedFeedId,
    selectedNav,
    activeApp,
    selectFeed,
    setSelectedNav,
    setActiveApp,
  } = useAppStore();
  const isInitialMount = useRef(true);
  const isProgrammaticNavigation = useRef(false);

  const buildCurrentState = useCallback((): NavigationState => {
    const pathApp = getActiveAppFromPath(pathname);
    if (pathApp === 'social' || activeApp === 'social') {
      if (selectedNav === 'feed-wall') {
        return {
          app: 'social',
          view: 'feed-wall',
          socialNav: 'feed-wall',
        };
      }

      return {
        app: 'social',
        view: 'social-subview',
        socialNav: selectedNav,
      };
    }

    return {
      app: 'feeds',
      view: selectedNav === 'new-chat' ? 'new-chat' : selectedFeedId ? 'chat' : 'feeds',
      feedId: selectedFeedId || undefined,
    };
  }, [activeApp, pathname, selectedFeedId, selectedNav]);

  useEffect(() => {
    const currentState = buildCurrentState();

    if (isInitialMount.current) {
      isInitialMount.current = false;
      window.history.replaceState(currentState, '');
      debugLog('[useBackButton] Initial state set:', currentState);
      return;
    }

    if (isProgrammaticNavigation.current) {
      isProgrammaticNavigation.current = false;
      return;
    }

    if (
      currentState.view === 'chat' ||
      currentState.view === 'new-chat' ||
      currentState.view === 'social-subview'
    ) {
      window.history.pushState(currentState, '');
      debugLog('[useBackButton] Pushed state:', currentState);
      return;
    }

    window.history.replaceState(currentState, '');
    debugLog('[useBackButton] Replaced state:', currentState);
  }, [buildCurrentState]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      debugLog('[useBackButton] Back button pressed, state:', event.state);
      isProgrammaticNavigation.current = true;

      const state = event.state as NavigationState | null;
      if (!state) {
        return;
      }

      if (state.app === 'social') {
        setActiveApp('social');
        selectFeed(null);
        setSelectedNav(state.socialNav ?? 'feed-wall');
        debugLog('[useBackButton] Navigating to social view:', state.socialNav ?? 'feed-wall');
        return;
      }

      setActiveApp('feeds');

      if (state.view === 'chat' && state.feedId) {
        selectFeed(state.feedId);
        setSelectedNav('feeds');
        debugLog('[useBackButton] Navigating to feed:', state.feedId);
      } else if (state.view === 'new-chat') {
        selectFeed(null);
        setSelectedNav('new-chat');
        debugLog('[useBackButton] Navigating to new-chat');
      } else {
        selectFeed(null);
        setSelectedNav('feeds');
        debugLog('[useBackButton] Navigating to feed list');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectFeed, setActiveApp, setSelectedNav]);
}

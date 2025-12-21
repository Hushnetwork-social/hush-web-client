/**
 * useBackButton Hook
 *
 * Handles device back button (Android/iOS) for PWA navigation.
 * Pushes browser history states when navigating within the app,
 * so the back button returns to the previous view instead of exiting.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores';
import { debugLog } from '@/lib/debug-logger';

interface NavigationState {
  view: 'feeds' | 'chat' | 'new-chat';
  feedId?: string;
}

export function useBackButton() {
  const { selectedFeedId, selectedNav, selectFeed, setSelectedNav } = useAppStore();
  const isInitialMount = useRef(true);
  const isProgrammaticNavigation = useRef(false);

  // Push history state when navigation changes
  useEffect(() => {
    // Skip initial mount to avoid pushing duplicate state
    if (isInitialMount.current) {
      isInitialMount.current = false;

      // Replace initial state (don't push)
      const initialState: NavigationState = {
        view: selectedNav === 'new-chat' ? 'new-chat' : selectedFeedId ? 'chat' : 'feeds',
        feedId: selectedFeedId || undefined,
      };
      window.history.replaceState(initialState, '');
      debugLog('[useBackButton] Initial state set:', initialState);
      return;
    }

    // Skip if this change was triggered by popstate (back button)
    if (isProgrammaticNavigation.current) {
      isProgrammaticNavigation.current = false;
      return;
    }

    // Determine current view
    const currentState: NavigationState = {
      view: selectedNav === 'new-chat' ? 'new-chat' : selectedFeedId ? 'chat' : 'feeds',
      feedId: selectedFeedId || undefined,
    };

    // Push new state for forward navigation (entering a feed or new-chat)
    if (currentState.view === 'chat' || currentState.view === 'new-chat') {
      window.history.pushState(currentState, '');
      debugLog('[useBackButton] Pushed state:', currentState);
    }
  }, [selectedFeedId, selectedNav]);

  // Handle back button (popstate event)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      debugLog('[useBackButton] Back button pressed, state:', event.state);

      // Mark as programmatic to avoid pushing state in the other useEffect
      isProgrammaticNavigation.current = true;

      const state = event.state as NavigationState | null;

      if (!state || state.view === 'feeds') {
        // Go back to feed list
        selectFeed(null);
        setSelectedNav('feeds');
        debugLog('[useBackButton] Navigating to feed list');
      } else if (state.view === 'chat' && state.feedId) {
        // Go to specific feed
        selectFeed(state.feedId);
        setSelectedNav('feeds');
        debugLog('[useBackButton] Navigating to feed:', state.feedId);
      } else if (state.view === 'new-chat') {
        // Go to new chat view
        selectFeed(null);
        setSelectedNav('new-chat');
        debugLog('[useBackButton] Navigating to new-chat');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectFeed, setSelectedNav]);
}

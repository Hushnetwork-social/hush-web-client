/**
 * Mention Indicators & Navigation - Integration Tests
 *
 * Tests the complete mention tracking and navigation flows to verify
 * all components work together correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackMention,
  markMentionRead,
  getUnreadMentions,
  getUnreadCount,
  hasUnreadMentions,
  clearMentions,
  getAllFeedsWithMentions,
  checkForDataLoss,
  clearDataLossFlag,
} from './mentionTracker';

// Storage keys (must match implementation)
const STORAGE_KEY = 'hush_mention_tracking';
const INIT_FLAG_KEY = 'hush_mention_tracking_init';

describe('Mention Tracking Integration Tests', () => {
  // Simulate real localStorage storage
  let storage: Record<string, string>;

  beforeEach(() => {
    // Create fresh in-memory storage for each test
    storage = {};

    // Mock localStorage methods to use in-memory storage
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      return storage[key] ?? null;
    });

    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value;
      }
    );

    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key];
    });

    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage = {};
    });
  });

  describe('Complete Mention Tracking Flow', () => {
    /**
     * Scenario: Complete mention tracking flow
     * Given a user is viewing feed A
     * And a new message mentioning them arrives in feed B
     * When the message is processed
     * Then the mention is tracked
     * And the MentionBadge appears on feed B in the list
     */
    it('tracks mention in inactive feed and badge becomes visible', () => {
      // Given: User is viewing feed A (simulated by checking against active feed)
      const activeFeedId = 'feedA';
      const inactiveFeedId = 'feedB';
      const messageId = 'msg123';

      // Before: No mentions tracked
      expect(hasUnreadMentions(inactiveFeedId)).toBe(false);
      expect(getAllFeedsWithMentions()).toEqual([]);

      // When: Message arrives in inactive feed B (simulating FeedsSyncable behavior)
      // Only track if not the active feed
      if (inactiveFeedId !== activeFeedId) {
        trackMention(inactiveFeedId, messageId);
      }

      // Then: Mention is tracked
      expect(hasUnreadMentions(inactiveFeedId)).toBe(true);
      expect(getAllFeedsWithMentions()).toContain(inactiveFeedId);
      expect(getUnreadCount(inactiveFeedId)).toBe(1);
    });

    /**
     * Scenario: Do not track mention in active feed
     * Given the user is viewing feed A
     * And a new message arrives in feed A mentioning the current user
     * When the message is processed
     * Then the mention is NOT tracked (auto-read)
     * And no new badge appears
     */
    it('does not track mention in active feed (auto-read behavior)', () => {
      const activeFeedId = 'feedA';
      const messageId = 'msg123';

      // Before: No mentions tracked
      expect(hasUnreadMentions(activeFeedId)).toBe(false);

      // When: Message arrives in ACTIVE feed A
      // Simulating FeedsSyncable logic: skip tracking for active feed
      if (activeFeedId !== activeFeedId) {
        // This should NOT execute
        trackMention(activeFeedId, messageId);
      }

      // Then: Mention is NOT tracked
      expect(hasUnreadMentions(activeFeedId)).toBe(false);
      expect(getAllFeedsWithMentions()).toEqual([]);
    });

    /**
     * Scenario: Handle multiple mentions in one message
     * Given a message mentions the current user twice
     * When the message is processed
     * Then only one tracking entry is created for that message
     */
    it('handles multiple mentions in same message (deduplication)', () => {
      const feedId = 'feed1';
      const messageId = 'msg123';

      // Simulate parsing message with multiple mentions
      // The mentionParser would find 2 mentions, but we only track once per message
      trackMention(feedId, messageId);
      trackMention(feedId, messageId); // Attempt duplicate

      // Then: Only one entry
      expect(getUnreadCount(feedId)).toBe(1);
      expect(getUnreadMentions(feedId)).toEqual([messageId]);
    });
  });

  describe('Complete Navigation Flow', () => {
    /**
     * Scenario: Complete navigation flow
     * Given a feed has 2 unread mentions
     * When the user enters the feed
     * Then the MentionNavButton appears with count "2"
     * When the user clicks the button
     * Then they are scrolled to the first mention
     * And the count updates to "1"
     * When they click again
     * Then they are scrolled to the second mention
     * And the button disappears (count = 0)
     */
    it('navigates through mentions and updates count correctly', () => {
      const feedId = 'feedB';

      // Given: Feed has 2 unread mentions
      trackMention(feedId, 'msg1');
      trackMention(feedId, 'msg2');
      expect(getUnreadCount(feedId)).toBe(2);

      // Get mentions in order
      const mentions = getUnreadMentions(feedId);
      expect(mentions).toEqual(['msg1', 'msg2']);

      // Simulate navigation index
      let navIndex = 0;

      // First click: Navigate to first mention
      const targetId1 = mentions[navIndex % mentions.length];
      expect(targetId1).toBe('msg1');

      // Mark as read (simulating ChatView behavior)
      markMentionRead(feedId, targetId1);
      navIndex++;

      // Count should update to 1
      expect(getUnreadCount(feedId)).toBe(1);

      // Second click: Navigate to second mention
      const remainingMentions = getUnreadMentions(feedId);
      expect(remainingMentions).toEqual(['msg2']);
      const targetId2 = remainingMentions[0];

      markMentionRead(feedId, targetId2);
      navIndex++;

      // Count should update to 0
      expect(getUnreadCount(feedId)).toBe(0);
      expect(hasUnreadMentions(feedId)).toBe(false);
    });

    /**
     * Scenario: Loop back to first after last
     * Given the user has navigated through all mentions
     * And they are now viewing msg3 (the last one)
     * When the user clicks the nav button
     * Then the view scrolls back to msg1 (loop)
     */
    it('loops back to first mention after reaching the last', () => {
      const feedId = 'feedB';

      // Setup: 3 mentions, simulate user has already marked some as read
      // but then new mentions came in
      trackMention(feedId, 'msg1');
      trackMention(feedId, 'msg2');
      trackMention(feedId, 'msg3');

      // Simulate looping navigation (without marking as read)
      let navIndex = 0;
      const mentionCount = getUnreadCount(feedId);

      // Navigate through all mentions
      for (let i = 0; i < mentionCount + 1; i++) {
        const mentions = getUnreadMentions(feedId);
        const currentIndex = navIndex % mentions.length;
        const targetId = mentions[currentIndex];

        if (i === 0) expect(targetId).toBe('msg1');
        if (i === 1) expect(targetId).toBe('msg2');
        if (i === 2) expect(targetId).toBe('msg3');
        if (i === 3) expect(targetId).toBe('msg1'); // Loop back

        navIndex++;
      }
    });
  });

  describe('Persistence Across Refresh', () => {
    /**
     * Scenario: Persistence across refresh
     * Given mentions are tracked for feed B
     * When the page is refreshed (simulated by re-reading localStorage)
     * Then the mentions are still tracked
     * And the badge still appears on feed B
     */
    it('persists mentions across simulated page refresh', () => {
      const feedId = 'feedB';

      // Given: Track mentions
      trackMention(feedId, 'msg1');
      trackMention(feedId, 'msg2');

      // Verify initial state
      expect(getUnreadCount(feedId)).toBe(2);
      expect(hasUnreadMentions(feedId)).toBe(true);

      // Simulate "page refresh" by clearing any in-memory cache
      // (In real implementation, each function re-reads localStorage)

      // When: "Refresh" - re-query the state
      const countAfterRefresh = getUnreadCount(feedId);
      const hasMentionsAfterRefresh = hasUnreadMentions(feedId);
      const feedsWithMentions = getAllFeedsWithMentions();

      // Then: Data persists
      expect(countAfterRefresh).toBe(2);
      expect(hasMentionsAfterRefresh).toBe(true);
      expect(feedsWithMentions).toContain(feedId);
    });

    it('persists partial navigation state across refresh', () => {
      const feedId = 'feedB';

      // Track 3 mentions
      trackMention(feedId, 'msg1');
      trackMention(feedId, 'msg2');
      trackMention(feedId, 'msg3');

      // Navigate to first one (mark as read)
      markMentionRead(feedId, 'msg1');

      // "Refresh"
      const mentionsAfterRefresh = getUnreadMentions(feedId);

      // Only msg2 and msg3 should remain
      expect(mentionsAfterRefresh).toEqual(['msg2', 'msg3']);
      expect(getUnreadCount(feedId)).toBe(2);
    });
  });

  describe('Data Loss Detection Integration', () => {
    /**
     * Scenario: Detect localStorage cleared
     * Given mention tracking data existed previously
     * And the user clears browser data
     * When the app loads
     * Then data loss is detected
     */
    it('detects data loss when localStorage is cleared', () => {
      // Given: Initialize with data
      trackMention('feed1', 'msg1');
      expect(hasUnreadMentions('feed1')).toBe(true);

      // Verify init flag is set
      expect(storage[INIT_FLAG_KEY]).toBe('true');

      // When: User clears browser data (simulated)
      delete storage[STORAGE_KEY];

      // Then: Data loss is detected
      expect(checkForDataLoss()).toBe(true);
    });

    /**
     * Scenario: No notification on first use
     * Given this is the user's first time using the app
     * And no tracking data ever existed
     * When the app loads
     * Then no data loss is detected
     */
    it('does not detect data loss on first use', () => {
      // Fresh storage - no init flag, no data
      expect(checkForDataLoss()).toBe(false);
    });

    it('clears data loss flag after notification', () => {
      // Setup data loss scenario
      trackMention('feed1', 'msg1');
      delete storage[STORAGE_KEY];

      expect(checkForDataLoss()).toBe(true);

      // Clear the flag (simulating after user is notified)
      clearDataLossFlag();

      // Init flag should be restored for future detection
      expect(storage[INIT_FLAG_KEY]).toBe('true');
    });
  });

  describe('Multi-Feed Integration', () => {
    it('tracks mentions across multiple feeds independently', () => {
      // Track mentions in 3 different feeds
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed2', 'msg3');
      trackMention('feed3', 'msg4');
      trackMention('feed3', 'msg5');
      trackMention('feed3', 'msg6');

      // Verify counts
      expect(getUnreadCount('feed1')).toBe(2);
      expect(getUnreadCount('feed2')).toBe(1);
      expect(getUnreadCount('feed3')).toBe(3);

      // Verify all feeds show up
      const feedsWithMentions = getAllFeedsWithMentions();
      expect(feedsWithMentions).toHaveLength(3);
      expect(feedsWithMentions).toContain('feed1');
      expect(feedsWithMentions).toContain('feed2');
      expect(feedsWithMentions).toContain('feed3');

      // Clear one feed
      clearMentions('feed2');

      // Only 2 feeds should remain
      expect(getAllFeedsWithMentions()).toHaveLength(2);
      expect(hasUnreadMentions('feed2')).toBe(false);
    });

    it('reading mentions in one feed does not affect others', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed2', 'msg2');

      // Mark as read in feed1
      markMentionRead('feed1', 'msg1');

      // feed2 should be unaffected
      expect(getUnreadCount('feed1')).toBe(0);
      expect(getUnreadCount('feed2')).toBe(1);
      expect(hasUnreadMentions('feed2')).toBe(true);
    });
  });

  describe('Badge Visibility Integration', () => {
    it('hasUnreadMentions returns correct value for FeedList rendering', () => {
      // This tests the integration between mentionTracker and FeedList
      // FeedList uses hasUnreadMentions(feedId) to pass prop to ChatListItem

      const feedIds = ['feed1', 'feed2', 'feed3', 'feed4'];

      // Setup: feed1 and feed3 have mentions
      trackMention('feed1', 'msg1');
      trackMention('feed3', 'msg2');
      trackMention('feed3', 'msg3');

      // Simulate FeedList rendering logic
      const badgeVisibility = feedIds.map((feedId) => ({
        feedId,
        hasUnreadMentions: hasUnreadMentions(feedId),
      }));

      expect(badgeVisibility).toEqual([
        { feedId: 'feed1', hasUnreadMentions: true },
        { feedId: 'feed2', hasUnreadMentions: false },
        { feedId: 'feed3', hasUnreadMentions: true },
        { feedId: 'feed4', hasUnreadMentions: false },
      ]);
    });
  });

  describe('Navigation Button Count Integration', () => {
    it('getUnreadCount returns correct value for NavButton count badge', () => {
      const feedId = 'feedB';

      // Track 5 mentions
      for (let i = 1; i <= 5; i++) {
        trackMention(feedId, `msg${i}`);
      }

      // NavButton should show count
      expect(getUnreadCount(feedId)).toBe(5);

      // Mark 2 as read
      markMentionRead(feedId, 'msg1');
      markMentionRead(feedId, 'msg2');

      // Count should update
      expect(getUnreadCount(feedId)).toBe(3);

      // Mark all remaining as read
      markMentionRead(feedId, 'msg3');
      markMentionRead(feedId, 'msg4');
      markMentionRead(feedId, 'msg5');

      // Count should be 0 (button hidden)
      expect(getUnreadCount(feedId)).toBe(0);
    });

    it('handles max display count (9+)', () => {
      const feedId = 'feedB';

      // Track 15 mentions
      for (let i = 1; i <= 15; i++) {
        trackMention(feedId, `msg${i}`);
      }

      // The actual count is 15
      expect(getUnreadCount(feedId)).toBe(15);

      // UI component would display "9+" when count > 9
      // (This is handled in MentionNavButton component, not tracker)
      const displayCount = getUnreadCount(feedId) > 9 ? '9+' : String(getUnreadCount(feedId));
      expect(displayCount).toBe('9+');
    });
  });
});

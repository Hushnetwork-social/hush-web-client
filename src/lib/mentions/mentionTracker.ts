/**
 * Mention Tracker Module
 *
 * Utility functions for tracking unread mentions per feed using localStorage.
 * Enables the UI to show "@" indicators in FeedList and navigation buttons in chat.
 */

import { useFeedsStore } from '@/modules/feeds';

// Storage key for mention tracking data
const STORAGE_KEY = 'hush_mention_tracking';

// Flag to detect if localStorage was previously initialized (for data loss detection)
const INIT_FLAG_KEY = 'hush_mention_tracking_init';

/**
 * Represents tracking data for a single feed's unread mentions
 */
export interface MentionTrackingEntry {
  messageIds: string[];
  lastUpdated: number;
}

/**
 * Map of feedId to tracking entry for all feeds with unread mentions
 */
export type MentionTrackingData = Record<string, MentionTrackingEntry>;

/**
 * Checks if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads tracking data from localStorage
 */
function loadTrackingData(): MentionTrackingData {
  if (!isLocalStorageAvailable()) {
    return {};
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return {};
    }
    return JSON.parse(data) as MentionTrackingData;
  } catch {
    return {};
  }
}

/**
 * Saves tracking data to localStorage
 */
function saveTrackingData(data: MentionTrackingData): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    // Clean up empty entries before saving
    const cleanedData: MentionTrackingData = {};
    for (const [feedId, entry] of Object.entries(data)) {
      if (entry.messageIds.length > 0) {
        cleanedData[feedId] = entry;
      }
    }

    // Always save the data (even if empty) to distinguish from data loss
    // An empty object {} means "no mentions" while null means "data was lost"
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedData));

    // Set init flag to detect future data loss
    localStorage.setItem(INIT_FLAG_KEY, 'true');
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

/**
 * Tracks a mention for a specific feed.
 * Adds the message ID to the feed's unread mentions list.
 * Duplicate message IDs are ignored.
 *
 * @param feedId - The feed ID to track the mention for
 * @param messageId - The message ID containing the mention
 */
export function trackMention(feedId: string, messageId: string): void {
  const data = loadTrackingData();

  if (!data[feedId]) {
    data[feedId] = {
      messageIds: [],
      lastUpdated: Date.now(),
    };
  }

  // Prevent duplicates
  if (!data[feedId].messageIds.includes(messageId)) {
    data[feedId].messageIds.push(messageId);
    data[feedId].lastUpdated = Date.now();
    saveTrackingData(data);
    // Trigger React re-render by incrementing version in Zustand store
    try {
      useFeedsStore.getState().incrementMentionVersion();
    } catch {
      // Store may not be available in tests or edge cases
    }
  }
}

/**
 * Marks a mention as read by removing it from tracking.
 *
 * @param feedId - The feed ID
 * @param messageId - The message ID to mark as read
 */
export function markMentionRead(feedId: string, messageId: string): void {
  const data = loadTrackingData();

  if (!data[feedId]) {
    return;
  }

  const index = data[feedId].messageIds.indexOf(messageId);
  if (index !== -1) {
    data[feedId].messageIds.splice(index, 1);
    data[feedId].lastUpdated = Date.now();
    saveTrackingData(data);
    // Trigger React re-render by incrementing version in Zustand store
    try {
      useFeedsStore.getState().incrementMentionVersion();
    } catch {
      // Store may not be available in tests or edge cases
    }
  }
}

/**
 * Gets all unread mention message IDs for a feed.
 * Returns messages in order (oldest first).
 *
 * @param feedId - The feed ID
 * @returns Array of message IDs with unread mentions
 */
export function getUnreadMentions(feedId: string): string[] {
  const data = loadTrackingData();
  return data[feedId]?.messageIds ?? [];
}

/**
 * Gets the count of unread mentions for a feed.
 *
 * @param feedId - The feed ID
 * @returns Number of unread mentions
 */
export function getUnreadCount(feedId: string): number {
  return getUnreadMentions(feedId).length;
}

/**
 * Checks if a feed has any unread mentions.
 *
 * @param feedId - The feed ID
 * @returns True if the feed has unread mentions
 */
export function hasUnreadMentions(feedId: string): boolean {
  return getUnreadCount(feedId) > 0;
}

/**
 * Clears all unread mentions for a feed.
 *
 * @param feedId - The feed ID
 */
export function clearMentions(feedId: string): void {
  const data = loadTrackingData();

  if (data[feedId]) {
    delete data[feedId];
    saveTrackingData(data);
    // Trigger React re-render by incrementing version in Zustand store
    try {
      useFeedsStore.getState().incrementMentionVersion();
    } catch {
      // Store may not be available in tests or edge cases
    }
  }
}

/**
 * Gets all feed IDs that have unread mentions.
 *
 * @returns Array of feed IDs with unread mentions
 */
export function getAllFeedsWithMentions(): string[] {
  const data = loadTrackingData();
  return Object.keys(data).filter((feedId) => data[feedId].messageIds.length > 0);
}

/**
 * Checks if localStorage data was lost (e.g., user cleared browser data).
 * Returns true if tracking was previously initialized but data is now missing.
 *
 * @returns True if data loss was detected
 */
export function checkForDataLoss(): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  const wasInitialized = localStorage.getItem(INIT_FLAG_KEY) === 'true';
  const hasData = localStorage.getItem(STORAGE_KEY) !== null;

  // If we were initialized but now have no data, data was lost
  // Note: This returns false on first use (wasInitialized = false)
  return wasInitialized && !hasData;
}

/**
 * Clears the data loss detection flag after user has been notified.
 */
export function clearDataLossFlag(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  // Re-initialize so we can detect future data loss
  localStorage.setItem(INIT_FLAG_KEY, 'true');
}

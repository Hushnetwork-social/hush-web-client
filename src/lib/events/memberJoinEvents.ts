/**
 * Member Join Event Emitter
 *
 * Simple pub/sub system for member join notifications.
 * Used to communicate between the sync layer (group-sync.ts) and
 * the React notification layer (useNotifications hook).
 */

import type { GroupFeedMember } from '@/types';

export interface MemberJoinEvent {
  feedId: string;
  feedName: string;
  member: GroupFeedMember;
  timestamp: number;
}

type MemberJoinListener = (event: MemberJoinEvent) => void;

// Singleton list of subscribers
const listeners: MemberJoinListener[] = [];

/**
 * Subscribe to member join events
 * @returns Unsubscribe function
 */
export function onMemberJoin(listener: MemberJoinListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Emit a member join event to all subscribers
 */
export function emitMemberJoin(event: MemberJoinEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[MemberJoinEvents] Listener error:', error);
    }
  }
}

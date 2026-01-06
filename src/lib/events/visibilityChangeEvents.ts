/**
 * Visibility Change Event Emitter
 *
 * Simple pub/sub system for group visibility change notifications.
 * Used to communicate between the sync layer and the React notification layer.
 */

export interface VisibilityChangeEvent {
  feedId: string;
  feedName: string;
  isPublic: boolean;
  timestamp: number;
}

type VisibilityChangeListener = (event: VisibilityChangeEvent) => void;

// Singleton list of subscribers
const listeners: VisibilityChangeListener[] = [];

/**
 * Subscribe to visibility change events
 * @returns Unsubscribe function
 */
export function onVisibilityChange(listener: VisibilityChangeListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Emit a visibility change event to all subscribers
 */
export function emitVisibilityChange(event: VisibilityChangeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[VisibilityChangeEvents] Listener error:', error);
    }
  }
}

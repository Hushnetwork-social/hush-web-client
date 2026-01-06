/**
 * Settings Change Event Emitter
 *
 * Pub/sub system for group settings change notifications.
 * Supports comprehensive notifications for name, description, and visibility changes.
 * Used to communicate between the sync layer and the React notification layer.
 */

export interface SettingsChange {
  /** Previous name (if changed) */
  previousName?: string;
  /** New name (if changed) */
  newName?: string;
  /** Previous description (if changed) */
  previousDescription?: string;
  /** New description (if changed) */
  newDescription?: string;
  /** Previous visibility (if changed) */
  previousIsPublic?: boolean;
  /** New visibility (if changed) */
  newIsPublic?: boolean;
}

export interface SettingsChangeEvent {
  feedId: string;
  feedName: string;
  changes: SettingsChange;
  timestamp: number;
}

type SettingsChangeListener = (event: SettingsChangeEvent) => void;

// Singleton list of subscribers
const listeners: SettingsChangeListener[] = [];

/**
 * Subscribe to settings change events
 * @returns Unsubscribe function
 */
export function onSettingsChange(listener: SettingsChangeListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Emit a settings change event to all subscribers
 */
export function emitSettingsChange(event: SettingsChangeEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[SettingsChangeEvents] Listener error:', error);
    }
  }
}

/**
 * Check if any settings have changed
 */
export function hasSettingsChanged(changes: SettingsChange): boolean {
  return (
    changes.newName !== undefined ||
    changes.newDescription !== undefined ||
    changes.newIsPublic !== undefined
  );
}

/**
 * Build a human-readable summary of the settings changes
 */
export function buildSettingsChangeSummary(changes: SettingsChange): string {
  const parts: string[] = [];

  if (changes.newName !== undefined) {
    parts.push(`Name changed to "${changes.newName}"`);
  }

  if (changes.newDescription !== undefined) {
    if (changes.newDescription === '') {
      parts.push('Description was removed');
    } else {
      parts.push(`Description changed to "${changes.newDescription}"`);
    }
  }

  if (changes.newIsPublic !== undefined) {
    const visibility = changes.newIsPublic ? 'Public' : 'Private';
    parts.push(`Visibility changed to ${visibility}`);
  }

  return parts.join(', ');
}

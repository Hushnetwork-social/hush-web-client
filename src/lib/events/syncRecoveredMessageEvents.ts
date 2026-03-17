/**
 * Sync-recovered message event emitter.
 *
 * Used when the background/manual sync path discovers new messages for a non-active
 * feed that may have been missed by the live notification stream.
 */

export interface SyncRecoveredMessageEvent {
  messageId: string;
  feedId: string;
  feedName?: string;
  senderName?: string;
  senderPublicKey: string;
  messagePreview: string;
  timestamp: number;
}

type SyncRecoveredMessageListener = (event: SyncRecoveredMessageEvent) => void;

const listeners: SyncRecoveredMessageListener[] = [];

export function onSyncRecoveredMessage(listener: SyncRecoveredMessageListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

export function emitSyncRecoveredMessage(event: SyncRecoveredMessageEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[SyncRecoveredMessageEvents] Listener error:', error);
    }
  }
}

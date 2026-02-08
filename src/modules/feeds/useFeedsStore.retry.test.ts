/**
 * FEAT-058: Message Retry Unit Tests
 *
 * Tests for:
 * 1. Migration from isConfirmed to status model
 * 2. updateMessageRetryState action
 * 3. getUnconfirmedMessages selector
 * 4. hasPendingOrFailedMessages selector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from './useFeedsStore';
import type { FeedMessage } from '@/types';

// Helper to create a test message
function createTestMessage(overrides: Partial<FeedMessage> = {}): FeedMessage {
  return {
    id: `msg-${Math.random().toString(36).substring(7)}`,
    feedId: 'feed-1',
    senderPublicKey: 'sender-key',
    content: 'Test message',
    timestamp: Date.now(),
    isConfirmed: false,
    ...overrides,
  };
}

describe('FEAT-058: Message Retry - useFeedsStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useFeedsStore.getState().reset();
  });

  // ============= Migration Tests =============

  describe('Migration: isConfirmed to status model', () => {
    it('should migrate isConfirmed:true to status:confirmed', () => {
      // Arrange: Create message with only isConfirmed (no status)
      const message = createTestMessage({
        id: 'msg-confirmed',
        isConfirmed: true,
        status: undefined, // Simulate pre-migration message
      });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act: Get message (migration happens on access)
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert: Message should NOT be in unconfirmed list
      expect(unconfirmed.find(m => m.id === 'msg-confirmed')).toBeUndefined();
    });

    it('should migrate isConfirmed:false to status:pending', () => {
      // Arrange: Create message with isConfirmed:false (no status)
      const message = createTestMessage({
        id: 'msg-pending',
        isConfirmed: false,
        status: undefined, // Simulate pre-migration message
      });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act: Get message
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert: Message should be in unconfirmed list
      expect(unconfirmed.find(m => m.id === 'msg-pending')).toBeDefined();
    });

    it('should skip migration for messages with existing status', () => {
      // Arrange: Create message that already has status
      const message = createTestMessage({
        id: 'msg-already-migrated',
        isConfirmed: false,
        status: 'failed', // Already migrated
        retryCount: 3,
      });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act: Get unconfirmed messages
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert: Should find message with status 'failed' (not overwritten to 'pending')
      const found = unconfirmed.find(m => m.id === 'msg-already-migrated');
      expect(found).toBeDefined();
      expect(found?.status).toBe('failed');
    });
  });

  // ============= updateMessageRetryState Tests =============

  describe('updateMessageRetryState action', () => {
    it('should update status field', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-1', status: 'pending' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', {
        status: 'confirming',
      });

      // Assert
      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages[0].status).toBe('confirming');
    });

    it('should update retryCount field', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-1', status: 'pending', retryCount: 0 });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', {
        retryCount: 1,
      });

      // Assert
      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages[0].retryCount).toBe(1);
    });

    it('should update lastAttemptTime field', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-1', status: 'pending', lastAttemptTime: 0 });
      useFeedsStore.getState().setMessages('feed-1', [message]);
      const now = Date.now();

      // Act
      useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', {
        lastAttemptTime: now,
      });

      // Assert
      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages[0].lastAttemptTime).toBe(now);
    });

    it('should keep isConfirmed in sync when status becomes confirmed', () => {
      // Arrange
      const message = createTestMessage({
        id: 'msg-1',
        status: 'pending',
        isConfirmed: false,
      });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', {
        status: 'confirmed',
      });

      // Assert
      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages[0].status).toBe('confirmed');
      expect(messages[0].isConfirmed).toBe(true);
    });

    it('should keep isConfirmed:false when status is pending/failed/confirming', () => {
      // Arrange
      const message = createTestMessage({
        id: 'msg-1',
        status: 'confirmed',
        isConfirmed: true,
      });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', {
        status: 'failed',
      });

      // Assert
      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages[0].status).toBe('failed');
      expect(messages[0].isConfirmed).toBe(false);
    });

    it('should handle non-existent feedId gracefully', () => {
      // Arrange - no messages added

      // Act & Assert - should not throw
      expect(() => {
        useFeedsStore.getState().updateMessageRetryState('non-existent-feed', 'msg-1', {
          status: 'confirmed',
        });
      }).not.toThrow();
    });

    it('should handle non-existent messageId gracefully', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-1' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act & Assert - should not throw
      expect(() => {
        useFeedsStore.getState().updateMessageRetryState('feed-1', 'non-existent-msg', {
          status: 'confirmed',
        });
      }).not.toThrow();

      // Original message should be unchanged
      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages[0].id).toBe('msg-1');
    });
  });

  // ============= getUnconfirmedMessages Selector Tests =============

  describe('getUnconfirmedMessages selector', () => {
    it('should return pending messages', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-pending', status: 'pending' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert
      expect(unconfirmed).toHaveLength(1);
      expect(unconfirmed[0].id).toBe('msg-pending');
    });

    it('should return confirming messages', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-confirming', status: 'confirming' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert
      expect(unconfirmed).toHaveLength(1);
      expect(unconfirmed[0].id).toBe('msg-confirming');
    });

    it('should return failed messages', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-failed', status: 'failed' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert
      expect(unconfirmed).toHaveLength(1);
      expect(unconfirmed[0].id).toBe('msg-failed');
    });

    it('should NOT return confirmed messages', () => {
      // Arrange
      const message = createTestMessage({ id: 'msg-confirmed', status: 'confirmed' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert
      expect(unconfirmed).toHaveLength(0);
    });

    it('should sort by timestamp ascending (oldest first)', () => {
      // Arrange
      const now = Date.now();
      const messages = [
        createTestMessage({ id: 'msg-newest', status: 'pending', timestamp: now + 2000 }),
        createTestMessage({ id: 'msg-oldest', status: 'pending', timestamp: now }),
        createTestMessage({ id: 'msg-middle', status: 'pending', timestamp: now + 1000 }),
      ];
      useFeedsStore.getState().setMessages('feed-1', messages);

      // Act
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert
      expect(unconfirmed).toHaveLength(3);
      expect(unconfirmed[0].id).toBe('msg-oldest');
      expect(unconfirmed[1].id).toBe('msg-middle');
      expect(unconfirmed[2].id).toBe('msg-newest');
    });

    it('should return messages across multiple feeds', () => {
      // Arrange
      const msg1 = createTestMessage({ id: 'msg-1', feedId: 'feed-1', status: 'pending' });
      const msg2 = createTestMessage({ id: 'msg-2', feedId: 'feed-2', status: 'pending' });
      useFeedsStore.getState().setMessages('feed-1', [msg1]);
      useFeedsStore.getState().setMessages('feed-2', [msg2]);

      // Act
      const unconfirmed = useFeedsStore.getState().getUnconfirmedMessages();

      // Assert
      expect(unconfirmed).toHaveLength(2);
    });
  });

  // ============= hasPendingOrFailedMessages Selector Tests =============

  describe('hasPendingOrFailedMessages selector', () => {
    it('should return true if pending message exists', () => {
      // Arrange
      const message = createTestMessage({ status: 'pending' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

      // Assert
      expect(hasPending).toBe(true);
    });

    it('should return true if failed message exists', () => {
      // Arrange
      const message = createTestMessage({ status: 'failed' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

      // Assert
      expect(hasPending).toBe(true);
    });

    it('should return false if only confirmed messages exist', () => {
      // Arrange
      const message = createTestMessage({ status: 'confirmed', isConfirmed: true });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

      // Assert
      expect(hasPending).toBe(false);
    });

    it('should return false if only confirming messages exist', () => {
      // Arrange - confirming is not pending or failed
      const message = createTestMessage({ status: 'confirming' });
      useFeedsStore.getState().setMessages('feed-1', [message]);

      // Act
      const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

      // Assert - confirming is NOT pending or failed
      expect(hasPending).toBe(false);
    });

    it('should return false if no messages exist', () => {
      // Arrange - no messages

      // Act
      const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

      // Assert
      expect(hasPending).toBe(false);
    });

    it('should check across multiple feeds', () => {
      // Arrange
      const confirmedMsg = createTestMessage({ feedId: 'feed-1', status: 'confirmed', isConfirmed: true });
      const failedMsg = createTestMessage({ feedId: 'feed-2', status: 'failed' });
      useFeedsStore.getState().setMessages('feed-1', [confirmedMsg]);
      useFeedsStore.getState().setMessages('feed-2', [failedMsg]);

      // Act
      const hasPending = useFeedsStore.getState().hasPendingOrFailedMessages();

      // Assert - should find the failed message in feed-2
      expect(hasPending).toBe(true);
    });
  });

  // ============= addMessages confirmation Tests =============

  describe('addMessages: confirmation updates status', () => {
    it('should set status to confirmed when confirming pending message', () => {
      // Arrange: Add pending message
      const pendingMsg = createTestMessage({
        id: 'msg-to-confirm',
        status: 'pending',
        isConfirmed: false,
      });
      useFeedsStore.getState().addPendingMessage('feed-1', pendingMsg);

      // Act: Confirm message with server response
      const confirmedMsg = createTestMessage({
        id: 'msg-to-confirm',
        status: 'confirmed',
        isConfirmed: true,
        blockHeight: 100,
      });
      useFeedsStore.getState().addMessages('feed-1', [confirmedMsg]);

      // Assert
      const messages = useFeedsStore.getState().messages['feed-1'];
      const updated = messages.find(m => m.id === 'msg-to-confirm');
      expect(updated?.status).toBe('confirmed');
      expect(updated?.isConfirmed).toBe(true);
      expect(updated?.blockHeight).toBe(100);
    });
  });
});

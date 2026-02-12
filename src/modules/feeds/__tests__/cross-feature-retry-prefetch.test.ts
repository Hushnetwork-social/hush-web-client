/**
 * CF-003: Cross-Feature Integration Test
 *
 * Tests that prefetch (FEAT-059) and retry (FEAT-058) systems work together
 * without conflicts. Verifies:
 * 1. addMessages confirms a local pending message when prefetch returns confirmed version
 * 2. updateMessageRetryState and addMessages don't interfere on different messages
 * 3. No duplicate messages when prefetch returns a message that already exists locally
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from '../useFeedsStore';
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

describe('CF-003: Cross-Feature Integration - Retry + Prefetch', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useFeedsStore.getState().reset();
  });

  it('should confirm a local pending message when prefetch returns confirmed version with same ID', () => {
    // Arrange: Add a pending message (simulating user sent a message)
    const pendingMsg = createTestMessage({
      id: 'msg-cross-001',
      feedId: 'feed-1',
      status: 'pending',
      isConfirmed: false,
      content: 'Pending message',
    });
    useFeedsStore.getState().addPendingMessage('feed-1', pendingMsg);

    // Verify it's pending
    const beforeMessages = useFeedsStore.getState().messages['feed-1'];
    expect(beforeMessages).toHaveLength(1);
    expect(beforeMessages[0].status).toBe('pending');

    // Act: Prefetch returns the confirmed version of the same message
    const confirmedMsg = createTestMessage({
      id: 'msg-cross-001', // Same ID
      feedId: 'feed-1',
      status: 'confirmed',
      isConfirmed: true,
      content: 'Pending message',
      blockHeight: 50,
    });
    useFeedsStore.getState().addMessages('feed-1', [confirmedMsg]);

    // Assert: Message should be confirmed (not duplicated)
    const afterMessages = useFeedsStore.getState().messages['feed-1'];
    expect(afterMessages).toHaveLength(1);
    expect(afterMessages[0].id).toBe('msg-cross-001');
    expect(afterMessages[0].status).toBe('confirmed');
    expect(afterMessages[0].isConfirmed).toBe(true);
    expect(afterMessages[0].blockHeight).toBe(50);
  });

  it('should not interfere when updateMessageRetryState and addMessages operate on different messages', () => {
    // Arrange: Two pending messages in the same feed
    const msg1 = createTestMessage({
      id: 'msg-retry-001',
      feedId: 'feed-1',
      status: 'pending',
      isConfirmed: false,
      content: 'Message being retried',
      timestamp: 1000,
    });
    const msg2 = createTestMessage({
      id: 'msg-prefetch-001',
      feedId: 'feed-1',
      status: 'pending',
      isConfirmed: false,
      content: 'Message from prefetch',
      timestamp: 2000,
    });
    useFeedsStore.getState().addPendingMessage('feed-1', msg1);
    useFeedsStore.getState().addPendingMessage('feed-1', msg2);

    // Act: Retry updates msg1 status while prefetch confirms msg2
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-retry-001', {
      status: 'confirming',
      retryCount: 1,
      lastAttemptTime: Date.now(),
    });

    const confirmedMsg2 = createTestMessage({
      id: 'msg-prefetch-001',
      feedId: 'feed-1',
      status: 'confirmed',
      isConfirmed: true,
      content: 'Message from prefetch',
      blockHeight: 100,
      timestamp: 2000,
    });
    useFeedsStore.getState().addMessages('feed-1', [confirmedMsg2]);

    // Assert: Both messages retain their independent states
    const messages = useFeedsStore.getState().messages['feed-1'];
    expect(messages).toHaveLength(2);

    const retryMsg = messages.find(m => m.id === 'msg-retry-001');
    expect(retryMsg?.status).toBe('confirming');
    expect(retryMsg?.retryCount).toBe(1);

    const prefetchMsg = messages.find(m => m.id === 'msg-prefetch-001');
    expect(prefetchMsg?.status).toBe('confirmed');
    expect(prefetchMsg?.isConfirmed).toBe(true);
    expect(prefetchMsg?.blockHeight).toBe(100);
  });

  it('should not create duplicate messages when prefetch returns a message that already exists locally as unconfirmed', () => {
    // Arrange: Add an unconfirmed message
    const unconfirmedMsg = createTestMessage({
      id: 'msg-dedup-001',
      feedId: 'feed-1',
      status: 'pending',
      isConfirmed: false,
      content: 'Dedup test message',
      timestamp: 1000,
    });
    useFeedsStore.getState().addPendingMessage('feed-1', unconfirmedMsg);

    // Also add a confirmed message that already exists
    const existingConfirmedMsg = createTestMessage({
      id: 'msg-existing-001',
      feedId: 'feed-1',
      status: 'confirmed',
      isConfirmed: true,
      content: 'Existing confirmed',
      blockHeight: 10,
      timestamp: 500,
    });
    useFeedsStore.getState().addMessages('feed-1', [existingConfirmedMsg]);

    // Act: Prefetch returns both messages (the unconfirmed one now confirmed, plus a brand new one)
    const prefetchedMessages = [
      createTestMessage({
        id: 'msg-dedup-001', // Same as unconfirmed
        feedId: 'feed-1',
        status: 'confirmed',
        isConfirmed: true,
        content: 'Dedup test message',
        blockHeight: 20,
        timestamp: 1000,
      }),
      createTestMessage({
        id: 'msg-existing-001', // Same as existing confirmed
        feedId: 'feed-1',
        status: 'confirmed',
        isConfirmed: true,
        content: 'Existing confirmed',
        blockHeight: 10,
        timestamp: 500,
      }),
      createTestMessage({
        id: 'msg-new-001', // Truly new message
        feedId: 'feed-1',
        status: 'confirmed',
        isConfirmed: true,
        content: 'Brand new from prefetch',
        blockHeight: 30,
        timestamp: 1500,
      }),
    ];
    useFeedsStore.getState().addMessages('feed-1', prefetchedMessages);

    // Assert: Should have exactly 3 messages (no duplicates)
    const messages = useFeedsStore.getState().messages['feed-1'];
    expect(messages).toHaveLength(3);

    // Verify each message exists once
    const ids = messages.map(m => m.id);
    expect(ids).toContain('msg-dedup-001');
    expect(ids).toContain('msg-existing-001');
    expect(ids).toContain('msg-new-001');

    // Verify the previously unconfirmed message is now confirmed
    const dedupMsg = messages.find(m => m.id === 'msg-dedup-001');
    expect(dedupMsg?.status).toBe('confirmed');
    expect(dedupMsg?.isConfirmed).toBe(true);
    expect(dedupMsg?.blockHeight).toBe(20);
  });
});

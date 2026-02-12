/**
 * MT-002: Retry Metrics Unit Tests
 *
 * Tests that retry metrics counters increment correctly:
 * - messagesPending on addPendingMessage
 * - messagesRetrying and totalRetryAttempts on status change to confirming
 * - messagesFailed on status change to failed
 * - resetMetrics zeros all counters
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

describe('MT-002: Retry Metrics', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  it('should increment messagesPending on addPendingMessage', () => {
    // Arrange
    const msg1 = createTestMessage({ id: 'msg-1', status: 'pending' });
    const msg2 = createTestMessage({ id: 'msg-2', status: 'pending' });

    // Act
    useFeedsStore.getState().addPendingMessage('feed-1', msg1);
    useFeedsStore.getState().addPendingMessage('feed-1', msg2);

    // Assert
    const metrics = useFeedsStore.getState().getRetryMetrics();
    expect(metrics.messagesPending).toBe(2);
  });

  it('should increment totalRetryAttempts across multiple messages', () => {
    // Arrange: Two pending messages
    const msg1 = createTestMessage({ id: 'msg-1', status: 'pending' });
    const msg2 = createTestMessage({ id: 'msg-2', status: 'pending' });
    useFeedsStore.getState().addPendingMessage('feed-1', msg1);
    useFeedsStore.getState().addPendingMessage('feed-1', msg2);

    // Act: Retry msg1 twice, msg2 once
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', { status: 'confirming' });
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', { status: 'pending' });
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', { status: 'confirming' });
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-2', { status: 'confirming' });

    // Assert: 3 total retry attempts (3 times status changed to 'confirming')
    const metrics = useFeedsStore.getState().getRetryMetrics();
    expect(metrics.totalRetryAttempts).toBe(3);
    expect(metrics.messagesRetrying).toBe(3);
  });

  it('should increment messagesFailed on status change to failed', () => {
    // Arrange
    const msg = createTestMessage({ id: 'msg-1', status: 'pending' });
    useFeedsStore.getState().addPendingMessage('feed-1', msg);

    // Act
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', { status: 'failed' });

    // Assert
    const metrics = useFeedsStore.getState().getRetryMetrics();
    expect(metrics.messagesFailed).toBe(1);
  });

  it('should zero all counters on resetMetrics', () => {
    // Arrange: Accumulate some metrics
    const msg = createTestMessage({ id: 'msg-1', status: 'pending' });
    useFeedsStore.getState().addPendingMessage('feed-1', msg);
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', { status: 'confirming' });
    useFeedsStore.getState().updateMessageRetryState('feed-1', 'msg-1', { status: 'failed' });

    // Verify counters are non-zero before reset
    const beforeMetrics = useFeedsStore.getState().getRetryMetrics();
    expect(beforeMetrics.messagesPending).toBeGreaterThan(0);

    // Act
    useFeedsStore.getState().resetMetrics();

    // Assert
    const metrics = useFeedsStore.getState().getRetryMetrics();
    expect(metrics.messagesPending).toBe(0);
    expect(metrics.messagesRetrying).toBe(0);
    expect(metrics.messagesFailed).toBe(0);
    expect(metrics.totalRetryAttempts).toBe(0);
  });
});

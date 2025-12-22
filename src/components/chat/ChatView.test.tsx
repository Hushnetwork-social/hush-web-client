/**
 * ChatView Tests
 *
 * Tests for the chat view component with reaction integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatView } from './ChatView';
import { useAppStore } from '@/stores';
import { useFeedsStore } from '@/modules/feeds/useFeedsStore';
import { useReactionsStore } from '@/modules/reactions/useReactionsStore';
import type { Feed } from '@/types';

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

// Create mock functions at module scope
const mockDebugLog = vi.fn();

// Mock the crypto constants
vi.mock('@/lib/crypto/reactions/constants', () => ({
  EMOJIS: ['👍', '❤️', '😂', '😮', '😢', '😡'] as const,
}));

// Mock the debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

// Mock sendMessage to avoid actual API calls
vi.mock('@/modules/feeds', async () => {
  const actual = await vi.importActual('@/modules/feeds');
  return {
    ...actual,
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
  };
});

describe('ChatView', () => {
  const mockFeed: Feed = {
    id: 'feed-123',
    name: 'Test Chat',
    type: 'chat',
    participants: ['user-1', 'user-2'],
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
  };

  const mockCredentials = {
    signingPublicKey: 'my-public-key',
    signingPrivateKey: 'my-private-key',
    encryptPublicKey: 'enc-public',
    encryptPrivateKey: 'enc-private',
    displayName: 'TestUser',
  };

  beforeEach(() => {
    // Reset stores
    useAppStore.setState({ credentials: mockCredentials });
    useFeedsStore.getState().reset();
    useReactionsStore.getState().reset();
  });

  describe('Rendering', () => {
    it('should render feed name in header', () => {
      render(<ChatView feed={mockFeed} />);
      expect(screen.getByText('Test Chat')).toBeInTheDocument();
    });

    it('should render empty state when no messages', () => {
      render(<ChatView feed={mockFeed} />);
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    it('should render messages from store', () => {
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-1',
          feedId: 'feed-123',
          content: 'Hello from the test!',
          senderPublicKey: 'other-user',
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);

      render(<ChatView feed={mockFeed} />);
      expect(screen.getByText('Hello from the test!')).toBeInTheDocument();
    });
  });

  describe('Reaction Integration', () => {
    beforeEach(() => {
      // Add a message to the store
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-1',
          feedId: 'feed-123',
          content: 'Test message',
          senderPublicKey: 'other-user',
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);
    });

    it('should show reaction button on confirmed messages', () => {
      render(<ChatView feed={mockFeed} />);
      expect(screen.getByTitle('Add reaction')).toBeInTheDocument();
    });

    it('should not show reaction button on unconfirmed messages', () => {
      useFeedsStore.getState().reset();
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-2',
          feedId: 'feed-123',
          content: 'Pending message',
          senderPublicKey: 'my-public-key',
          timestamp: Date.now(),
          isConfirmed: false,
        },
      ]);

      render(<ChatView feed={mockFeed} />);
      expect(screen.queryByTitle('Add reaction')).not.toBeInTheDocument();
    });

    it('should display reaction counts from store', () => {
      // Set reaction counts in store
      useReactionsStore.getState().updateTally('msg-1', {
        '👍': 5,
        '❤️': 2,
        '😂': 0,
        '😮': 0,
        '😢': 0,
        '😡': 0,
      });

      render(<ChatView feed={mockFeed} />);

      // Should show counts
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show my reaction highlighted', () => {
      useReactionsStore.getState().setMyReaction('msg-1', 0); // 👍

      render(<ChatView feed={mockFeed} />);

      // Open picker
      fireEvent.click(screen.getByTitle('Add reaction'));

      // First emoji should be selected
      const emojiButtons = screen.getAllByRole('option');
      expect(emojiButtons[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('should open reaction picker when clicking reaction button', () => {
      render(<ChatView feed={mockFeed} />);

      fireEvent.click(screen.getByTitle('Add reaction'));

      // Picker should be visible
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should log reaction selection (placeholder behavior)', () => {
      mockDebugLog.mockClear();

      render(<ChatView feed={mockFeed} />);

      // Open picker and select emoji
      fireEvent.click(screen.getByTitle('Add reaction'));
      const emojiButtons = screen.getAllByRole('option');
      fireEvent.click(emojiButtons[0]);

      // Should log the selection
      expect(mockDebugLog).toHaveBeenCalledWith(
        expect.stringContaining('[ChatView] Reaction selected:')
      );
    });
  });

  describe('Message Ownership', () => {
    it('should identify own messages correctly', () => {
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-own',
          feedId: 'feed-123',
          content: 'My message',
          senderPublicKey: 'my-public-key', // Matches credentials
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);

      const { container } = render(<ChatView feed={mockFeed} />);

      // Own messages should be on the right (justify-end)
      const messageContainer = container.querySelector('.justify-end');
      expect(messageContainer).toBeInTheDocument();
    });

    it('should identify other messages correctly', () => {
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-other',
          feedId: 'feed-123',
          content: 'Their message',
          senderPublicKey: 'other-public-key',
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);

      const { container } = render(<ChatView feed={mockFeed} />);

      // Other messages should be on the left (justify-start)
      const messageContainer = container.querySelector('.justify-start');
      expect(messageContainer).toBeInTheDocument();
    });
  });
});

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
import type { Feed, GroupFeedMember } from '@/types';

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock react-virtuoso to render all items in tests (JSDOM doesn't support virtualization)
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, className }: {
    data: unknown[];
    itemContent: (index: number, item: unknown) => React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="virtuoso-mock" className={className}>
      {data.map((item, index) => (
        <div key={index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
  VirtuosoHandle: {},
}));

// Mock the crypto constants
vi.mock('@/lib/crypto/reactions/constants', () => ({
  EMOJIS: ['👍', '❤️', '😂', '😮', '😢', '😡'] as const,
  EMOJI_COUNT: 6,
  BABYJUBJUB: {
    a: 168700n,
    d: 168696n,
    p: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
    order: 21888242871839275222246405745257275088614511777268538073601725287587578984328n,
    cofactor: 8n,
    generator: { x: 0n, y: 1n },
  },
  IDENTITY: { x: 0n, y: 1n },
  DOMAIN_SEPARATORS: { NULLIFIER: 0n, BACKUP: 0n, COMMITMENT: 0n },
  CIRCUIT: { version: 'test', treeDepth: 20, gracePeriodRoots: 3 },
  BSGS: { maxValue: 1024n, tableSize: 32, cacheKey: 'test', tableUrl: '/test' },
  FEED_KEY_DOMAIN: 'test',
}));

// Mock the debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
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

    it('should call onReactionSelect when emoji is selected', () => {
      render(<ChatView feed={mockFeed} />);

      // Open picker and select emoji
      fireEvent.click(screen.getByTitle('Add reaction'));
      const emojiButtons = screen.getAllByRole('option');
      fireEvent.click(emojiButtons[0]);

      // Emoji selection should close the picker
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
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

  describe('Reply Flow Integration', () => {
    beforeEach(() => {
      // Add messages to the store for reply testing
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-1',
          feedId: 'feed-123',
          content: 'Original message to reply to',
          senderPublicKey: 'other-user',
          timestamp: Date.now(),
          isConfirmed: true,
        },
        {
          id: 'msg-2',
          feedId: 'feed-123',
          content: 'Another message',
          senderPublicKey: 'my-public-key',
          timestamp: Date.now() + 1000,
          isConfirmed: true,
        },
      ]);
    });

    it('should show reply button on confirmed messages', () => {
      render(<ChatView feed={mockFeed} />);

      const replyButtons = screen.getAllByTitle('Reply to message');
      expect(replyButtons.length).toBeGreaterThan(0);
    });

    it('should show reply context bar when reply button is clicked', () => {
      render(<ChatView feed={mockFeed} />);

      // Click the reply button
      const replyButtons = screen.getAllByTitle('Reply to message');
      fireEvent.click(replyButtons[0]);

      // Context bar should appear
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Replying to')).toBeInTheDocument();
    });

    it('should show original message content in context bar', () => {
      render(<ChatView feed={mockFeed} />);

      // Click reply on first message
      const replyButtons = screen.getAllByTitle('Reply to message');
      fireEvent.click(replyButtons[0]);

      // Should show preview of original message in the context bar
      // The context bar has role="status", and the message preview is inside it
      const contextBar = screen.getByRole('status');
      expect(contextBar).toHaveTextContent('Original message to reply to');
    });

    it('should hide context bar when cancel button is clicked', () => {
      render(<ChatView feed={mockFeed} />);

      // Start reply
      const replyButtons = screen.getAllByTitle('Reply to message');
      fireEvent.click(replyButtons[0]);
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Cancel reply
      fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));

      // Context bar should be hidden
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should hide context bar when ESC key is pressed', () => {
      render(<ChatView feed={mockFeed} />);

      // Start reply
      const replyButtons = screen.getAllByTitle('Reply to message');
      fireEvent.click(replyButtons[0]);
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Press ESC
      fireEvent.keyDown(window, { key: 'Escape' });

      // Context bar should be hidden
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not show context bar when not replying', () => {
      render(<ChatView feed={mockFeed} />);

      // Context bar should not be present
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not show reply button on unconfirmed messages', () => {
      useFeedsStore.getState().reset();
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'msg-pending',
          feedId: 'feed-123',
          content: 'Pending message',
          senderPublicKey: 'my-public-key',
          timestamp: Date.now(),
          isConfirmed: false,
        },
      ]);

      render(<ChatView feed={mockFeed} />);

      expect(screen.queryByTitle('Reply to message')).not.toBeInTheDocument();
    });

    it('should switch reply target when clicking different message reply button', () => {
      render(<ChatView feed={mockFeed} />);

      // Click reply on first message
      const replyButtons = screen.getAllByTitle('Reply to message');
      fireEvent.click(replyButtons[0]);
      const contextBar1 = screen.getByRole('status');
      expect(contextBar1).toHaveTextContent('Original message to reply to');

      // Click reply on second message
      fireEvent.click(replyButtons[1]);
      const contextBar2 = screen.getByRole('status');
      expect(contextBar2).toHaveTextContent('Another message');
    });
  });

  describe('Reply Message Display', () => {
    it('should display reply preview when message has replyToMessageId', () => {
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'original-msg',
          feedId: 'feed-123',
          content: 'This is the original message',
          senderPublicKey: 'other-user',
          timestamp: Date.now(),
          isConfirmed: true,
        },
        {
          id: 'reply-msg',
          feedId: 'feed-123',
          content: 'This is my reply',
          senderPublicKey: 'my-public-key',
          timestamp: Date.now() + 1000,
          isConfirmed: true,
          replyToMessageId: 'original-msg',
        },
      ]);

      render(<ChatView feed={mockFeed} />);

      // Should show the reply content
      expect(screen.getByText('This is my reply')).toBeInTheDocument();
      // Should show preview of original message (via ReplyPreview)
      // Both the original message and the preview are shown, so we check there are at least 2 instances
      const originalMessageElements = screen.getAllByText('This is the original message');
      expect(originalMessageElements.length).toBeGreaterThanOrEqual(2); // One in message bubble, one in reply preview
    });

    it('should not show reply preview for messages without replyToMessageId', () => {
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'regular-msg',
          feedId: 'feed-123',
          content: 'Regular message without reply',
          senderPublicKey: 'other-user',
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);

      render(<ChatView feed={mockFeed} />);

      // Should show the message
      expect(screen.getByText('Regular message without reply')).toBeInTheDocument();
      // Should not have "Reply to deleted message" or any reply preview
      expect(screen.queryByText('Reply to deleted message')).not.toBeInTheDocument();
    });

    it('should show deleted message placeholder for reply to non-existent message', () => {
      useFeedsStore.getState().addMessages('feed-123', [
        {
          id: 'reply-to-deleted',
          feedId: 'feed-123',
          content: 'Reply to a deleted message',
          senderPublicKey: 'other-user',
          timestamp: Date.now(),
          isConfirmed: true,
          replyToMessageId: 'deleted-msg-id', // Message doesn't exist
        },
      ]);

      render(<ChatView feed={mockFeed} />);

      expect(screen.getByText('Reply to deleted message')).toBeInTheDocument();
    });
  });

  describe('Group Feed Support', () => {
    const mockGroupFeed: Feed = {
      id: 'group-feed-123',
      name: 'Study Group',
      type: 'group',
      participants: ['user-1', 'user-2', 'user-3'],
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      unreadCount: 0,
      updatedAt: Date.now(),
    };

    const mockGroupMembers: GroupFeedMember[] = [
      { publicAddress: 'admin-user', displayName: 'Alice Admin', role: 'Admin' },
      { publicAddress: 'member-user', displayName: 'Bob Member', role: 'Member' },
      { publicAddress: 'my-public-key', displayName: 'TestUser', role: 'Member' },
    ];

    beforeEach(() => {
      // Reset stores and set up group members
      useFeedsStore.getState().reset();
      useFeedsStore.getState().setGroupMembers('group-feed-123', mockGroupMembers);
    });

    describe('Header', () => {
      it('should show group icon for group feeds', () => {
        const { container } = render(<ChatView feed={mockGroupFeed} />);

        // Group icon should be present (Users icon from lucide-react)
        const groupIcon = container.querySelector('svg[aria-hidden="true"]');
        expect(groupIcon).toBeInTheDocument();
      });

      it('should show member count for group feeds', () => {
        render(<ChatView feed={mockGroupFeed} />);

        expect(screen.getByText('• 3 members')).toBeInTheDocument();
      });

      it('should show "Group Chat" label', () => {
        render(<ChatView feed={mockGroupFeed} />);

        expect(screen.getByText('Group Chat')).toBeInTheDocument();
      });
    });

    describe('Sender Names', () => {
      beforeEach(() => {
        // Add messages from different group members
        useFeedsStore.getState().addMessages('group-feed-123', [
          {
            id: 'msg-admin',
            feedId: 'group-feed-123',
            content: 'Message from admin',
            senderPublicKey: 'admin-user',
            timestamp: Date.now(),
            isConfirmed: true,
          },
          {
            id: 'msg-member',
            feedId: 'group-feed-123',
            content: 'Message from member',
            senderPublicKey: 'member-user',
            timestamp: Date.now() + 1000,
            isConfirmed: true,
          },
          {
            id: 'msg-own',
            feedId: 'group-feed-123',
            content: 'My own message',
            senderPublicKey: 'my-public-key',
            timestamp: Date.now() + 2000,
            isConfirmed: true,
          },
        ]);
      });

      it('should show sender name for messages from other group members', () => {
        render(<ChatView feed={mockGroupFeed} />);

        // Should show sender names above messages from others
        expect(screen.getByText('Alice Admin')).toBeInTheDocument();
        expect(screen.getByText('Bob Member')).toBeInTheDocument();
      });

      it('should not show sender name for own messages', () => {
        render(<ChatView feed={mockGroupFeed} />);

        // Own message should not have "TestUser" label
        // The message content should be visible, but no sender name above it
        expect(screen.getByText('My own message')).toBeInTheDocument();
        // There should be no "TestUser" in the message list (only in credentials)
        const testUserElements = screen.queryAllByText('TestUser');
        expect(testUserElements.length).toBe(0);
      });

      it('should show admin badge for admin sender', () => {
        render(<ChatView feed={mockGroupFeed} />);

        // Admin badge should be visible
        const adminBadge = screen.getByRole('status', { name: 'Role: Admin' });
        expect(adminBadge).toBeInTheDocument();
      });

      it('should not show badge for regular member', () => {
        render(<ChatView feed={mockGroupFeed} />);

        // Should only have one role badge (for the admin)
        const roleBadges = screen.queryAllByRole('status');
        // Only one badge (for admin), not for regular member or own messages
        expect(roleBadges.length).toBe(1);
      });
    });

    describe('Display Name Resolution', () => {
      beforeEach(() => {
        // Add a message with reply from admin to member
        useFeedsStore.getState().addMessages('group-feed-123', [
          {
            id: 'original-group-msg',
            feedId: 'group-feed-123',
            content: 'Original message in group',
            senderPublicKey: 'member-user',
            timestamp: Date.now(),
            isConfirmed: true,
          },
          {
            id: 'reply-group-msg',
            feedId: 'group-feed-123',
            content: 'Admin reply to member',
            senderPublicKey: 'admin-user',
            timestamp: Date.now() + 1000,
            isConfirmed: true,
            replyToMessageId: 'original-group-msg',
          },
        ]);
      });

      it('should resolve sender display names in reply previews', () => {
        render(<ChatView feed={mockGroupFeed} />);

        // Reply preview should show sender name (Bob Member appears both as sender header and in reply preview)
        const bobElements = screen.getAllByText('Bob Member');
        expect(bobElements.length).toBeGreaterThanOrEqual(2); // At least: sender header + reply preview
      });

      it('should show "You" in reply preview when replying to own message', () => {
        // Reset and add own message with reply
        useFeedsStore.getState().reset();
        useFeedsStore.getState().setGroupMembers('group-feed-123', mockGroupMembers);
        useFeedsStore.getState().addMessages('group-feed-123', [
          {
            id: 'my-original',
            feedId: 'group-feed-123',
            content: 'My original message',
            senderPublicKey: 'my-public-key',
            timestamp: Date.now(),
            isConfirmed: true,
          },
          {
            id: 'reply-to-me',
            feedId: 'group-feed-123',
            content: 'Someone replying to me',
            senderPublicKey: 'admin-user',
            timestamp: Date.now() + 1000,
            isConfirmed: true,
            replyToMessageId: 'my-original',
          },
        ]);

        render(<ChatView feed={mockGroupFeed} />);

        // Should show "You" in the reply preview (via resolveDisplayName)
        expect(screen.getByText('You')).toBeInTheDocument();
      });

      it('should show truncated key for unknown members', () => {
        // Add message from unknown user not in group members
        useFeedsStore.getState().reset();
        useFeedsStore.getState().setGroupMembers('group-feed-123', mockGroupMembers);
        useFeedsStore.getState().addMessages('group-feed-123', [
          {
            id: 'unknown-user-msg',
            feedId: 'group-feed-123',
            content: 'Message from unknown',
            senderPublicKey: 'unknown-user-key-12345',
            timestamp: Date.now(),
            isConfirmed: true,
          },
        ]);

        render(<ChatView feed={mockGroupFeed} />);

        // Should show truncated public key as fallback
        expect(screen.getByText('unknown-us...')).toBeInTheDocument();
      });
    });

    describe('Non-Group Feeds', () => {
      it('should not show sender names for chat feeds', () => {
        useFeedsStore.getState().addMessages('feed-123', [
          {
            id: 'chat-msg',
            feedId: 'feed-123',
            content: 'Chat message',
            senderPublicKey: 'other-user',
            timestamp: Date.now(),
            isConfirmed: true,
          },
        ]);

        render(<ChatView feed={mockFeed} />);

        // Should show message content but no sender name (chat feeds don't show sender)
        expect(screen.getByText('Chat message')).toBeInTheDocument();
        // No sender name elements should be present
        expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();
      });

      it('should not show group icon for chat feeds', () => {
        const { container } = render(<ChatView feed={mockFeed} />);

        // No group icon (Users icon with specific parent styling)
        const groupIconContainer = container.querySelector('.bg-hush-purple\\/20');
        expect(groupIconContainer).not.toBeInTheDocument();
      });

      it('should show participants count for chat feeds', () => {
        render(<ChatView feed={mockFeed} />);

        expect(screen.getByText('• 2 participants')).toBeInTheDocument();
      });
    });
  });
});

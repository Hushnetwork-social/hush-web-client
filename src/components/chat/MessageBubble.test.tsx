/**
 * MessageBubble Tests
 *
 * Tests for the message bubble component with reaction support.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { EmojiCounts } from '@/modules/reactions/useReactionsStore';

// Mock the crypto constants - use importOriginal to include all exports
vi.mock('@/lib/crypto/reactions/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crypto/reactions/constants')>();
  return {
    ...actual,
    EMOJIS: ['👍', '❤️', '😂', '😮', '😢', '😡'] as const,
  };
});

describe('MessageBubble', () => {
  const defaultProps = {
    content: 'Hello, world!',
    timestamp: '12:34',
    isOwn: false,
    isConfirmed: true,
  };

  describe('Basic Rendering', () => {
    it('should render message content', () => {
      render(<MessageBubble {...defaultProps} />);
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });

    it('should render timestamp when confirmed', () => {
      render(<MessageBubble {...defaultProps} />);
      expect(screen.getByText('12:34')).toBeInTheDocument();
    });

    it('should not render timestamp when not confirmed', () => {
      render(<MessageBubble {...defaultProps} isConfirmed={false} />);
      expect(screen.queryByText('12:34')).not.toBeInTheDocument();
    });

    it('should apply own message styling', () => {
      const { container } = render(<MessageBubble {...defaultProps} isOwn={true} />);
      const bubble = container.querySelector('.bg-hush-purple');
      expect(bubble).toBeInTheDocument();
    });

    it('should apply other message styling', () => {
      const { container } = render(<MessageBubble {...defaultProps} isOwn={false} />);
      const bubble = container.querySelector('.bg-hush-bg-dark');
      expect(bubble).toBeInTheDocument();
    });
  });

  describe('Reaction Button', () => {
    it('should not show reaction button when no onReactionSelect provided', () => {
      render(<MessageBubble {...defaultProps} />);
      expect(screen.queryByTitle('Add reaction')).not.toBeInTheDocument();
    });

    it('should not show reaction button when message not confirmed', () => {
      const onReactionSelect = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          isConfirmed={false}
          onReactionSelect={onReactionSelect}
        />
      );
      expect(screen.queryByTitle('Add reaction')).not.toBeInTheDocument();
    });

    it('should show reaction button when confirmed and onReactionSelect provided', () => {
      const onReactionSelect = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          isConfirmed={true}
          onReactionSelect={onReactionSelect}
        />
      );
      // Button exists but may be invisible until hover
      const button = screen.getByTitle('Add reaction');
      expect(button).toBeInTheDocument();
    });

    it('should toggle reaction picker on button click', () => {
      const onReactionSelect = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          onReactionSelect={onReactionSelect}
        />
      );

      const button = screen.getByTitle('Add reaction');
      fireEvent.click(button);

      // Picker should appear with emoji options
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Reaction Picker', () => {
    it('should call onReactionSelect when emoji is selected', () => {
      const onReactionSelect = vi.fn();
      const testMessageId = 'test-message-123';
      render(
        <MessageBubble
          {...defaultProps}
          messageId={testMessageId}
          onReactionSelect={onReactionSelect}
        />
      );

      // Open picker
      fireEvent.click(screen.getByTitle('Add reaction'));

      // Click first emoji (👍 at index 0)
      const emojiButtons = screen.getAllByRole('option');
      fireEvent.click(emojiButtons[0]);

      expect(onReactionSelect).toHaveBeenCalledWith(testMessageId, 0);
    });

    it('should close picker after selecting emoji', () => {
      const onReactionSelect = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          onReactionSelect={onReactionSelect}
        />
      );

      // Open picker
      fireEvent.click(screen.getByTitle('Add reaction'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Select emoji
      const emojiButtons = screen.getAllByRole('option');
      fireEvent.click(emojiButtons[0]);

      // Picker should close
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should highlight selected emoji in picker', () => {
      const onReactionSelect = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          myReaction={2} // 😂 is selected
          onReactionSelect={onReactionSelect}
        />
      );

      // Open picker
      fireEvent.click(screen.getByTitle('Add reaction'));

      // Third emoji should be marked as selected
      const emojiButtons = screen.getAllByRole('option');
      expect(emojiButtons[2]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Reaction Bar', () => {
    const countsWithReactions: EmojiCounts = {
      '👍': 5,
      '❤️': 3,
      '😂': 0,
      '😮': 0,
      '😢': 0,
      '😡': 0,
    };

    const emptyCounts: EmojiCounts = {
      '👍': 0,
      '❤️': 0,
      '😂': 0,
      '😮': 0,
      '😢': 0,
      '😡': 0,
    };

    it('should not render reaction bar when no counts provided', () => {
      render(<MessageBubble {...defaultProps} />);
      expect(screen.queryByRole('group', { name: 'Reactions' })).not.toBeInTheDocument();
    });

    it('should not render reaction bar when all counts are zero', () => {
      render(
        <MessageBubble
          {...defaultProps}
          reactionCounts={emptyCounts}
        />
      );
      expect(screen.queryByRole('group', { name: 'Reactions' })).not.toBeInTheDocument();
    });

    it('should render reaction bar with counts', () => {
      render(
        <MessageBubble
          {...defaultProps}
          reactionCounts={countsWithReactions}
        />
      );

      expect(screen.getByRole('group', { name: 'Reactions' })).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // 👍 count
      expect(screen.getByText('3')).toBeInTheDocument(); // ❤️ count
    });

    it('should show my reaction even with zero count', () => {
      render(
        <MessageBubble
          {...defaultProps}
          reactionCounts={emptyCounts}
          myReaction={0} // 👍 selected
        />
      );

      // Should show reaction bar with my reaction displayed
      expect(screen.getByRole('group', { name: 'Reactions' })).toBeInTheDocument();
    });

    it('should show pending state for my reaction', () => {
      // Pending animation only shows when server count is 0 (not yet confirmed)
      const countsWithZeroThumbsUp: EmojiCounts = {
        '👍': 0,  // My pending reaction (not yet confirmed)
        '❤️': 3,
        '😂': 0,
        '😮': 0,
        '😢': 0,
        '😡': 0,
      };

      const { container } = render(
        <MessageBubble
          {...defaultProps}
          reactionCounts={countsWithZeroThumbsUp}
          myReaction={0}  // 👍 selected but not yet confirmed
          isPendingReaction={true}
        />
      );

      // Should have animate-pulse class on the pending reaction
      const pulsingElement = container.querySelector('.animate-pulse');
      expect(pulsingElement).toBeInTheDocument();
    });

    it('should call onReactionSelect when clicking reaction in bar', () => {
      const onReactionSelect = vi.fn();
      const testMessageId = 'test-message-456';
      render(
        <MessageBubble
          {...defaultProps}
          messageId={testMessageId}
          reactionCounts={countsWithReactions}
          onReactionSelect={onReactionSelect}
        />
      );

      // Click on a reaction count button
      const reactionButtons = screen.getByRole('group', { name: 'Reactions' }).querySelectorAll('button');
      fireEvent.click(reactionButtons[0]);

      expect(onReactionSelect).toHaveBeenCalled();
    });
  });

  describe('Sender Name (Group Messages)', () => {
    it('should not show sender name when showSender is false', () => {
      render(
        <MessageBubble
          {...defaultProps}
          showSender={false}
          senderName="Alice"
        />
      );
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('should not show sender name for own messages', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          showSender={true}
          senderName="Alice"
        />
      );
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('should show sender name for group messages from others', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={false}
          showSender={true}
          senderName="Alice"
        />
      );
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should show admin badge when sender is Admin', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={false}
          showSender={true}
          senderName="Bob"
          senderRole="Admin"
        />
      );
      expect(screen.getByText('Bob')).toBeInTheDocument();
      // Admin badge should be present (role="status" from RoleBadge)
      expect(screen.getByRole('status', { name: 'Role: Admin' })).toBeInTheDocument();
    });

    it('should not show badge when sender is Member', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={false}
          showSender={true}
          senderName="Charlie"
          senderRole="Member"
        />
      );
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not show badge when sender role is undefined', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={false}
          showSender={true}
          senderName="Dave"
        />
      );
      expect(screen.getByText('Dave')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not show sender name when senderName is not provided', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={false}
          showSender={true}
        />
      );
      // Message should render without sender header
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });
  });

  describe('Message Status Icons (FEAT-058)', () => {
    it('should render Clock icon for pending status', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="pending"
        />
      );
      const pendingIcon = screen.getByTestId('message-pending');
      expect(pendingIcon).toBeInTheDocument();
      expect(pendingIcon).toHaveAttribute('aria-label', 'Message pending');
    });

    it('should render Loader2 with animate-spin for confirming status', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="confirming"
        />
      );
      const confirmingIcon = screen.getByTestId('message-confirming');
      expect(confirmingIcon).toBeInTheDocument();
      expect(confirmingIcon).toHaveAttribute('aria-label', 'Sending message');
      expect(confirmingIcon).toHaveClass('animate-spin');
    });

    it('should render Check icon for confirmed status', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="confirmed"
        />
      );
      const confirmedIcon = screen.getByTestId('message-confirmed');
      expect(confirmedIcon).toBeInTheDocument();
      expect(confirmedIcon).toHaveAttribute('aria-label', 'Message delivered');
    });

    it('should render AlertTriangle for failed status', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="failed"
        />
      );
      const failedIcon = screen.getByTestId('message-failed');
      expect(failedIcon).toBeInTheDocument();
      expect(failedIcon).toHaveAttribute('aria-label', 'Message failed - click to retry');
    });

    it('should call onRetryClick when failed icon is clicked', () => {
      const onRetryClick = vi.fn();
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="failed"
          onRetryClick={onRetryClick}
        />
      );
      const failedIcon = screen.getByTestId('message-failed');
      fireEvent.click(failedIcon);
      expect(onRetryClick).toHaveBeenCalledTimes(1);
    });

    it('should not show status icon for non-own messages', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={false}
          status="pending"
        />
      );
      expect(screen.queryByTestId('message-pending')).not.toBeInTheDocument();
      expect(screen.queryByTestId('message-confirming')).not.toBeInTheDocument();
      expect(screen.queryByTestId('message-confirmed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('message-failed')).not.toBeInTheDocument();
    });

    it('should show timestamp for confirming status', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="confirming"
        />
      );
      expect(screen.getByText('12:34')).toBeInTheDocument();
    });

    it('should not show timestamp for pending status', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          status="pending"
        />
      );
      expect(screen.queryByText('12:34')).not.toBeInTheDocument();
    });

    it('should fall back to isConfirmed when status not provided', () => {
      render(
        <MessageBubble
          {...defaultProps}
          isOwn={true}
          isConfirmed={true}
        />
      );
      const confirmedIcon = screen.getByTestId('message-confirmed');
      expect(confirmedIcon).toBeInTheDocument();
    });
  });
});

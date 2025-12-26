/**
 * ReplyContextBar Tests
 *
 * Tests for the reply context bar component that appears above the message input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplyContextBar } from './ReplyContextBar';
import type { FeedMessage } from '@/types';

describe('ReplyContextBar', () => {
  const mockMessage: FeedMessage = {
    id: 'msg-123',
    feedId: 'feed-456',
    content: 'This is the message being replied to',
    senderPublicKey: 'abc123def456xyz789',
    timestamp: Date.now(),
    isConfirmed: true,
  };

  const defaultProps = {
    replyingTo: mockMessage,
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Content Rendering', () => {
    it('should render "Replying to" text', () => {
      render(<ReplyContextBar {...defaultProps} />);

      expect(screen.getByText('Replying to')).toBeInTheDocument();
    });

    it('should render sender name (truncated public key)', () => {
      render(<ReplyContextBar {...defaultProps} />);

      // Should show first 10 chars + "..."
      expect(screen.getByText('abc123def4...')).toBeInTheDocument();
    });

    it('should render message preview', () => {
      render(<ReplyContextBar {...defaultProps} />);

      expect(screen.getByText('This is the message being replied to')).toBeInTheDocument();
    });

    it('should truncate long message content', () => {
      const longMessage = {
        ...mockMessage,
        content: 'A'.repeat(80), // 80 character message
      };
      render(<ReplyContextBar replyingTo={longMessage} onCancel={vi.fn()} />);

      // Should truncate to 60 chars + "..."
      expect(screen.getByText('A'.repeat(60) + '...')).toBeInTheDocument();
    });

    it('should render reply icon', () => {
      const { container } = render(<ReplyContextBar {...defaultProps} />);

      // Reply icon should be present (lucide-react icon rendered as svg)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should render cancel button', () => {
      render(<ReplyContextBar {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel reply' });
      expect(cancelButton).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<ReplyContextBar replyingTo={mockMessage} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should have aria-label for accessibility', () => {
      render(<ReplyContextBar {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel reply' });
      expect(cancelButton).toHaveAttribute('aria-label', 'Cancel reply');
    });
  });

  describe('Accessibility', () => {
    it('should have role="status" for screen readers', () => {
      render(<ReplyContextBar {...defaultProps} />);

      const contextBar = screen.getByRole('status');
      expect(contextBar).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      render(<ReplyContextBar {...defaultProps} />);

      const contextBar = screen.getByRole('status');
      expect(contextBar).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-label with sender name', () => {
      render(<ReplyContextBar {...defaultProps} />);

      const contextBar = screen.getByRole('status');
      expect(contextBar).toHaveAttribute('aria-label', 'Replying to abc123def4...');
    });

    it('should have keyboard-focusable cancel button', () => {
      render(<ReplyContextBar {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel reply' });
      cancelButton.focus();
      expect(document.activeElement).toBe(cancelButton);
    });
  });

  describe('Visual Styling', () => {
    it('should have proper background styling', () => {
      const { container } = render(<ReplyContextBar {...defaultProps} />);

      const contextBar = container.firstChild as HTMLElement;
      expect(contextBar).toHaveClass('bg-hush-bg-dark/50');
    });

    it('should have border bottom', () => {
      const { container } = render(<ReplyContextBar {...defaultProps} />);

      const contextBar = container.firstChild as HTMLElement;
      expect(contextBar).toHaveClass('border-b');
    });

    it('should have flex layout', () => {
      const { container } = render(<ReplyContextBar {...defaultProps} />);

      const contextBar = container.firstChild as HTMLElement;
      expect(contextBar).toHaveClass('flex');
      expect(contextBar).toHaveClass('items-center');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content', () => {
      const emptyMessage = {
        ...mockMessage,
        content: '',
      };
      render(<ReplyContextBar replyingTo={emptyMessage} onCancel={vi.fn()} />);

      // Should still render without crashing
      expect(screen.getByText('Replying to')).toBeInTheDocument();
    });

    it('should handle very short public key', () => {
      const shortKeyMessage = {
        ...mockMessage,
        senderPublicKey: 'abc',
      };
      render(<ReplyContextBar replyingTo={shortKeyMessage} onCancel={vi.fn()} />);

      // Should show truncated key even if short
      expect(screen.getByText('abc...')).toBeInTheDocument();
    });
  });
});

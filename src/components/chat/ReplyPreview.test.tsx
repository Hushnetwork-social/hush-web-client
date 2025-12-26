/**
 * ReplyPreview Tests
 *
 * Tests for the reply preview component that displays inside message bubbles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplyPreview } from './ReplyPreview';

// Mock the feeds store
const mockGetMessageById = vi.fn();
vi.mock('@/modules/feeds/useFeedsStore', () => ({
  useFeedsStore: (selector: (state: { getMessageById: typeof mockGetMessageById }) => unknown) =>
    selector({ getMessageById: mockGetMessageById }),
}));

describe('ReplyPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering with valid message', () => {
    const mockMessage = {
      id: 'msg-123',
      content: 'This is the original message content',
      senderPublicKey: 'abc123def456xyz789',
      timestamp: Date.now(),
      isConfirmed: true,
    };

    beforeEach(() => {
      mockGetMessageById.mockReturnValue(mockMessage);
    });

    it('should render sender name from resolver', () => {
      const resolveDisplayName = vi.fn().mockReturnValue('Paulo Tauri');
      render(<ReplyPreview messageId="msg-123" resolveDisplayName={resolveDisplayName} />);

      expect(screen.getByText('Paulo Tauri')).toBeInTheDocument();
      expect(resolveDisplayName).toHaveBeenCalledWith('abc123def456xyz789');
    });

    it('should fallback to truncated public key when no resolver provided', () => {
      render(<ReplyPreview messageId="msg-123" />);

      // Should show first 10 chars + "..."
      expect(screen.getByText('abc123def4...')).toBeInTheDocument();
    });

    it('should render message content', () => {
      render(<ReplyPreview messageId="msg-123" />);

      expect(screen.getByText('This is the original message content')).toBeInTheDocument();
    });

    it('should truncate long message content', () => {
      const longMessage = {
        ...mockMessage,
        content: 'A'.repeat(100), // 100 character message
      };
      mockGetMessageById.mockReturnValue(longMessage);

      render(<ReplyPreview messageId="msg-123" />);

      // Should truncate to 80 chars + "..."
      expect(screen.getByText('A'.repeat(80) + '...')).toBeInTheDocument();
    });

    it('should be clickable when onPreviewClick is provided', () => {
      const onPreviewClick = vi.fn();
      render(<ReplyPreview messageId="msg-123" onPreviewClick={onPreviewClick} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should call onPreviewClick with message ID when clicked', () => {
      const onPreviewClick = vi.fn();
      render(<ReplyPreview messageId="msg-123" onPreviewClick={onPreviewClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onPreviewClick).toHaveBeenCalledWith('msg-123');
    });

    it('should have correct aria-label for accessibility', () => {
      render(<ReplyPreview messageId="msg-123" />);

      const button = screen.getByRole('button');
      // Falls back to truncated public key when no resolver
      expect(button).toHaveAttribute('aria-label', 'Reply to message from abc123def4...');
    });

    it('should have aria-label with resolved name', () => {
      const resolveDisplayName = vi.fn().mockReturnValue('Paulo Tauri');
      render(<ReplyPreview messageId="msg-123" resolveDisplayName={resolveDisplayName} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Reply to message from Paulo Tauri');
    });

    it('should be keyboard focusable', () => {
      render(<ReplyPreview messageId="msg-123" />);

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Rendering with deleted/missing message', () => {
    beforeEach(() => {
      mockGetMessageById.mockReturnValue(null);
    });

    it('should show deleted message placeholder', () => {
      render(<ReplyPreview messageId="deleted-msg" />);

      expect(screen.getByText('Reply to deleted message')).toBeInTheDocument();
    });

    it('should have aria-label for deleted message', () => {
      render(<ReplyPreview messageId="deleted-msg" />);

      const container = screen.getByLabelText('Reply to deleted message');
      expect(container).toBeInTheDocument();
    });

    it('should not be clickable when message is deleted', () => {
      const onPreviewClick = vi.fn();
      render(<ReplyPreview messageId="deleted-msg" onPreviewClick={onPreviewClick} />);

      // Should not have a button role
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render in italic style', () => {
      const { container } = render(<ReplyPreview messageId="deleted-msg" />);

      const italicText = container.querySelector('.italic');
      expect(italicText).toBeInTheDocument();
    });
  });

  describe('Visual styling', () => {
    const mockMessage = {
      id: 'msg-123',
      content: 'Test message',
      senderPublicKey: 'abc123def456',
      timestamp: Date.now(),
      isConfirmed: true,
    };

    beforeEach(() => {
      mockGetMessageById.mockReturnValue(mockMessage);
    });

    it('should have left border styling', () => {
      const { container } = render(<ReplyPreview messageId="msg-123" />);

      const button = container.querySelector('.border-l-2');
      expect(button).toBeInTheDocument();
    });

    it('should have purple border for valid message', () => {
      const { container } = render(<ReplyPreview messageId="msg-123" />);

      const button = container.querySelector('.border-hush-purple');
      expect(button).toBeInTheDocument();
    });

    it('should have subtle background', () => {
      const { container } = render(<ReplyPreview messageId="msg-123" />);

      const button = container.querySelector('.bg-hush-bg-hover\\/30');
      expect(button).toBeInTheDocument();
    });
  });
});

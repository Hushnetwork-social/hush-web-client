/**
 * ReplyPreview Tests
 *
 * FEAT-056: Updated to test async loading states.
 * Tests for the reply preview component that displays inside message bubbles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReplyPreview } from './ReplyPreview';

// Mock the feeds store
const mockGetMessageById = vi.fn();
const mockFetchMessageById = vi.fn();
vi.mock('@/modules/feeds/useFeedsStore', () => ({
  useFeedsStore: (selector: (state: {
    getMessageById: typeof mockGetMessageById;
    fetchMessageById: typeof mockFetchMessageById;
  }) => unknown) =>
    selector({
      getMessageById: mockGetMessageById,
      fetchMessageById: mockFetchMessageById,
    }),
}));

describe('ReplyPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cached message, fetch returns null
    mockGetMessageById.mockReturnValue(undefined);
    mockFetchMessageById.mockResolvedValue(null);
  });

  describe('Rendering with cached message', () => {
    const mockMessage = {
      id: 'msg-123',
      feedId: 'feed-1',
      content: 'This is the original message content',
      senderPublicKey: 'abc123def456xyz789',
      senderName: 'Server User Name',
      timestamp: Date.now(),
      isConfirmed: true,
    };

    beforeEach(() => {
      mockGetMessageById.mockReturnValue(mockMessage);
    });

    it('should render sender name from resolver', () => {
      const resolveDisplayName = vi.fn().mockReturnValue('Paulo Tauri');
      render(
        <ReplyPreview
          messageId="msg-123"
          feedId="feed-1"
          resolveDisplayName={resolveDisplayName}
        />
      );

      expect(screen.getByText('Paulo Tauri')).toBeInTheDocument();
      // Now passes both publicKey and senderName to resolver
      expect(resolveDisplayName).toHaveBeenCalledWith('abc123def456xyz789', 'Server User Name');
    });

    it('should use senderName when no resolver provided', () => {
      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      // Now uses senderName from message when no resolver
      expect(screen.getByText('Server User Name')).toBeInTheDocument();
    });

    it('should fallback to truncated public key when no resolver and no senderName', () => {
      // Message without senderName
      mockGetMessageById.mockReturnValue({
        id: 'msg-123',
        feedId: 'feed-1',
        content: 'Test message',
        senderPublicKey: 'abc123def456xyz789',
        timestamp: Date.now(),
        isConfirmed: true,
      });
      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      // Should show first 10 chars + "..."
      expect(screen.getByText('abc123def4...')).toBeInTheDocument();
    });

    it('should render message content', () => {
      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      expect(screen.getByText('This is the original message content')).toBeInTheDocument();
    });

    it('should truncate long message content', () => {
      const longMessage = {
        ...mockMessage,
        content: 'A'.repeat(100), // 100 character message
      };
      mockGetMessageById.mockReturnValue(longMessage);

      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      // Should truncate to 80 chars + "..."
      expect(screen.getByText('A'.repeat(80) + '...')).toBeInTheDocument();
    });

    it('should be clickable when onPreviewClick is provided', () => {
      const onPreviewClick = vi.fn();
      render(
        <ReplyPreview
          messageId="msg-123"
          feedId="feed-1"
          onPreviewClick={onPreviewClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should call onPreviewClick with message ID when clicked', () => {
      const onPreviewClick = vi.fn();
      render(
        <ReplyPreview
          messageId="msg-123"
          feedId="feed-1"
          onPreviewClick={onPreviewClick}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      expect(onPreviewClick).toHaveBeenCalledWith('msg-123');
    });

    it('should have correct aria-label for accessibility', () => {
      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      const button = screen.getByRole('button');
      // Now uses senderName when no resolver
      expect(button).toHaveAttribute('aria-label', 'Reply to message from Server User Name');
    });

    it('should have aria-label with resolved name', () => {
      const resolveDisplayName = vi.fn().mockReturnValue('Paulo Tauri');
      render(
        <ReplyPreview
          messageId="msg-123"
          feedId="feed-1"
          resolveDisplayName={resolveDisplayName}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Reply to message from Paulo Tauri');
    });

    it('should be keyboard focusable', () => {
      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should not fetch from server when message is cached', () => {
      render(<ReplyPreview messageId="msg-123" feedId="feed-1" />);

      // fetchMessageById should not be called when message is in cache
      expect(mockFetchMessageById).not.toHaveBeenCalled();
    });
  });

  describe('Rendering with async fetch', () => {
    const mockFetchedMessage = {
      id: 'msg-456',
      feedId: 'feed-1',
      content: 'Fetched from server',
      senderPublicKey: 'xyz789abc123',
      senderName: 'Fetched User',
      timestamp: Date.now(),
      isConfirmed: true,
    };

    beforeEach(() => {
      mockGetMessageById.mockReturnValue(undefined);
    });

    it('should show loading state initially', () => {
      // Make fetch never resolve during this test
      mockFetchMessageById.mockReturnValue(new Promise(() => {}));

      render(<ReplyPreview messageId="msg-456" feedId="feed-1" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading reply preview')).toBeInTheDocument();
    });

    it('should render fetched message after async load', async () => {
      mockFetchMessageById.mockResolvedValue(mockFetchedMessage);

      render(<ReplyPreview messageId="msg-456" feedId="feed-1" />);

      await waitFor(() => {
        expect(screen.getByText('Fetched from server')).toBeInTheDocument();
      });
      expect(screen.getByText('Fetched User')).toBeInTheDocument();
    });

    it('should show unavailable message when fetch fails', async () => {
      mockFetchMessageById.mockResolvedValue(null);

      render(<ReplyPreview messageId="msg-456" feedId="feed-1" />);

      await waitFor(() => {
        expect(screen.getByText('Original message unavailable')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Original message unavailable')).toBeInTheDocument();
    });

    it('should show unavailable message when fetch rejects', async () => {
      mockFetchMessageById.mockRejectedValue(new Error('Network error'));

      render(<ReplyPreview messageId="msg-456" feedId="feed-1" />);

      await waitFor(() => {
        expect(screen.getByText('Original message unavailable')).toBeInTheDocument();
      });
    });

    it('should call fetchMessageById with correct params', async () => {
      mockFetchMessageById.mockResolvedValue(mockFetchedMessage);

      render(<ReplyPreview messageId="msg-456" feedId="feed-1" />);

      await waitFor(() => {
        expect(mockFetchMessageById).toHaveBeenCalledWith('feed-1', 'msg-456');
      });
    });
  });

  describe('Unavailable message state', () => {
    beforeEach(() => {
      mockGetMessageById.mockReturnValue(undefined);
      mockFetchMessageById.mockResolvedValue(null);
    });

    it('should show unavailable message placeholder', async () => {
      render(<ReplyPreview messageId="deleted-msg" feedId="feed-1" />);

      await waitFor(() => {
        expect(screen.getByText('Original message unavailable')).toBeInTheDocument();
      });
    });

    it('should have aria-label for unavailable message', async () => {
      render(<ReplyPreview messageId="deleted-msg" feedId="feed-1" />);

      await waitFor(() => {
        const container = screen.getByLabelText('Original message unavailable');
        expect(container).toBeInTheDocument();
      });
    });

    it('should not be clickable when message is unavailable', async () => {
      const onPreviewClick = vi.fn();
      render(
        <ReplyPreview
          messageId="deleted-msg"
          feedId="feed-1"
          onPreviewClick={onPreviewClick}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Original message unavailable')).toBeInTheDocument();
      });

      // Should not have a button role
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render in italic style', async () => {
      const { container } = render(
        <ReplyPreview messageId="deleted-msg" feedId="feed-1" />
      );

      await waitFor(() => {
        const italicText = container.querySelector('.italic');
        expect(italicText).toBeInTheDocument();
      });
    });
  });

  describe('Visual styling', () => {
    const mockMessage = {
      id: 'msg-123',
      feedId: 'feed-1',
      content: 'Test message',
      senderPublicKey: 'abc123def456',
      timestamp: Date.now(),
      isConfirmed: true,
    };

    beforeEach(() => {
      mockGetMessageById.mockReturnValue(mockMessage);
    });

    it('should have left border styling', () => {
      const { container } = render(
        <ReplyPreview messageId="msg-123" feedId="feed-1" />
      );

      const button = container.querySelector('.border-l-2');
      expect(button).toBeInTheDocument();
    });

    it('should have purple border for valid message', () => {
      const { container } = render(
        <ReplyPreview messageId="msg-123" feedId="feed-1" />
      );

      const button = container.querySelector('.border-hush-purple');
      expect(button).toBeInTheDocument();
    });

    it('should have subtle background', () => {
      const { container } = render(
        <ReplyPreview messageId="msg-123" feedId="feed-1" />
      );

      const button = container.querySelector('.bg-hush-bg-hover\\/30');
      expect(button).toBeInTheDocument();
    });
  });
});

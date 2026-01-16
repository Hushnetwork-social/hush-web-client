/**
 * MentionOverlay Tests
 *
 * Tests for the mention overlay component that displays participant list
 * for mention selection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionOverlay, MentionParticipant } from './MentionOverlay';

// Mock scrollIntoView since it's not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn();

describe('MentionOverlay', () => {
  const mockParticipants: MentionParticipant[] = [
    { identityId: 'id1', displayName: 'Alice Smith', publicAddress: 'addr1' },
    { identityId: 'id2', displayName: 'Bob Johnson', publicAddress: 'addr2' },
    { identityId: 'id3', displayName: 'Jane Doe', publicAddress: 'addr3' },
  ];

  const defaultProps = {
    participants: mockParticipants,
    filterText: '',
    isOpen: true,
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render participants list when open', () => {
      render(<MentionOverlay {...defaultProps} />);

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<MentionOverlay {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    });

    it('should render avatar initials for each participant', () => {
      render(<MentionOverlay {...defaultProps} />);

      // Alice Smith -> AS
      expect(screen.getByText('AS')).toBeInTheDocument();
      // Bob Johnson -> BJ
      expect(screen.getByText('BJ')).toBeInTheDocument();
      // Jane Doe -> JD
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should have dialog role with label', () => {
      render(<MentionOverlay {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Select participant to mention');
    });

    it('should have listbox role for participant list', () => {
      render(<MentionOverlay {...defaultProps} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter participants by display name', () => {
      render(<MentionOverlay {...defaultProps} filterText="ali" />);

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });

    it('should filter case-insensitively', () => {
      render(<MentionOverlay {...defaultProps} filterText="ALICE" />);

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('should show empty state when no matches', () => {
      render(<MentionOverlay {...defaultProps} filterText="xyz" />);

      expect(screen.getByText('No participants match')).toBeInTheDocument();
    });

    it('should filter by partial name match', () => {
      render(<MentionOverlay {...defaultProps} filterText="ja" />);

      // Jane matches "ja"
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    });
  });

  describe('Highlighting', () => {
    it('should highlight first item by default', () => {
      render(<MentionOverlay {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('should update highlight on mouse enter', () => {
      render(<MentionOverlay {...defaultProps} />);

      const options = screen.getAllByRole('option');
      fireEvent.mouseEnter(options[1]);

      expect(options[0]).toHaveAttribute('aria-selected', 'false');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should move highlight down on ArrowDown', () => {
      render(<MentionOverlay {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'ArrowDown' });

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should move highlight up on ArrowUp', () => {
      render(<MentionOverlay {...defaultProps} />);

      // First go down, then up
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap to first item when ArrowDown at end', () => {
      render(<MentionOverlay {...defaultProps} />);

      // Go to last item
      fireEvent.keyDown(document, { key: 'ArrowDown' }); // index 1
      fireEvent.keyDown(document, { key: 'ArrowDown' }); // index 2
      fireEvent.keyDown(document, { key: 'ArrowDown' }); // wrap to 0

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap to last item when ArrowUp at beginning', () => {
      render(<MentionOverlay {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'ArrowUp' });

      const options = screen.getAllByRole('option');
      expect(options[2]).toHaveAttribute('aria-selected', 'true');
    });

    it('should call onSelect on Enter key', () => {
      const onSelect = vi.fn();
      render(<MentionOverlay {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(mockParticipants[0]);
    });

    it('should call onSelect on Tab key', () => {
      const onSelect = vi.fn();
      render(<MentionOverlay {...defaultProps} onSelect={onSelect} />);

      fireEvent.keyDown(document, { key: 'Tab' });

      expect(onSelect).toHaveBeenCalledWith(mockParticipants[0]);
    });

    it('should call onClose on Escape key', () => {
      const onClose = vi.fn();
      render(<MentionOverlay {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Mouse Interaction', () => {
    it('should call onSelect when clicking a participant', () => {
      const onSelect = vi.fn();
      render(<MentionOverlay {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Bob Johnson'));

      expect(onSelect).toHaveBeenCalledWith(mockParticipants[1]);
    });
  });

  describe('Empty State', () => {
    it('should show empty message when participants array is empty', () => {
      render(<MentionOverlay {...defaultProps} participants={[]} />);

      expect(screen.getByText('No participants match')).toBeInTheDocument();
    });

    it('should have status role for empty state', () => {
      render(<MentionOverlay {...defaultProps} filterText="xyz" />);

      const emptyMessage = screen.getByRole('status');
      expect(emptyMessage).toHaveTextContent('No participants match');
    });
  });

  describe('Edge Cases', () => {
    it('should have title attribute for full name on hover', () => {
      const longNameParticipant: MentionParticipant = {
        identityId: 'id-long',
        displayName: 'Alexander the Great of Macedonia and Persia',
        publicAddress: 'addr-long',
      };
      render(
        <MentionOverlay
          {...defaultProps}
          participants={[longNameParticipant]}
        />
      );

      const nameSpan = screen.getByText('Alexander the Great of Macedonia and Persia');
      expect(nameSpan).toHaveAttribute('title', 'Alexander the Great of Macedonia and Persia');
    });

    it('should display unicode names correctly', () => {
      const unicodeParticipant: MentionParticipant = {
        identityId: 'id-unicode',
        displayName: 'José García Müller',
        publicAddress: 'addr-unicode',
      };
      render(
        <MentionOverlay
          {...defaultProps}
          participants={[unicodeParticipant]}
        />
      );

      expect(screen.getByText('José García Müller')).toBeInTheDocument();
      expect(screen.getByText('JG')).toBeInTheDocument(); // initials
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should have min-height for touch targets', () => {
      render(<MentionOverlay {...defaultProps} />);

      const options = screen.getAllByRole('option');
      options.forEach((option) => {
        expect(option).toHaveClass('min-h-[48px]');
      });
    });

    it('should have touch-manipulation for better touch handling', () => {
      render(<MentionOverlay {...defaultProps} />);

      const options = screen.getAllByRole('option');
      options.forEach((option) => {
        expect(option).toHaveClass('touch-manipulation');
      });
    });

    it('should have overscroll-contain to prevent page scroll', () => {
      render(<MentionOverlay {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveClass('overscroll-contain');
    });
  });

  describe('Accessibility', () => {
    it('should have id on listbox for ARIA controls', () => {
      render(<MentionOverlay {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('id', 'mention-listbox');
    });

    it('should have unique ids on each option', () => {
      render(<MentionOverlay {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('id', 'mention-option-id1');
      expect(options[1]).toHaveAttribute('id', 'mention-option-id2');
      expect(options[2]).toHaveAttribute('id', 'mention-option-id3');
    });

    it('should have aria-label on listbox', () => {
      render(<MentionOverlay {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Participants');
    });
  });
});

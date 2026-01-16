/**
 * MentionBadge Tests
 *
 * Tests for the mention badge component that displays a pulsing "@" indicator.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MentionBadge } from './MentionBadge';

describe('MentionBadge', () => {
  describe('Visibility', () => {
    it('should render when isVisible is true', () => {
      render(<MentionBadge isVisible={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should not render when isVisible is false', () => {
      render(<MentionBadge isVisible={false} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should display "@" symbol when visible', () => {
      render(<MentionBadge isVisible={true} />);

      expect(screen.getByText('@')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have purple background class', () => {
      render(<MentionBadge isVisible={true} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('bg-hush-purple');
    });

    it('should have white text class', () => {
      render(<MentionBadge isVisible={true} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('text-white');
    });

    it('should have rounded-full class for pill shape', () => {
      render(<MentionBadge isVisible={true} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('rounded-full');
    });

    it('should have pulse animation class', () => {
      render(<MentionBadge isVisible={true} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('animate-mention-pulse');
    });

    it('should have bold font weight', () => {
      render(<MentionBadge isVisible={true} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveClass('font-bold');
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      render(<MentionBadge isVisible={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label for screen readers', () => {
      render(<MentionBadge isVisible={true} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', 'Unread mentions');
    });
  });
});

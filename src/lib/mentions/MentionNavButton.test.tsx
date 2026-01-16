/**
 * MentionNavButton Tests
 *
 * Tests for the floating mention navigation button component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionNavButton } from './MentionNavButton';

describe('MentionNavButton', () => {
  describe('Visibility', () => {
    it('should render when count is greater than 0', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not render when count is 0', () => {
      render(<MentionNavButton count={0} onNavigate={() => {}} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should not render when count is negative', () => {
      render(<MentionNavButton count={-1} onNavigate={() => {}} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Count Display', () => {
    it('should display count of 1', () => {
      render(<MentionNavButton count={1} onNavigate={() => {}} />);

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should display count of 5', () => {
      render(<MentionNavButton count={5} onNavigate={() => {}} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display count of 9', () => {
      render(<MentionNavButton count={9} onNavigate={() => {}} />);

      expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('should display "9+" when count is 10', () => {
      render(<MentionNavButton count={10} onNavigate={() => {}} />);

      expect(screen.getByText('9+')).toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });

    it('should display "9+" when count is greater than 9', () => {
      render(<MentionNavButton count={25} onNavigate={() => {}} />);

      expect(screen.getByText('9+')).toBeInTheDocument();
    });
  });

  describe('@ Icon', () => {
    it('should display "@" symbol', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      expect(screen.getByText('@')).toBeInTheDocument();
    });

    it('should have aria-hidden on @ symbol', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const atSymbol = screen.getByText('@');
      expect(atSymbol).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Click Handling', () => {
    it('should call onNavigate when clicked', () => {
      const onNavigate = vi.fn();
      render(<MentionNavButton count={3} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigate only once per click', () => {
      const onNavigate = vi.fn();
      render(<MentionNavButton count={3} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByRole('button'));

      expect(onNavigate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Styling', () => {
    it('should have 32px size classes (w-8 h-8)', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-8');
      expect(button).toHaveClass('h-8');
    });

    it('should have purple background', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-hush-purple');
    });

    it('should have rounded-full class', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('rounded-full');
    });

    it('should have shadow class for elevation', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('shadow-lg');
    });
  });

  describe('Accessibility', () => {
    it('should have type="button"', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have aria-label with count', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Navigate to mentions, 3 unread');
    });

    it('should update aria-label when count changes', () => {
      const { rerender } = render(<MentionNavButton count={3} onNavigate={() => {}} />);

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Navigate to mentions, 3 unread'
      );

      rerender(<MentionNavButton count={7} onNavigate={() => {}} />);

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Navigate to mentions, 7 unread'
      );
    });

    it('should have focus ring classes', () => {
      render(<MentionNavButton count={3} onNavigate={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:ring-2');
      expect(button).toHaveClass('focus:ring-hush-purple');
    });
  });
});

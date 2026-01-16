/**
 * MentionText Tests
 *
 * Tests for the mention text component that renders styled mentions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionText } from './MentionText';

describe('MentionText', () => {
  describe('Rendering', () => {
    it('should render display name with @ prefix', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      expect(screen.getByText('@Alice')).toBeInTheDocument();
    });

    it('should have purple text color class', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      const mention = screen.getByText('@Alice');
      expect(mention).toHaveClass('text-hush-purple');
    });

    it('should have semibold font weight class', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      const mention = screen.getByText('@Alice');
      expect(mention).toHaveClass('font-semibold');
    });

    it('should use dark text color when isOwn is true', () => {
      render(<MentionText displayName="Alice" identityId="abc123" isOwn={true} />);

      const mention = screen.getByText('@Alice');
      expect(mention).toHaveClass('text-hush-bg-dark/90');
    });

    it('should use purple text color when isOwn is false', () => {
      render(<MentionText displayName="Alice" identityId="abc123" isOwn={false} />);

      const mention = screen.getByText('@Alice');
      expect(mention).toHaveClass('text-hush-purple');
    });

    it('should have cursor pointer class', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      const mention = screen.getByText('@Alice');
      expect(mention).toHaveClass('cursor-pointer');
    });

    it('should have hover:underline class', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      const mention = screen.getByText('@Alice');
      expect(mention).toHaveClass('hover:underline');
    });
  });

  describe('Accessibility', () => {
    it('should have role="button"', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have tabIndex for keyboard accessibility', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      const mention = screen.getByRole('button');
      expect(mention).toHaveAttribute('tabIndex', '0');
    });

    it('should have aria-label with user name', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      const mention = screen.getByRole('button');
      expect(mention).toHaveAttribute('aria-label', 'Mentioned user: Alice');
    });
  });

  describe('Click Interaction', () => {
    it('should call onClick with identityId when clicked', () => {
      const onClick = vi.fn();
      render(<MentionText displayName="Alice" identityId="abc123" onClick={onClick} />);

      fireEvent.click(screen.getByText('@Alice'));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith('abc123');
    });

    it('should not throw when clicked without onClick handler', () => {
      render(<MentionText displayName="Alice" identityId="abc123" />);

      // Should not throw
      fireEvent.click(screen.getByText('@Alice'));
    });
  });

  describe('Keyboard Interaction', () => {
    it('should call onClick when Enter key is pressed', () => {
      const onClick = vi.fn();
      render(<MentionText displayName="Alice" identityId="abc123" onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith('abc123');
    });

    it('should call onClick when Space key is pressed', () => {
      const onClick = vi.fn();
      render(<MentionText displayName="Alice" identityId="abc123" onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(onClick).toHaveBeenCalledWith('abc123');
    });

    it('should not call onClick for other keys', () => {
      const onClick = vi.fn();
      render(<MentionText displayName="Alice" identityId="abc123" onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });

      expect(onClick).not.toHaveBeenCalled();
    });
  });
});

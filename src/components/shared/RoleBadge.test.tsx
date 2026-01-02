/**
 * Unit tests for RoleBadge component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleBadge } from './RoleBadge';

describe('RoleBadge', () => {
  describe('Role Display', () => {
    it('should render Admin badge with correct label', () => {
      render(<RoleBadge role="Admin" />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('should render Member badge with correct label', () => {
      render(<RoleBadge role="Member" />);
      expect(screen.getByText('Member')).toBeInTheDocument();
    });

    it('should render Blocked badge with correct label', () => {
      render(<RoleBadge role="Blocked" />);
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should apply medium size classes by default', () => {
      render(<RoleBadge role="Admin" />);
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('px-2');
      expect(badge.className).toContain('py-1');
    });

    it('should apply small size classes when size is sm', () => {
      render(<RoleBadge role="Admin" size="sm" />);
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('px-1.5');
      expect(badge.className).toContain('py-0.5');
    });
  });

  describe('Label Visibility', () => {
    it('should show label by default', () => {
      render(<RoleBadge role="Member" />);
      expect(screen.getByText('Member')).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      render(<RoleBadge role="Member" showLabel={false} />);
      expect(screen.queryByText('Member')).not.toBeInTheDocument();
    });

    it('should still have accessible label when text is hidden', () => {
      render(<RoleBadge role="Member" showLabel={false} />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Role: Member');
    });
  });

  describe('Role Styling', () => {
    it('should apply amber colors for Admin', () => {
      render(<RoleBadge role="Admin" />);
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('bg-amber-500/20');
    });

    it('should apply purple colors for Member', () => {
      render(<RoleBadge role="Member" />);
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('bg-hush-purple/20');
    });

    it('should apply red colors for Blocked', () => {
      render(<RoleBadge role="Blocked" />);
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('bg-red-500/20');
    });
  });

  describe('Accessibility', () => {
    it('should have status role', () => {
      render(<RoleBadge role="Admin" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label with role name for Admin', () => {
      render(<RoleBadge role="Admin" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Role: Admin');
    });

    it('should have aria-label with role name for Member', () => {
      render(<RoleBadge role="Member" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Role: Member');
    });

    it('should have aria-label with role name for Blocked', () => {
      render(<RoleBadge role="Blocked" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Role: Blocked');
    });

    it('should have hidden icon for screen readers', () => {
      render(<RoleBadge role="Admin" />);
      const badge = screen.getByRole('status');
      const svg = badge.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Icon Display', () => {
    it('should render Shield icon for Admin', () => {
      render(<RoleBadge role="Admin" />);
      const badge = screen.getByRole('status');
      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render User icon for Member', () => {
      render(<RoleBadge role="Member" />);
      const badge = screen.getByRole('status');
      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render Ban icon for Blocked', () => {
      render(<RoleBadge role="Blocked" />);
      const badge = screen.getByRole('status');
      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});

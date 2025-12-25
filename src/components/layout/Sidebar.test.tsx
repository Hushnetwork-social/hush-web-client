/**
 * Sidebar Tests
 *
 * Tests for the Sidebar component user menu functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    selectedNav: 'feeds',
    onNavSelect: vi.fn(),
    userDisplayName: 'Test User',
    userInitials: 'TU',
    onDownloadKeys: vi.fn(),
    onAccountDetails: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Menu', () => {
    it('should show user menu when profile button is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      // Click on profile button
      const profileButton = screen.getByText('Test User');
      fireEvent.click(profileButton);

      // Menu items should be visible
      expect(screen.getByText('Download keys')).toBeInTheDocument();
      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should have Account Details menu item between Download Keys and Logout', () => {
      render(<Sidebar {...defaultProps} />);

      // Open menu
      fireEvent.click(screen.getByText('Test User'));

      // Get all menu buttons
      const menuButtons = screen.getAllByRole('button').filter(
        btn => btn.textContent?.includes('Download keys') ||
               btn.textContent?.includes('Account Details') ||
               btn.textContent?.includes('Logout')
      );

      // Should have 3 menu items
      expect(menuButtons.length).toBe(3);

      // Verify order: Download keys, Account Details, Logout
      expect(menuButtons[0]).toHaveTextContent('Download keys');
      expect(menuButtons[1]).toHaveTextContent('Account Details');
      expect(menuButtons[2]).toHaveTextContent('Logout');
    });

    it('should call onAccountDetails when Account Details is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      // Open menu
      fireEvent.click(screen.getByText('Test User'));

      // Click Account Details
      fireEvent.click(screen.getByText('Account Details'));

      expect(defaultProps.onAccountDetails).toHaveBeenCalledTimes(1);
    });

    it('should close menu when Account Details is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      // Open menu
      fireEvent.click(screen.getByText('Test User'));
      expect(screen.getByText('Account Details')).toBeInTheDocument();

      // Click Account Details
      fireEvent.click(screen.getByText('Account Details'));

      // Menu should be closed
      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });

    it('should call onDownloadKeys when Download Keys is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      // Open menu
      fireEvent.click(screen.getByText('Test User'));

      // Click Download Keys
      fireEvent.click(screen.getByText('Download keys'));

      expect(defaultProps.onDownloadKeys).toHaveBeenCalledTimes(1);
    });

    it('should call onLogout when Logout is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      // Open menu
      fireEvent.click(screen.getByText('Test User'));

      // Click Logout
      fireEvent.click(screen.getByText('Logout'));

      expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation', () => {
    it('should render navigation items', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Feeds')).toBeInTheDocument();
      expect(screen.getByText('New Feed')).toBeInTheDocument();
      expect(screen.getByText('Memes')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
    });

    it('should call onNavSelect when nav item is clicked', () => {
      render(<Sidebar {...defaultProps} />);

      fireEvent.click(screen.getByText('Feeds'));

      expect(defaultProps.onNavSelect).toHaveBeenCalledWith('feeds');
    });
  });
});

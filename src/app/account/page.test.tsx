/**
 * Account Page Tests
 *
 * Tests for the Account Details page component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AccountPage from './page';
import { useAppStore } from '@/stores';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
}));

// Mock next/dynamic to render components directly
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<any>) => {
    // Return a mock component that renders nothing for PasswordDialog
    const Component = ({ isOpen, onConfirm, onCancel, title }: any) => {
      if (!isOpen) return null;
      return (
        <div data-testid="password-dialog" role="dialog">
          <span>{title}</span>
          <button onClick={() => onConfirm('test-password')}>Confirm</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      );
    };
    Component.displayName = 'MockDynamicComponent';
    return Component;
  },
}));

// Mock the debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

// Mock the downloadCredentialsFile function
const mockDownloadCredentialsFile = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/crypto', () => ({
  downloadCredentialsFile: (...args: any[]) => mockDownloadCredentialsFile(...args),
}));

describe('AccountPage', () => {
  const mockCredentials = {
    signingPublicKey: '04a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
    signingPrivateKey: 'private-signing-key',
    encryptionPublicKey: '04x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4z3y2x1w0v9u8',
    encryptionPrivateKey: 'private-encryption-key',
    mnemonic: ['word1', 'word2', 'word3', 'word4'],
  };

  const mockCurrentUser = {
    displayName: 'Alice',
    initials: 'A',
    publicKey: mockCredentials.signingPublicKey,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockDownloadCredentialsFile.mockClear();

    // Set authenticated state
    useAppStore.setState({
      isAuthenticated: true,
      currentUser: mockCurrentUser,
      credentials: mockCredentials,
    });
  });

  afterEach(async () => {
    // Run all pending timers to prevent act() warnings from state updates
    await act(async () => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
    useAppStore.setState({
      isAuthenticated: false,
      currentUser: null,
      credentials: null,
    });
  });

  describe('Authentication', () => {
    it('should redirect to /auth when not authenticated', async () => {
      useAppStore.setState({
        isAuthenticated: false,
        currentUser: null,
        credentials: null,
      });

      render(<AccountPage />);

      // Fast-forward past the auth check delay
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(mockReplace).toHaveBeenCalledWith('/auth');
    });

    it('should render page when authenticated', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Page Rendering', () => {
    it('should render header with back button', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });

    it('should render display name in input field', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const nameInput = screen.getByDisplayValue('Alice');
      expect(nameInput).toBeInTheDocument();
    });

    it('should render Save button', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should render Download Keys button', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('button', { name: /download keys/i })).toBeInTheDocument();
    });

    it('should render both public keys', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText('Signing Key')).toBeInTheDocument();
      expect(screen.getByText('Encryption Key')).toBeInTheDocument();
    });

    it('should render key descriptions', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByText(/sign transactions/i)).toBeInTheDocument();
      expect(screen.getByText(/encrypt private messages/i)).toBeInTheDocument();
    });
  });

  describe('Back Navigation', () => {
    it('should navigate back when back button is clicked', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const backButton = screen.getByRole('button', { name: /go back/i });
      fireEvent.click(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Save Button State', () => {
    it('should disable Save button when name has not changed', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when name changes', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const nameInput = screen.getByDisplayValue('Alice');
      fireEvent.change(nameInput, { target: { value: 'Alice Updated' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should disable Save button when name is cleared', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const nameInput = screen.getByDisplayValue('Alice');
      fireEvent.change(nameInput, { target: { value: '' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable Save button when name is reverted to original', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const nameInput = screen.getByDisplayValue('Alice');

      // Change name
      fireEvent.change(nameInput, { target: { value: 'Alice Updated' } });
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();

      // Revert name
      fireEvent.change(nameInput, { target: { value: 'Alice' } });
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  describe('Save Flow', () => {
    it('should show loading state when saving', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Change name to enable save
      const nameInput = screen.getByDisplayValue('Alice');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Should show saving state
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('should show success state after saving', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Change name to enable save
      const nameInput = screen.getByDisplayValue('Alice');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Fast-forward past the save delay
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show saved state
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });

    it('should return to idle state after success timeout', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Change name
      const nameInput = screen.getByDisplayValue('Alice');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Fast-forward past save operation (800ms)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should be in success state
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      // Fast-forward past success timeout (2000ms)
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Should be back to showing Save (enabled since name still differs from original)
      const saveButtonAfter = screen.getByRole('button', { name: /save/i });
      expect(saveButtonAfter).toBeInTheDocument();
      expect(saveButtonAfter).not.toBeDisabled();
    });
  });

  describe('Download Keys', () => {
    it('should open password dialog when Download Keys is clicked', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      const downloadButton = screen.getByRole('button', { name: /download keys/i });
      fireEvent.click(downloadButton);

      expect(screen.getByTestId('password-dialog')).toBeInTheDocument();
    });

    it('should close password dialog when cancelled', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Open dialog
      const downloadButton = screen.getByRole('button', { name: /download keys/i });
      fireEvent.click(downloadButton);

      expect(screen.getByTestId('password-dialog')).toBeInTheDocument();

      // Cancel dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('password-dialog')).not.toBeInTheDocument();
    });

    it('should call downloadCredentialsFile when password is confirmed', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Open dialog
      const downloadButton = screen.getByRole('button', { name: /download keys/i });
      fireEvent.click(downloadButton);

      // Confirm with password
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(mockDownloadCredentialsFile).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form labels', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Display Name section label is properly associated with input
      expect(screen.getByText('Display Name')).toBeInTheDocument();

      // Input should be accessible and properly labeled
      const nameInput = screen.getByDisplayValue('Alice');
      expect(nameInput).toHaveAttribute('type', 'text');
      expect(nameInput).toHaveAttribute('id', 'display-name');

      // Label should be associated with input via htmlFor
      const label = screen.getByText('Display Name');
      expect(label).toHaveAttribute('for', 'display-name');
    });

    it('should have accessible buttons', async () => {
      render(<AccountPage />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download keys/i })).toBeInTheDocument();
    });
  });
});

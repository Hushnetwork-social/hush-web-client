/**
 * Unit tests for ConfirmDialog component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should render dialog when isOpen is true', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('should not render dialog when isOpen is false', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display title and message', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });
  });

  describe('Button Labels', () => {
    it('should use default button labels', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should use custom button labels', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmLabel="Delete"
          cancelLabel="Keep"
        />
      );
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('should call onCancel when Cancel button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when Confirm button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when close button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Close dialog'));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when backdrop is clicked', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);

      // Click the backdrop (first child with aria-hidden)
      const backdrop = container.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Keyboard Navigation', () => {
    it('should call onCancel when Escape key is pressed', () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onCancel on Escape when dialog is closed', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Text Confirmation', () => {
    const textConfirmProps = {
      ...defaultProps,
      requireTextConfirmation: 'DELETE',
    };

    it('should show confirmation input when requireTextConfirmation is set', () => {
      render(<ConfirmDialog {...textConfirmProps} />);
      expect(screen.getByPlaceholderText('Type "DELETE"')).toBeInTheDocument();
    });

    it('should disable confirm button until text matches', () => {
      render(<ConfirmDialog {...textConfirmProps} />);
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when text matches', () => {
      render(<ConfirmDialog {...textConfirmProps} />);

      const input = screen.getByPlaceholderText('Type "DELETE"');
      fireEvent.change(input, { target: { value: 'DELETE' } });

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).not.toBeDisabled();
    });

    it('should keep button disabled for partial match', () => {
      render(<ConfirmDialog {...textConfirmProps} />);

      const input = screen.getByPlaceholderText('Type "DELETE"');
      fireEvent.change(input, { target: { value: 'DEL' } });

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toBeDisabled();
    });

    it('should keep button disabled for wrong text', () => {
      render(<ConfirmDialog {...textConfirmProps} />);

      const input = screen.getByPlaceholderText('Type "DELETE"');
      fireEvent.change(input, { target: { value: 'delete' } }); // lowercase

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toBeDisabled();
    });

    it('should display the required text in the label', () => {
      render(<ConfirmDialog {...textConfirmProps} />);
      expect(screen.getByText('DELETE')).toBeInTheDocument();
    });

    it('should allow confirmation after typing correct text', () => {
      render(<ConfirmDialog {...textConfirmProps} />);

      const input = screen.getByPlaceholderText('Type "DELETE"');
      fireEvent.change(input, { target: { value: 'DELETE' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(textConfirmProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Danger Variant', () => {
    it('should show warning icon for danger variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />);
      // The AlertTriangle icon should be present (check by its parent container)
      const dialog = screen.getByRole('dialog');
      expect(dialog.querySelector('svg')).toBeInTheDocument();
    });

    it('should render with danger styling', () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />);
      const title = screen.getByText('Confirm Action');
      expect(title).toHaveClass('text-red-400');
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby pointing to title', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
      expect(screen.getByText('Confirm Action')).toHaveAttribute(
        'id',
        'confirm-dialog-title'
      );
    });

    it('should have accessible close button', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });
  });

  describe('State Reset', () => {
    it('should reset confirmation text when dialog closes', () => {
      const { rerender } = render(
        <ConfirmDialog {...defaultProps} requireTextConfirmation="DELETE" />
      );

      // Type something
      const input = screen.getByPlaceholderText('Type "DELETE"');
      fireEvent.change(input, { target: { value: 'DEL' } });

      // Close dialog
      rerender(
        <ConfirmDialog {...defaultProps} requireTextConfirmation="DELETE" isOpen={false} />
      );

      // Reopen dialog
      rerender(
        <ConfirmDialog {...defaultProps} requireTextConfirmation="DELETE" isOpen={true} />
      );

      // Input should be empty
      const newInput = screen.getByPlaceholderText('Type "DELETE"');
      expect(newInput).toHaveValue('');
    });
  });
});

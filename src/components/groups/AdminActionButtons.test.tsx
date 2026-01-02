import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminActionButtons } from "./AdminActionButtons";

describe("AdminActionButtons", () => {
  const mockOnAction = vi.fn();

  const defaultProps = {
    memberAddress: "member-address-123",
    memberName: "Test Member",
    onAction: mockOnAction,
  };

  beforeEach(() => {
    mockOnAction.mockClear();
  });

  describe("Member role", () => {
    it("should show Block, Ban, and Promote buttons for regular members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      expect(screen.getByRole("button", { name: /block test member/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ban test member/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /promote test member to admin/i })).toBeInTheDocument();
    });

    it("should not show Unblock button for regular members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      expect(screen.queryByRole("button", { name: /unblock/i })).not.toBeInTheDocument();
    });

    it("should call onAction with 'block' when Block is clicked", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      fireEvent.click(screen.getByRole("button", { name: /block test member/i }));

      expect(mockOnAction).toHaveBeenCalledWith("block", "member-address-123");
    });

    it("should call onAction with 'ban' when Ban is clicked", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      fireEvent.click(screen.getByRole("button", { name: /ban test member/i }));

      expect(mockOnAction).toHaveBeenCalledWith("ban", "member-address-123");
    });

    it("should call onAction with 'promote' when Promote is clicked", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      fireEvent.click(screen.getByRole("button", { name: /promote test member to admin/i }));

      expect(mockOnAction).toHaveBeenCalledWith("promote", "member-address-123");
    });
  });

  describe("Blocked role", () => {
    it("should show Unblock and Ban buttons for blocked members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Blocked" />);

      expect(screen.getByRole("button", { name: /unblock test member/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ban test member/i })).toBeInTheDocument();
    });

    it("should not show Block or Promote buttons for blocked members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Blocked" />);

      expect(screen.queryByRole("button", { name: /^block test member$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
    });

    it("should call onAction with 'unblock' when Unblock is clicked", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Blocked" />);

      fireEvent.click(screen.getByRole("button", { name: /unblock test member/i }));

      expect(mockOnAction).toHaveBeenCalledWith("unblock", "member-address-123");
    });
  });

  describe("Admin role", () => {
    it("should not render anything for Admin role", () => {
      const { container } = render(<AdminActionButtons {...defaultProps} memberRole="Admin" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Loading state", () => {
    it("should disable all buttons when isLoading is true", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" isLoading />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("should apply disabled styles when loading", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" isLoading />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("disabled:opacity-50");
      });
    });
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AdminActionButtons } from "./AdminActionButtons";

describe("AdminActionButtons", () => {
  const mockOnAction = vi.fn();

  const defaultProps = {
    memberAddress: "member-address-123",
    memberName: "Test Member",
    memberRole: "Member" as const,
    onAction: mockOnAction,
  };

  describe("Member role", () => {
    it("should show Block, Ban, and Promote buttons for regular members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      expect(screen.getByRole("button", { name: /block member/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ban member/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /promote to admin/i })).toBeInTheDocument();
    });

    it("should not show Unblock button for regular members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      expect(screen.queryByRole("button", { name: /unblock/i })).not.toBeInTheDocument();
    });

    it("should NOT call onAction when buttons are clicked (coming soon)", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      fireEvent.click(screen.getByRole("button", { name: /block member/i }));
      fireEvent.click(screen.getByRole("button", { name: /ban member/i }));
      fireEvent.click(screen.getByRole("button", { name: /promote to admin/i }));

      // Buttons are disabled/coming soon - no action should be triggered
      expect(mockOnAction).not.toHaveBeenCalled();
    });

    it("should display helpful tooltip for Block button", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      const blockButton = screen.getByRole("button", { name: /block member/i });
      expect(blockButton).toHaveAttribute("title");
      expect(blockButton.getAttribute("title")).toContain("Coming Soon");
      expect(blockButton.getAttribute("title")).toContain("cannot send messages");
    });

    it("should display helpful tooltip for Ban button", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      const banButton = screen.getByRole("button", { name: /ban member/i });
      expect(banButton).toHaveAttribute("title");
      expect(banButton.getAttribute("title")).toContain("Coming Soon");
      expect(banButton.getAttribute("title")).toContain("Remove this member");
    });

    it("should display helpful tooltip for Promote button", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      const promoteButton = screen.getByRole("button", { name: /promote to admin/i });
      expect(promoteButton).toHaveAttribute("title");
      expect(promoteButton.getAttribute("title")).toContain("Coming Soon");
      expect(promoteButton.getAttribute("title")).toContain("administrative privileges");
    });
  });

  describe("Blocked role", () => {
    it("should show Unblock and Ban buttons for blocked members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Blocked" />);

      expect(screen.getByRole("button", { name: /unblock member/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ban member/i })).toBeInTheDocument();
    });

    it("should not show Block or Promote buttons for blocked members", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Blocked" />);

      // Use exact match to avoid matching "Unblock member"
      expect(screen.queryByRole("button", { name: /^block member/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
    });

    it("should display helpful tooltip for Unblock button", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Blocked" />);

      const unblockButton = screen.getByRole("button", { name: /unblock member/i });
      expect(unblockButton).toHaveAttribute("title");
      expect(unblockButton.getAttribute("title")).toContain("Coming Soon");
      expect(unblockButton.getAttribute("title")).toContain("Restore");
    });
  });

  describe("Admin role", () => {
    it("should not render anything for Admin role", () => {
      const { container } = render(<AdminActionButtons {...defaultProps} memberRole="Admin" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Button styling", () => {
    it("should have cursor-help style for coming soon buttons", () => {
      render(<AdminActionButtons {...defaultProps} memberRole="Member" />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("cursor-help");
      });
    });
  });
});

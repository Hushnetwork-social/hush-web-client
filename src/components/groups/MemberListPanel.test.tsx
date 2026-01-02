import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemberListPanel } from "./MemberListPanel";
import type { GroupFeedMember } from "@/types";

// Mock the feeds store
vi.mock("@/modules/feeds", () => ({
  useFeedsStore: vi.fn((selector) => {
    const state = {
      updateGroupMember: vi.fn(),
      removeGroupMember: vi.fn(),
    };
    return selector(state);
  }),
}));

// Mock the group service
vi.mock("@/lib/grpc/services/group", () => ({
  groupService: {
    blockMember: vi.fn().mockResolvedValue({ success: true }),
    unblockMember: vi.fn().mockResolvedValue({ success: true }),
    banMember: vi.fn().mockResolvedValue({ success: true }),
    promoteToAdmin: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("MemberListPanel", () => {
  const mockOnClose = vi.fn();

  const mockMembers: GroupFeedMember[] = [
    { publicAddress: "admin-address", displayName: "Admin User", role: "Admin" },
    { publicAddress: "member-address", displayName: "Regular Member", role: "Member" },
    { publicAddress: "blocked-address", displayName: "Blocked User", role: "Blocked" },
    { publicAddress: "current-user-address", displayName: "Current User", role: "Member" },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    feedId: "test-feed-id",
    currentUserAddress: "current-user-address",
    currentUserRole: "Admin" as const,
    members: mockMembers,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe("Visibility", () => {
    it("should render when isOpen is true", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should not render when isOpen is false", () => {
      render(<MemberListPanel {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should display member count in header", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByText(`Members (${mockMembers.length})`)).toBeInTheDocument();
    });
  });

  describe("Member list display", () => {
    it("should display all members", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByText("Admin User")).toBeInTheDocument();
      expect(screen.getByText("Regular Member")).toBeInTheDocument();
      expect(screen.getByText("Blocked User")).toBeInTheDocument();
      expect(screen.getByText("Current User")).toBeInTheDocument();
    });

    it("should show (you) indicator for current user", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByText("(you)")).toBeInTheDocument();
    });

    it("should display role badges for Admin and Blocked", () => {
      render(<MemberListPanel {...defaultProps} />);

      // Admin badge
      expect(screen.getByTitle("Admin")).toBeInTheDocument();
      // Blocked badge
      expect(screen.getByTitle("Blocked")).toBeInTheDocument();
    });

    it("should sort members: Admins first, then Members, then Blocked", () => {
      render(<MemberListPanel {...defaultProps} />);

      const listItems = screen.getAllByRole("listitem");
      const names = listItems.map((li) => li.textContent);

      // Admin User should be first
      expect(names[0]).toContain("Admin User");
      // Blocked User should be last
      expect(names[names.length - 1]).toContain("Blocked User");
    });

    it("should display truncated public address", () => {
      render(<MemberListPanel {...defaultProps} />);

      // Should show first 20 chars + ...
      expect(screen.getByText(/admin-address.../)).toBeInTheDocument();
    });
  });

  describe("Admin actions visibility", () => {
    it("should show action buttons for non-admin members when user is admin", () => {
      render(<MemberListPanel {...defaultProps} />);

      // Should see Block/Ban/Promote buttons for Regular Member
      expect(screen.getByRole("button", { name: /block regular member/i })).toBeInTheDocument();
    });

    it("should not show action buttons when user is not admin", () => {
      render(
        <MemberListPanel {...defaultProps} currentUserRole="Member" />
      );

      // No action buttons should be visible
      expect(screen.queryByRole("button", { name: /block/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /ban/i })).not.toBeInTheDocument();
    });

    it("should not show action buttons for self", () => {
      render(<MemberListPanel {...defaultProps} />);

      // Current user is "current-user-address" - should not see actions for self
      // Note: the test checks that actions are only shown for non-self members
      const currentUserItem = screen.getByText("(you)").closest("li");
      expect(currentUserItem).toBeInTheDocument();

      // The li containing "(you)" should not have action buttons
      const buttons = currentUserItem?.querySelectorAll("button");
      // Only the close button at panel level, no action buttons in the member row
      expect(buttons?.length || 0).toBe(0);
    });

    it("should not show action buttons for other admins", () => {
      render(<MemberListPanel {...defaultProps} />);

      // Admin User row should not have action buttons
      // There should be no button to block "Admin User" specifically
      expect(screen.queryByRole("button", { name: /block admin user/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /ban admin user/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /promote admin user/i })).not.toBeInTheDocument();
    });

    it("should show Unblock instead of Block for blocked members", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByRole("button", { name: /unblock blocked user/i })).toBeInTheDocument();
    });
  });

  describe("Close functionality", () => {
    it("should call onClose when close button is clicked", () => {
      render(<MemberListPanel {...defaultProps} />);

      const closeButton = screen.getByRole("button", { name: /close member panel/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", () => {
      render(<MemberListPanel {...defaultProps} />);

      // Click the backdrop (the div with aria-hidden)
      const backdrop = screen.getByRole("dialog").previousSibling as Element;
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Empty state", () => {
    it("should show empty state when no members", () => {
      render(<MemberListPanel {...defaultProps} members={[]} />);

      expect(screen.getByText("No members found")).toBeInTheDocument();
    });
  });

  describe("Member initials", () => {
    it("should display initials from display name", () => {
      const membersWithNames: GroupFeedMember[] = [
        { publicAddress: "addr1", displayName: "John Doe", role: "Member" },
      ];

      render(
        <MemberListPanel {...defaultProps} members={membersWithNames} currentUserAddress="other" />
      );

      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("should use first 2 chars of address when no display name", () => {
      const membersNoName: GroupFeedMember[] = [
        { publicAddress: "AB123456", displayName: "", role: "Member" },
      ];

      render(
        <MemberListPanel {...defaultProps} members={membersNoName} currentUserAddress="other" />
      );

      expect(screen.getByText("AB")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible dialog role", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("should have accessible heading", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByRole("heading", { name: /members/i })).toBeInTheDocument();
    });

    it("should have accessible close button", () => {
      render(<MemberListPanel {...defaultProps} />);

      expect(screen.getByRole("button", { name: /close member panel/i })).toBeInTheDocument();
    });
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroupSettingsPanel } from "./GroupSettingsPanel";

// Mock the group service
vi.mock("@/lib/grpc/services/group", () => ({
  groupService: {
    updateTitle: vi.fn().mockResolvedValue({ success: true }),
    updateDescription: vi.fn().mockResolvedValue({ success: true }),
    leaveGroup: vi.fn().mockResolvedValue({ success: true }),
    deleteGroup: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("GroupSettingsPanel", () => {
  const mockOnClose = vi.fn();
  const mockOnLeave = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnUpdate = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    feedId: "test-feed-id",
    groupName: "Test Group",
    groupDescription: "Test description",
    isPublic: true,
    currentUserRole: "Admin" as const,
    currentUserAddress: "admin-address",
    isLastAdmin: false,
    onLeave: mockOnLeave,
    onDelete: mockOnDelete,
    onUpdate: mockOnUpdate,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnLeave.mockClear();
    mockOnDelete.mockClear();
    mockOnUpdate.mockClear();
  });

  describe("Visibility", () => {
    it("should render when isOpen is true", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should not render when isOpen is false", () => {
      render(<GroupSettingsPanel {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should display group name in header", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByRole("heading", { name: /group settings/i })).toBeInTheDocument();
    });
  });

  describe("Group Information Display", () => {
    it("should display current group name", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveValue("Test Group");
    });

    it("should display current group description", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      const descInput = screen.getByLabelText(/description/i);
      expect(descInput).toHaveValue("Test description");
    });

    it("should show Public Group for public groups", () => {
      render(<GroupSettingsPanel {...defaultProps} isPublic={true} />);

      expect(screen.getByText("Public Group")).toBeInTheDocument();
    });

    it("should show Private Group for private groups", () => {
      render(<GroupSettingsPanel {...defaultProps} isPublic={false} />);

      expect(screen.getByText("Private Group")).toBeInTheDocument();
    });
  });

  describe("Admin Edit Permissions", () => {
    it("should allow admin to edit name field", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Admin" />);

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).not.toBeDisabled();

      fireEvent.change(nameInput, { target: { value: "New Name" } });
      expect(nameInput).toHaveValue("New Name");
    });

    it("should allow admin to edit description field", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Admin" />);

      const descInput = screen.getByLabelText(/description/i);
      expect(descInput).not.toBeDisabled();

      fireEvent.change(descInput, { target: { value: "New Description" } });
      expect(descInput).toHaveValue("New Description");
    });

    it("should show Save button when admin makes changes", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Admin" />);

      // Initially no save button
      expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();

      // Make a change
      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: "New Name" } });

      // Save button should appear
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });
  });

  describe("Member Edit Restrictions", () => {
    it("should disable name field for regular member", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Member" />);

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toBeDisabled();
    });

    it("should disable description field for regular member", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Member" />);

      const descInput = screen.getByLabelText(/description/i);
      expect(descInput).toBeDisabled();
    });

    it("should not show Save button for member", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Member" />);

      expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
    });
  });

  describe("Delete Button Visibility", () => {
    it("should show Delete button for any admin", () => {
      // Any admin can delete, not just last admin
      render(<GroupSettingsPanel {...defaultProps} isLastAdmin={false} />);

      expect(screen.getByText("Delete Group")).toBeInTheDocument();
    });

    it("should show Delete button for last admin", () => {
      render(<GroupSettingsPanel {...defaultProps} isLastAdmin={true} />);

      expect(screen.getByText("Delete Group")).toBeInTheDocument();
    });

    it("should not show Delete button for member", () => {
      render(<GroupSettingsPanel {...defaultProps} currentUserRole="Member" isLastAdmin={false} />);

      expect(screen.queryByRole("button", { name: /delete group/i })).not.toBeInTheDocument();
    });
  });

  describe("Leave Group", () => {
    it("should show Leave Group button", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByText("Leave Group")).toBeInTheDocument();
    });

    it("should open confirmation dialog when Leave is clicked", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      const leaveButton = screen.getByText("Leave Group").closest("button")!;
      fireEvent.click(leaveButton);

      // ConfirmDialog uses role="dialog"
      const dialogs = screen.getAllByRole("dialog");
      expect(dialogs.length).toBeGreaterThan(1); // Main panel + confirm dialog
      expect(screen.getByText(/are you sure you want to leave/i)).toBeInTheDocument();
    });

    it("should show rejoin cooldown message for public groups", () => {
      render(<GroupSettingsPanel {...defaultProps} isPublic={true} />);

      expect(screen.getByText(/You can rejoin after ~100 blocks/i)).toBeInTheDocument();
    });

    it("should show re-invitation cooldown message for private groups", () => {
      render(<GroupSettingsPanel {...defaultProps} isPublic={false} />);

      expect(screen.getByText(/You can only be re-invited after ~100 blocks/i)).toBeInTheDocument();
    });

    it("should close confirmation when Cancel is clicked", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      // Open dialog
      const leaveButton = screen.getByText("Leave Group").closest("button")!;
      fireEvent.click(leaveButton);

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Dialog should close
      expect(screen.queryByText(/are you sure you want to leave/i)).not.toBeInTheDocument();
    });
  });

  describe("Delete Group (Admin)", () => {
    it("should open strong confirmation dialog for delete", () => {
      render(<GroupSettingsPanel {...defaultProps} isLastAdmin={true} />);

      // Find the danger zone delete button (not the dialog one)
      const deleteButtons = screen.getAllByText("Delete Group");
      const dangerZoneButton = deleteButtons[0].closest("button")!;
      fireEvent.click(dangerZoneButton);

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      // Look for specific text in the dialog
      expect(screen.getByText(/all messages and members will be permanently removed/i)).toBeInTheDocument();
    });

    it("should require typing group name to confirm delete", () => {
      render(<GroupSettingsPanel {...defaultProps} isLastAdmin={true} />);

      // Open dialog
      const deleteButtons = screen.getAllByText("Delete Group");
      const dangerZoneButton = deleteButtons[0].closest("button")!;
      fireEvent.click(dangerZoneButton);

      // Type wrong name
      const confirmInput = screen.getByPlaceholderText(/type group name here/i);
      fireEvent.change(confirmInput, { target: { value: "Wrong Name" } });

      // Find the dialog's delete button within the alertdialog
      const dialog = screen.getByRole("alertdialog");
      const dialogButtons = dialog.querySelectorAll("button");
      // The second button should be the Delete button (first is Cancel)
      const confirmDeleteButton = dialogButtons[1];

      expect(confirmDeleteButton).toBeDisabled();
    });

    it("should enable delete when correct name is typed", () => {
      render(<GroupSettingsPanel {...defaultProps} isLastAdmin={true} />);

      // Open dialog
      const deleteButtons = screen.getAllByText("Delete Group");
      const dangerZoneButton = deleteButtons[0].closest("button")!;
      fireEvent.click(dangerZoneButton);

      // Type correct name
      const confirmInput = screen.getByPlaceholderText(/type group name here/i);
      fireEvent.change(confirmInput, { target: { value: "Test Group" } });

      // Find the dialog's delete button within the alertdialog
      const dialog = screen.getByRole("alertdialog");
      const dialogButtons = dialog.querySelectorAll("button");
      // The second button should be the Delete button (first is Cancel)
      const confirmDeleteButton = dialogButtons[1];

      expect(confirmDeleteButton).not.toBeDisabled();
    });
  });

  describe("Close functionality", () => {
    it("should call onClose when close button is clicked", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      const closeButton = screen.getByRole("button", { name: /close settings panel/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      // Click the backdrop
      const backdrop = screen.getByRole("dialog").previousSibling as Element;
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should have accessible dialog role", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("should have accessible heading", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByRole("heading", { name: /group settings/i })).toBeInTheDocument();
    });

    it("should have accessible close button", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByRole("button", { name: /close settings panel/i })).toBeInTheDocument();
    });

    it("should have accessible form labels", () => {
      render(<GroupSettingsPanel {...defaultProps} />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });
  });
});

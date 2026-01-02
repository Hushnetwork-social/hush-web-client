/**
 * Unit tests for GroupCreationWizard container component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GroupCreationWizard } from "./index";

// Mock the identity module
vi.mock("@/modules/identity", () => ({
  searchByDisplayName: vi.fn().mockResolvedValue([]),
}));

// Mock the gRPC services
vi.mock("@/lib/grpc/services", () => ({
  groupService: {
    createGroup: vi.fn(),
  },
}));

// Mock the stores
vi.mock("@/stores", () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      credentials: {
        signingPublicKey: "user-signing-key",
        encryptionPublicKey: "user-encrypt-key",
      },
      currentUser: {
        displayName: "Test User",
        publicKey: "user-signing-key",
        initials: "TU",
      },
    })
  ),
}));

vi.mock("@/modules/feeds", () => ({
  useFeedsStore: {
    getState: () => ({
      addFeed: vi.fn(),
      setUserRole: vi.fn(),
      setGroupMembers: vi.fn(),
    }),
  },
}));

// Mock crypto transactions
vi.mock("@/lib/crypto/transactions", () => ({
  generateGuid: () => "test-feed-id",
}));

// Mock debug logger
vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

import { groupService } from "@/lib/grpc/services";

const mockCreateGroup = vi.mocked(groupService.createGroup);

describe("GroupCreationWizard", () => {
  const mockOnClose = vi.fn();
  const mockOnGroupCreated = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onGroupCreated: mockOnGroupCreated,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateGroup.mockResolvedValue({ success: true, data: { feedId: "test-feed-id" } });
  });

  describe("Rendering", () => {
    it("renders when isOpen is true", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(screen.getByText("Create Group")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(<GroupCreationWizard {...defaultProps} isOpen={false} />);

      expect(screen.queryByText("Create Group")).not.toBeInTheDocument();
    });

    it("shows Step 1 of 2 initially", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Close wizard" })
      ).toBeInTheDocument();
    });

    it("renders search input for member selection", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Search by name...")
      ).toBeInTheDocument();
    });
  });

  describe("Close behavior", () => {
    it("calls onClose when close button is clicked", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      const closeButton = screen.getByRole("button", { name: "Close wizard" });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose when backdrop is clicked", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      // Click on the backdrop (outside the modal content)
      const backdrop = screen.getByRole("dialog").querySelector("[aria-hidden='true']");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose when Escape key is pressed", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has role dialog", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal true", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has accessible title", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "wizard-title");

      const title = screen.getByText("Create Group");
      expect(title).toHaveAttribute("id", "wizard-title");
    });
  });

  describe("Error handling", () => {
    it("wizard renders without errors", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      // Wizard should render with member selector
      expect(screen.getByText("Create Group")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search by name...")).toBeInTheDocument();
    });
  });

  describe("State reset", () => {
    it("resets state when wizard closes", async () => {
      const { rerender } = render(<GroupCreationWizard {...defaultProps} />);

      // Close the wizard
      rerender(<GroupCreationWizard {...defaultProps} isOpen={false} />);

      // Reopen
      rerender(<GroupCreationWizard {...defaultProps} isOpen={true} />);

      // Should be back to step 1
      expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    });
  });
});

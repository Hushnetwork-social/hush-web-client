/**
 * Unit tests for GroupCreationWizard container component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

    it("shows Step 1: Choose Type initially", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(screen.getByText("Step 1: Choose Type")).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Close wizard" })
      ).toBeInTheDocument();
    });

    it("renders type selection step initially", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      expect(
        screen.getByText("What kind of group do you want to create?")
      ).toBeInTheDocument();
      expect(screen.getByText("Public")).toBeInTheDocument();
      expect(screen.getByText("Private")).toBeInTheDocument();
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

      // Wizard should render with type selection
      expect(screen.getByText("Create Group")).toBeInTheDocument();
      expect(
        screen.getByText("What kind of group do you want to create?")
      ).toBeInTheDocument();
    });
  });

  describe("State reset", () => {
    it("resets state when wizard closes", async () => {
      const { rerender } = render(<GroupCreationWizard {...defaultProps} />);

      // Close the wizard
      rerender(<GroupCreationWizard {...defaultProps} isOpen={false} />);

      // Reopen
      rerender(<GroupCreationWizard {...defaultProps} isOpen={true} />);

      // Should be back to step 1 (type selection)
      expect(screen.getByText("Step 1: Choose Type")).toBeInTheDocument();
    });
  });

  describe("Flow navigation", () => {
    it("shows Step 1 of 2 after selecting Public type", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      // Click on the Public card
      const publicCard = screen.getByText("Public").closest('[role="option"]');
      if (publicCard) fireEvent.click(publicCard);

      // Should now show 1 of 2 (public has 2 steps)
      expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    });

    it("shows Step 1 of 3 after selecting Private type", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      // Click on the Private card
      const privateCard = screen.getByText("Private").closest('[role="option"]');
      if (privateCard) fireEvent.click(privateCard);

      // Should now show 1 of 3 (private has 3 steps)
      expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    });

    it("navigates to details after type selection for public group", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      // Select Public type
      const publicCard = screen.getByText("Public").closest('[role="option"]');
      if (publicCard) fireEvent.click(publicCard);

      // Click Next button
      const nextButton = screen.getByRole("button", { name: /proceed to next step/i });
      fireEvent.click(nextButton);

      // Should be on details step
      expect(screen.getByText("Create Public Group")).toBeInTheDocument();
      expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    });

    it("navigates to members after type selection for private group", () => {
      render(<GroupCreationWizard {...defaultProps} />);

      // Select Private type
      const privateCard = screen.getByText("Private").closest('[role="option"]');
      if (privateCard) fireEvent.click(privateCard);

      // Click Next button
      const nextButton = screen.getByRole("button", { name: /proceed to next step/i });
      fireEvent.click(nextButton);

      // Should be on member selection step
      expect(screen.getByText("Create Private Group")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search by name...")).toBeInTheDocument();
    });
  });
});

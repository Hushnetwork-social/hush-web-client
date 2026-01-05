import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddMemberDialog } from "./AddMemberDialog";
import type { GroupFeedMember } from "@/types";

// Mock the feeds store
vi.mock("@/modules/feeds", () => ({
  useFeedsStore: vi.fn((selector) => {
    const state = {
      addGroupMember: vi.fn(),
    };
    return selector(state);
  }),
}));

// Mock the identity module
const mockSearchByDisplayName = vi.fn();
vi.mock("@/modules/identity", () => ({
  searchByDisplayName: (...args: unknown[]) => mockSearchByDisplayName(...args),
}));

// Mock the group transactions
const mockAddMemberToGroup = vi.fn();
vi.mock("@/lib/crypto/group-transactions", () => ({
  addMemberToGroup: (...args: unknown[]) => mockAddMemberToGroup(...args),
}));

// Mock debug logger
vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

describe("AddMemberDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnMemberAdded = vi.fn();

  const mockCurrentMembers: GroupFeedMember[] = [
    { publicAddress: "admin-address", displayName: "Admin User", role: "Admin" },
    { publicAddress: "member-address", displayName: "Existing Member", role: "Member" },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    feedId: "test-feed-id",
    adminAddress: "admin-address",
    currentMembers: mockCurrentMembers,
    onMemberAdded: mockOnMemberAdded,
  };

  const mockSearchResults = [
    {
      publicSigningAddress: "new-user-1",
      publicEncryptAddress: "encrypt-key-1",
      displayName: "New User One",
    },
    {
      publicSigningAddress: "new-user-2",
      publicEncryptAddress: "encrypt-key-2",
      displayName: "New User Two",
    },
  ];

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnMemberAdded.mockClear();
    mockSearchByDisplayName.mockClear();
    mockAddMemberToGroup.mockClear();
  });

  describe("Visibility", () => {
    it("should render when isOpen is true", () => {
      render(<AddMemberDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Add Member")).toBeInTheDocument();
    });

    it("should not render when isOpen is false", () => {
      render(<AddMemberDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Search functionality", () => {
    it("should display search input", () => {
      render(<AddMemberDialog {...defaultProps} />);

      expect(screen.getByLabelText("Search for members")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
    });

    it("should disable search button when query is empty", () => {
      render(<AddMemberDialog {...defaultProps} />);

      // Ensure the input is empty
      const searchInput = screen.getByLabelText("Search for members");
      expect(searchInput).toHaveValue("");

      // Button should be disabled when query is empty
      const searchButton = screen.getByRole("button", { name: /^search$/i });
      expect(searchButton).toBeDisabled();
    });

    it("should enable search button when query has text", () => {
      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "Test" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      expect(searchButton).toBeEnabled();
    });

    it("should call searchByDisplayName when searching", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(mockSearchByDisplayName).toHaveBeenCalledWith("New");
      });
    });

    it("should search on Enter key press", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });
      fireEvent.keyDown(searchInput, { key: "Enter" });

      await waitFor(() => {
        expect(mockSearchByDisplayName).toHaveBeenCalledWith("New");
      });
    });

    it("should display search results", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
        expect(screen.getByText("New User Two")).toBeInTheDocument();
      });
    });

    it("should filter out existing members from search results", async () => {
      const resultsWithExisting = [
        ...mockSearchResults,
        {
          publicSigningAddress: "member-address", // Already a member
          publicEncryptAddress: "existing-key",
          displayName: "Existing Member",
        },
      ];
      mockSearchByDisplayName.mockResolvedValue(resultsWithExisting);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "User" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
        expect(screen.queryByText("Existing Member")).not.toBeInTheDocument();
      });
    });

    it("should filter out admin from search results", async () => {
      const resultsWithAdmin = [
        ...mockSearchResults,
        {
          publicSigningAddress: "admin-address", // The admin
          publicEncryptAddress: "admin-key",
          displayName: "Admin User",
        },
      ];
      mockSearchByDisplayName.mockResolvedValue(resultsWithAdmin);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "User" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
        // Admin User is already in currentMembers but also matches, should be filtered
        expect(screen.queryByLabelText(/add admin user/i)).not.toBeInTheDocument();
      });
    });

    it("should show no results message when no users found", async () => {
      mockSearchByDisplayName.mockResolvedValue([]);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "NonExistent" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("No users found")).toBeInTheDocument();
      });
    });
  });

  describe("Member selection and confirmation", () => {
    it("should show confirmation screen when selecting a member", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
      });

      const selectButton = screen.getByLabelText("Add New User One to group");
      fireEvent.click(selectButton);

      await waitFor(() => {
        // Check for confirmation text - partial match since it spans elements
        expect(screen.getByText(/Are you sure you want to add this user/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Add Member" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
      });
    });

    it("should go back to search when clicking Back", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
      });

      const selectButton = screen.getByLabelText("Add New User One to group");
      fireEvent.click(selectButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: "Back" });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Search for members")).toBeInTheDocument();
      });
    });
  });

  describe("Adding member", () => {
    it("should call addMemberToGroup when confirming", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);
      mockAddMemberToGroup.mockResolvedValue({ success: true });

      render(<AddMemberDialog {...defaultProps} />);

      // Search
      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });
      fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
      });

      // Select
      fireEvent.click(screen.getByLabelText("Add New User One to group"));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Add Member" })).toBeInTheDocument();
      });

      // Confirm
      fireEvent.click(screen.getByRole("button", { name: "Add Member" }));

      await waitFor(() => {
        expect(mockAddMemberToGroup).toHaveBeenCalledWith(
          "test-feed-id",
          "admin-address",
          "new-user-1"
        );
      });
    });

    it("should show success state after adding member", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);
      mockAddMemberToGroup.mockResolvedValue({ success: true });

      render(<AddMemberDialog {...defaultProps} />);

      // Search
      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });
      fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
      });

      // Select
      fireEvent.click(screen.getByLabelText("Add New User One to group"));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Add Member" })).toBeInTheDocument();
      });

      // Confirm
      fireEvent.click(screen.getByRole("button", { name: "Add Member" }));

      await waitFor(() => {
        expect(screen.getByText("Member Added")).toBeInTheDocument();
        expect(screen.getByText(/New User One is now a member/)).toBeInTheDocument();
      });
    });

    it("should show error state when adding fails", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);
      mockAddMemberToGroup.mockResolvedValue({ success: false, error: "User not found" });

      render(<AddMemberDialog {...defaultProps} />);

      // Search
      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });
      fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
      });

      // Select
      fireEvent.click(screen.getByLabelText("Add New User One to group"));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Add Member" })).toBeInTheDocument();
      });

      // Confirm
      fireEvent.click(screen.getByRole("button", { name: "Add Member" }));

      await waitFor(() => {
        expect(screen.getByText("Failed to Add Member")).toBeInTheDocument();
        expect(screen.getByText("User not found")).toBeInTheDocument();
      });
    });

    it("should call onMemberAdded callback on success", async () => {
      mockSearchByDisplayName.mockResolvedValue(mockSearchResults);
      mockAddMemberToGroup.mockResolvedValue({ success: true });

      render(<AddMemberDialog {...defaultProps} />);

      // Search
      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "New" } });
      fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

      await waitFor(() => {
        expect(screen.getByText("New User One")).toBeInTheDocument();
      });

      // Select
      fireEvent.click(screen.getByLabelText("Add New User One to group"));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Add Member" })).toBeInTheDocument();
      });

      // Confirm
      fireEvent.click(screen.getByRole("button", { name: "Add Member" }));

      await waitFor(() => {
        expect(mockOnMemberAdded).toHaveBeenCalledWith({
          publicAddress: "new-user-1",
          displayName: "New User One",
          role: "Member",
        });
      });
    });
  });

  describe("Close functionality", () => {
    it("should call onClose when close button is clicked", () => {
      render(<AddMemberDialog {...defaultProps} />);

      const closeButton = screen.getByRole("button", { name: /close dialog/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", () => {
      render(<AddMemberDialog {...defaultProps} />);

      // Click the backdrop
      const dialog = screen.getByRole("dialog");
      const backdrop = dialog.parentElement?.previousSibling as Element;
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("Accessibility", () => {
    it("should have accessible dialog role", () => {
      render(<AddMemberDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("should have accessible heading", () => {
      render(<AddMemberDialog {...defaultProps} />);

      expect(screen.getByRole("heading", { name: /add member/i })).toBeInTheDocument();
    });

    it("should have accessible search input", () => {
      render(<AddMemberDialog {...defaultProps} />);

      expect(screen.getByLabelText("Search for members")).toBeInTheDocument();
    });

    it("should have accessible close button", () => {
      render(<AddMemberDialog {...defaultProps} />);

      expect(screen.getByRole("button", { name: /close dialog/i })).toBeInTheDocument();
    });
  });

  describe("Display initials", () => {
    it("should display initials for search results", async () => {
      mockSearchByDisplayName.mockResolvedValue([
        {
          publicSigningAddress: "user-1",
          publicEncryptAddress: "key-1",
          displayName: "John Doe",
        },
      ]);

      render(<AddMemberDialog {...defaultProps} />);

      const searchInput = screen.getByLabelText("Search for members");
      fireEvent.change(searchInput, { target: { value: "John" } });
      fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

      await waitFor(() => {
        expect(screen.getByText("JD")).toBeInTheDocument();
      });
    });
  });
});

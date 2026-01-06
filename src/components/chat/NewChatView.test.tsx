import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewChatView } from "./NewChatView";

// Mock the modules
vi.mock("@/modules/identity", () => ({
  searchByDisplayName: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/feeds", () => ({
  findExistingChatFeed: vi.fn(),
  createChatFeed: vi.fn(),
  useFeedsStore: {
    getState: vi.fn().mockReturnValue({ feeds: [] }),
  },
}));

vi.mock("@/lib/grpc/services/group", () => ({
  groupService: {
    joinGroup: vi.fn(),
  },
}));

vi.mock("@/stores", () => ({
  useAppStore: {
    getState: vi.fn().mockReturnValue({ credentials: null }),
  },
}));

vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

describe("NewChatView", () => {
  const mockOnFeedCreated = vi.fn();
  const mockOnFeedSelected = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    mockOnFeedCreated.mockClear();
    mockOnFeedSelected.mockClear();
    mockOnBack.mockClear();
    vi.clearAllMocks();
  });

  describe("Tab Bar", () => {
    it("should render Users and Public Groups tabs", () => {
      render(<NewChatView />);

      expect(screen.getByRole("tab", { name: /users/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /public groups/i })).toBeInTheDocument();
    });

    it("should have Users tab selected by default", () => {
      render(<NewChatView />);

      const usersTab = screen.getByRole("tab", { name: /users/i });
      expect(usersTab).toHaveAttribute("aria-selected", "true");

      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      expect(groupsTab).toHaveAttribute("aria-selected", "false");
    });

    it("should switch to Public Groups when clicked", () => {
      render(<NewChatView />);

      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      expect(groupsTab).toHaveAttribute("aria-selected", "true");

      const usersTab = screen.getByRole("tab", { name: /users/i });
      expect(usersTab).toHaveAttribute("aria-selected", "false");
    });

    it("should switch back to Users when clicked", () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      // Switch back to Users
      const usersTab = screen.getByRole("tab", { name: /users/i });
      fireEvent.click(usersTab);

      expect(usersTab).toHaveAttribute("aria-selected", "true");
      expect(groupsTab).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("Header", () => {
    it("should render New Feed header", () => {
      render(<NewChatView />);

      expect(screen.getByRole("heading", { name: /new feed/i })).toBeInTheDocument();
    });

    it("should update subtitle when switching tabs", () => {
      render(<NewChatView />);

      // Default Users tab subtitle
      expect(screen.getByText(/search for a profile/i)).toBeInTheDocument();

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      expect(screen.getByText(/find and join public groups/i)).toBeInTheDocument();
    });

    it("should show back button when showBackButton is true", () => {
      render(<NewChatView showBackButton onBack={mockOnBack} />);

      // Find all buttons and check for the back button (first button in the header)
      const buttons = screen.getAllByRole("button");
      const backButton = buttons.find(btn => btn.classList.contains("-ml-1.5"));
      expect(backButton).toBeInTheDocument();
    });
  });

  describe("Users Tab Content", () => {
    it("should show user search placeholder", () => {
      render(<NewChatView />);

      const searchInput = screen.getByPlaceholderText(/search by profile name/i);
      expect(searchInput).toBeInTheDocument();
    });

    it("should disable search button when query is empty", () => {
      render(<NewChatView />);

      // Find the Search button
      const buttons = screen.getAllByRole("button");
      const searchButton = buttons.find(btn => btn.textContent === "Search");
      expect(searchButton).toBeDisabled();
    });

    it("should enable search button when query is entered", () => {
      render(<NewChatView />);

      const searchInput = screen.getByPlaceholderText(/search by profile name/i);
      fireEvent.change(searchInput, { target: { value: "alice" } });

      const buttons = screen.getAllByRole("button");
      const searchButton = buttons.find(btn => btn.textContent === "Search");
      expect(searchButton).not.toBeDisabled();
    });
  });

  describe("Public Groups Tab Content", () => {
    it("should show group search placeholder when on Public Groups tab", () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      const searchInput = screen.getByPlaceholderText(/search by name or invite code/i);
      expect(searchInput).toBeInTheDocument();
    });

    it("should show Discover Public Groups empty state before search", () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      expect(screen.getByText(/discover public groups/i)).toBeInTheDocument();
    });

    it("should disable search button when group query is empty", () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      const buttons = screen.getAllByRole("button");
      const searchButton = buttons.find(btn => btn.textContent === "Search");
      expect(searchButton).toBeDisabled();
    });

    it("should enable search button when group query is entered", () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      const searchInput = screen.getByPlaceholderText(/search by name or invite code/i);
      fireEvent.change(searchInput, { target: { value: "tech" } });

      const buttons = screen.getAllByRole("button");
      const searchButton = buttons.find(btn => btn.textContent === "Search");
      expect(searchButton).not.toBeDisabled();
    });

    it("should show No groups found after search", async () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      const searchInput = screen.getByPlaceholderText(/search by name or invite code/i);
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      const buttons = screen.getAllByRole("button");
      const searchButton = buttons.find(btn => btn.textContent === "Search")!;
      fireEvent.click(searchButton);

      // Wait for the search to complete
      await screen.findByText(/no groups found/i);
    });
  });

  describe("Tab State", () => {
    it("should maintain separate state for each tab", () => {
      render(<NewChatView />);

      // Users tab should be selected
      expect(screen.getByRole("tab", { name: /users/i })).toHaveAttribute("aria-selected", "true");

      // Switch to Public Groups and back to verify state persistence
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      const usersTab = screen.getByRole("tab", { name: /users/i });
      fireEvent.click(usersTab);

      // Users tab should be selected again
      expect(usersTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Search Input Persistence", () => {
    it("should preserve user search query when switching back from Public Groups", () => {
      render(<NewChatView />);

      // Enter user search query
      const searchInput = screen.getByPlaceholderText(/search by profile name/i);
      fireEvent.change(searchInput, { target: { value: "alice" } });

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      // Switch back to Users
      const usersTab = screen.getByRole("tab", { name: /users/i });
      fireEvent.click(usersTab);

      // Query should be preserved
      const userInput = screen.getByPlaceholderText(/search by profile name/i);
      expect(userInput).toHaveValue("alice");
    });

    it("should preserve group search query when switching back from Users", () => {
      render(<NewChatView />);

      // Switch to Public Groups
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });
      fireEvent.click(groupsTab);

      // Enter group search query
      const searchInput = screen.getByPlaceholderText(/search by name or invite code/i);
      fireEvent.change(searchInput, { target: { value: "tech" } });

      // Switch to Users
      const usersTab = screen.getByRole("tab", { name: /users/i });
      fireEvent.click(usersTab);

      // Switch back to Public Groups
      fireEvent.click(groupsTab);

      // Query should be preserved
      const groupInput = screen.getByPlaceholderText(/search by name or invite code/i);
      expect(groupInput).toHaveValue("tech");
    });
  });

  describe("Accessibility", () => {
    it("should have tablist role for tab bar", () => {
      render(<NewChatView />);

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("should have correct aria-selected on tabs", () => {
      render(<NewChatView />);

      const usersTab = screen.getByRole("tab", { name: /users/i });
      const groupsTab = screen.getByRole("tab", { name: /public groups/i });

      expect(usersTab).toHaveAttribute("aria-selected", "true");
      expect(groupsTab).toHaveAttribute("aria-selected", "false");
    });
  });
});

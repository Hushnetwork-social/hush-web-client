/**
 * Unit tests for MemberSelector component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemberSelector, type SelectedMember } from "./MemberSelector";

// Mock the identity module
vi.mock("@/modules/identity", () => ({
  searchByDisplayName: vi.fn(),
}));

// Mock the app store
vi.mock("@/stores", () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      credentials: {
        signingPublicKey: "own-address-123",
      },
    })
  ),
}));

// Mock debug logger
vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

import { searchByDisplayName } from "@/modules/identity";

const mockSearchByDisplayName = vi.mocked(searchByDisplayName);

describe("MemberSelector", () => {
  const mockOnMembersChange = vi.fn();
  const mockOnNext = vi.fn();

  const defaultProps = {
    selectedMembers: [] as SelectedMember[],
    onMembersChange: mockOnMembersChange,
    onNext: mockOnNext,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchByDisplayName.mockResolvedValue([]);
  });

  describe("Rendering", () => {
    it("renders search input", () => {
      render(<MemberSelector {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Search by name...")
      ).toBeInTheDocument();
    });

    it("renders Search button", () => {
      render(<MemberSelector {...defaultProps} />);

      expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    });

    it("renders selected count showing 0 members", () => {
      render(<MemberSelector {...defaultProps} />);

      expect(screen.getByText("Selected: 0 members")).toBeInTheDocument();
    });

    it("renders Next button", () => {
      render(<MemberSelector {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Proceed to next step" })
      ).toBeInTheDocument();
    });
  });

  describe("Search functionality", () => {
    it("disables search button when query is empty", () => {
      render(<MemberSelector {...defaultProps} />);

      const searchButton = screen.getByRole("button", { name: "Search" });
      expect(searchButton).toBeDisabled();
    });

    it("calls search API when searching with query", async () => {
      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
      ]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "Alice" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(mockSearchByDisplayName).toHaveBeenCalledWith("Alice");
      });
    });

    it("displays search results", async () => {
      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
        {
          displayName: "Bob",
          publicSigningAddress: "bob-address",
          publicEncryptAddress: "bob-encrypt",
        },
      ]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "test" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
      });
    });

    it("shows no results message when no users found", async () => {
      mockSearchByDisplayName.mockResolvedValue([]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "xyz123" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("No users found")).toBeInTheDocument();
      });
    });

    it("filters out current user from results", async () => {
      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Current User",
          publicSigningAddress: "own-address-123",
          publicEncryptAddress: "own-encrypt",
        },
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
      ]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "test" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.queryByText("Current User")).not.toBeInTheDocument();
      });
    });

    it("triggers search on Enter key", async () => {
      mockSearchByDisplayName.mockResolvedValue([]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockSearchByDisplayName).toHaveBeenCalledWith("test");
      });
    });

    it("shows error on search failure", async () => {
      mockSearchByDisplayName.mockRejectedValue(new Error("Network error"));

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "test" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Failed to search. Please try again."
        );
      });
    });
  });

  describe("Member selection", () => {
    it("calls onMembersChange when selecting a member", async () => {
      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
      ]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "Alice" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      const selectButton = screen.getByRole("button", { name: "Select Alice" });
      fireEvent.click(selectButton);

      expect(mockOnMembersChange).toHaveBeenCalledWith([
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ]);
    });

    it("calls onMembersChange when deselecting a member", async () => {
      const selectedMembers: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ];

      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
      ]);

      render(
        <MemberSelector
          {...defaultProps}
          selectedMembers={selectedMembers}
        />
      );

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "Alice" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      const deselectButton = screen.getByRole("button", {
        name: "Deselect Alice",
      });
      fireEvent.click(deselectButton);

      expect(mockOnMembersChange).toHaveBeenCalledWith([]);
    });

    it("shows correct selected count", () => {
      const selectedMembers: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
        {
          publicSigningAddress: "bob-address",
          publicEncryptAddress: "bob-encrypt",
          displayName: "Bob",
        },
      ];

      render(
        <MemberSelector
          {...defaultProps}
          selectedMembers={selectedMembers}
        />
      );

      expect(screen.getByText("Selected: 2 members")).toBeInTheDocument();
    });

    it("shows singular member when 1 selected", () => {
      const selectedMembers: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ];

      render(
        <MemberSelector
          {...defaultProps}
          selectedMembers={selectedMembers}
        />
      );

      expect(screen.getByText("Selected: 1 member")).toBeInTheDocument();
    });

    it("highlights selected members in search results", async () => {
      const selectedMembers: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ];

      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
      ]);

      render(
        <MemberSelector
          {...defaultProps}
          selectedMembers={selectedMembers}
        />
      );

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "Alice" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "Deselect Alice" });
        expect(button).toHaveAttribute("aria-pressed", "true");
      });
    });
  });

  describe("Next button behavior", () => {
    it("is disabled when no members selected", () => {
      render(<MemberSelector {...defaultProps} />);

      const nextButton = screen.getByRole("button", {
        name: "Proceed to next step",
      });
      expect(nextButton).toBeDisabled();
    });

    it("is enabled when at least one member selected", () => {
      const selectedMembers: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ];

      render(
        <MemberSelector
          {...defaultProps}
          selectedMembers={selectedMembers}
        />
      );

      const nextButton = screen.getByRole("button", {
        name: "Proceed to next step",
      });
      expect(nextButton).not.toBeDisabled();
    });

    it("calls onNext when clicked", () => {
      const selectedMembers: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ];

      render(
        <MemberSelector
          {...defaultProps}
          selectedMembers={selectedMembers}
        />
      );

      const nextButton = screen.getByRole("button", {
        name: "Proceed to next step",
      });
      fireEvent.click(nextButton);

      expect(mockOnNext).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has accessible search input", () => {
      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByRole("textbox", { name: "Search for members" });
      expect(input).toBeInTheDocument();
    });

    it("has aria-pressed on selected items", async () => {
      mockSearchByDisplayName.mockResolvedValue([
        {
          displayName: "Alice",
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
        },
      ]);

      render(<MemberSelector {...defaultProps} />);

      const input = screen.getByPlaceholderText("Search by name...");
      fireEvent.change(input, { target: { value: "Alice" } });

      const searchButton = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchButton);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "Select Alice" });
        expect(button).toHaveAttribute("aria-pressed", "false");
      });
    });
  });
});

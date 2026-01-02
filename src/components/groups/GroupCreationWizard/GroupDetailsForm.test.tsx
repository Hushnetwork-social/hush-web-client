/**
 * Unit tests for GroupDetailsForm component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GroupDetailsForm } from "./GroupDetailsForm";
import type { SelectedMember } from "./MemberSelector";

describe("GroupDetailsForm", () => {
  const mockOnBack = vi.fn();
  const mockOnCreate = vi.fn();

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

  const defaultProps = {
    selectedMembers,
    onBack: mockOnBack,
    onCreate: mockOnCreate,
    isCreating: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders group name input", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    });

    it("renders description textarea", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it("renders visibility options", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(screen.getByText("Private")).toBeInTheDocument();
      expect(screen.getByText("Public")).toBeInTheDocument();
    });

    it("renders back button", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Go back to member selection" })
      ).toBeInTheDocument();
    });

    it("renders create button", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Create group" })
      ).toBeInTheDocument();
    });

    it("renders members summary with count", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      // +1 for current user
      expect(screen.getByText("Members (3)")).toBeInTheDocument();
    });

    it("renders member names in summary", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  describe("Form validation", () => {
    it("disables create button when name is empty", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const createButton = screen.getByRole("button", { name: "Create group" });
      expect(createButton).toBeDisabled();
    });

    it("enables create button when name is provided", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      fireEvent.change(nameInput, { target: { value: "Test Group" } });

      const createButton = screen.getByRole("button", { name: "Create group" });
      expect(createButton).not.toBeDisabled();
    });

    it("shows character count for name", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      fireEvent.change(nameInput, { target: { value: "Test" } });

      expect(screen.getByText("4/100")).toBeInTheDocument();
    });

    it("shows character count for description", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: "A test description" } });

      expect(screen.getByText("18/500")).toBeInTheDocument();
    });

    it("shows error when name exceeds 100 characters", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      const longName = "a".repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });

      expect(
        screen.getByText("Group name must be 100 characters or less")
      ).toBeInTheDocument();
    });

    it("disables create button when name exceeds 100 characters", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      const longName = "a".repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });

      const createButton = screen.getByRole("button", { name: "Create group" });
      expect(createButton).toBeDisabled();
    });
  });

  describe("Visibility selection", () => {
    it("defaults to Private visibility", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const privateOption = screen.getByLabelText(/private/i);
      expect(privateOption).toBeChecked();
    });

    it("allows selecting Public visibility", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const publicLabel = screen.getByText("Public").closest("label");
      if (publicLabel) {
        fireEvent.click(publicLabel);
      }

      const publicOption = screen.getByLabelText(/public/i);
      expect(publicOption).toBeChecked();
    });

    it("allows switching back to Private", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      // Select public first
      const publicLabel = screen.getByText("Public").closest("label");
      if (publicLabel) fireEvent.click(publicLabel);

      // Switch back to private
      const privateLabel = screen.getByText("Private").closest("label");
      if (privateLabel) fireEvent.click(privateLabel);

      const privateOption = screen.getByLabelText(/private/i);
      expect(privateOption).toBeChecked();
    });
  });

  describe("Form submission", () => {
    it("calls onCreate with form data when submitted", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      const descInput = screen.getByLabelText(/description/i);

      fireEvent.change(nameInput, { target: { value: "My Group" } });
      fireEvent.change(descInput, { target: { value: "A description" } });

      const createButton = screen.getByRole("button", { name: "Create group" });
      fireEvent.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledWith({
        name: "My Group",
        description: "A description",
        isPublic: false,
      });
    });

    it("passes isPublic=true when Public is selected", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      fireEvent.change(nameInput, { target: { value: "Public Group" } });

      const publicLabel = screen.getByText("Public").closest("label");
      if (publicLabel) fireEvent.click(publicLabel);

      const createButton = screen.getByRole("button", { name: "Create group" });
      fireEvent.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledWith({
        name: "Public Group",
        description: "",
        isPublic: true,
      });
    });

    it("trims whitespace from name and description", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      const descInput = screen.getByLabelText(/description/i);

      fireEvent.change(nameInput, { target: { value: "  My Group  " } });
      fireEvent.change(descInput, { target: { value: "  Description  " } });

      const createButton = screen.getByRole("button", { name: "Create group" });
      fireEvent.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledWith({
        name: "My Group",
        description: "Description",
        isPublic: false,
      });
    });
  });

  describe("Back button", () => {
    it("calls onBack when clicked", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const backButton = screen.getByRole("button", {
        name: "Go back to member selection",
      });
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator when isCreating is true", () => {
      render(<GroupDetailsForm {...defaultProps} isCreating={true} />);

      expect(screen.getByText("Creating...")).toBeInTheDocument();
    });

    it("disables create button when isCreating is true", () => {
      render(<GroupDetailsForm {...defaultProps} isCreating={true} />);

      // Find the button by its role since the name changes during loading
      const createButton = screen.getByRole("button", { name: "Create group" });
      expect(createButton).toBeDisabled();
    });

    it("disables form inputs when isCreating is true", () => {
      render(<GroupDetailsForm {...defaultProps} isCreating={true} />);

      const nameInput = screen.getByLabelText(/group name/i);
      const descInput = screen.getByLabelText(/description/i);

      expect(nameInput).toBeDisabled();
      expect(descInput).toBeDisabled();
    });

    it("disables back button when isCreating is true", () => {
      render(<GroupDetailsForm {...defaultProps} isCreating={true} />);

      const backButton = screen.getByRole("button", {
        name: "Go back to member selection",
      });
      expect(backButton).toBeDisabled();
    });
  });

  describe("Members summary", () => {
    it("shows singular member text for 1 member", () => {
      const singleMember: SelectedMember[] = [
        {
          publicSigningAddress: "alice-address",
          publicEncryptAddress: "alice-encrypt",
          displayName: "Alice",
        },
      ];

      render(
        <GroupDetailsForm {...defaultProps} selectedMembers={singleMember} />
      );

      expect(screen.getByText("You + 1 invited member")).toBeInTheDocument();
    });

    it("shows plural member text for multiple members", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(screen.getByText("You + 2 invited members")).toBeInTheDocument();
    });

    it("hides individual names when more than 3 members", () => {
      const manyMembers: SelectedMember[] = [
        { publicSigningAddress: "a1", publicEncryptAddress: "e1", displayName: "Alice" },
        { publicSigningAddress: "a2", publicEncryptAddress: "e2", displayName: "Bob" },
        { publicSigningAddress: "a3", publicEncryptAddress: "e3", displayName: "Charlie" },
        { publicSigningAddress: "a4", publicEncryptAddress: "e4", displayName: "Diana" },
      ];

      render(
        <GroupDetailsForm {...defaultProps} selectedMembers={manyMembers} />
      );

      // Names should not be visible as individual badges
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has accessible name input", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(
        screen.getByRole("textbox", { name: /group name/i })
      ).toBeInTheDocument();
    });

    it("has accessible description textarea", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(
        screen.getByRole("textbox", { name: /description/i })
      ).toBeInTheDocument();
    });

    it("marks name input as required", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("shows error with role alert", () => {
      render(<GroupDetailsForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/group name/i);
      const longName = "a".repeat(101);
      fireEvent.change(nameInput, { target: { value: longName } });

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

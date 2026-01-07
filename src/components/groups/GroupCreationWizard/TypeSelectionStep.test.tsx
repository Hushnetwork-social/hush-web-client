import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TypeSelectionStep } from "./TypeSelectionStep";

describe("TypeSelectionStep", () => {
  const defaultProps = {
    selectedType: null as "public" | "private" | null,
    onTypeSelect: vi.fn(),
    onNext: vi.fn(),
  };

  describe("Rendering", () => {
    it("should render the question text", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(
        screen.getByText("What kind of group do you want to create?")
      ).toBeInTheDocument();
    });

    it("should render Public card", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(screen.getByText("Public")).toBeInTheDocument();
      expect(
        screen.getByText("Anyone can find and join this group")
      ).toBeInTheDocument();
    });

    it("should render Private card", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(screen.getByText("Private")).toBeInTheDocument();
      expect(screen.getByText("Invite-only membership")).toBeInTheDocument();
    });

    it("should render Next button", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("should render listbox container", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(
        screen.getByRole("listbox", { name: /group type selection/i })
      ).toBeInTheDocument();
    });
  });

  describe("Initial State", () => {
    it("should have Next button disabled when no type selected", () => {
      render(<TypeSelectionStep {...defaultProps} selectedType={null} />);

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("should have neither card selected initially", () => {
      render(<TypeSelectionStep {...defaultProps} selectedType={null} />);

      const cards = screen.getAllByRole("option");
      expect(cards[0]).toHaveAttribute("aria-selected", "false");
      expect(cards[1]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("Selection State", () => {
    it("should show Public card as selected when selectedType is public", () => {
      render(<TypeSelectionStep {...defaultProps} selectedType="public" />);

      const cards = screen.getAllByRole("option");
      expect(cards[0]).toHaveAttribute("aria-selected", "true"); // Public
      expect(cards[1]).toHaveAttribute("aria-selected", "false"); // Private
    });

    it("should show Private card as selected when selectedType is private", () => {
      render(<TypeSelectionStep {...defaultProps} selectedType="private" />);

      const cards = screen.getAllByRole("option");
      expect(cards[0]).toHaveAttribute("aria-selected", "false"); // Public
      expect(cards[1]).toHaveAttribute("aria-selected", "true"); // Private
    });

    it("should enable Next button when type is selected", () => {
      render(<TypeSelectionStep {...defaultProps} selectedType="public" />);

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });
  });

  describe("Selection Interaction", () => {
    it("should call onTypeSelect with public when Public card is clicked", () => {
      const onTypeSelect = vi.fn();
      render(
        <TypeSelectionStep {...defaultProps} onTypeSelect={onTypeSelect} />
      );

      // Click the Public card (first card)
      const publicCard = screen.getByText("Public").closest('[role="option"]');
      fireEvent.click(publicCard!);

      expect(onTypeSelect).toHaveBeenCalledWith("public");
    });

    it("should call onTypeSelect with private when Private card is clicked", () => {
      const onTypeSelect = vi.fn();
      render(
        <TypeSelectionStep {...defaultProps} onTypeSelect={onTypeSelect} />
      );

      // Click the Private card (second card)
      const privateCard = screen
        .getByText("Private")
        .closest('[role="option"]');
      fireEvent.click(privateCard!);

      expect(onTypeSelect).toHaveBeenCalledWith("private");
    });

    it("should call onTypeSelect when changing selection", () => {
      const onTypeSelect = vi.fn();
      render(
        <TypeSelectionStep
          {...defaultProps}
          selectedType="public"
          onTypeSelect={onTypeSelect}
        />
      );

      // Click Private card to change selection
      const privateCard = screen
        .getByText("Private")
        .closest('[role="option"]');
      fireEvent.click(privateCard!);

      expect(onTypeSelect).toHaveBeenCalledWith("private");
    });
  });

  describe("Next Button Interaction", () => {
    it("should call onNext when Next button is clicked and type is selected", () => {
      const onNext = vi.fn();
      render(
        <TypeSelectionStep {...defaultProps} selectedType="public" onNext={onNext} />
      );

      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("should not call onNext when Next button is disabled", () => {
      const onNext = vi.fn();
      render(
        <TypeSelectionStep {...defaultProps} selectedType={null} onNext={onNext} />
      );

      // Button is disabled, but try clicking anyway
      const button = screen.getByRole("button", { name: /next/i });
      fireEvent.click(button);

      // Since button is disabled, the click should not trigger onNext
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  describe("Card Content", () => {
    it("should show Public card bullets", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(screen.getByText("Visible in search")).toBeInTheDocument();
      expect(screen.getByText("Open membership")).toBeInTheDocument();
    });

    it("should show Private card bullets", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(screen.getByText("Hidden from search")).toBeInTheDocument();
      expect(screen.getByText("Controlled access")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have listbox role for card container", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("should have aria-label for card container", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(
        screen.getByRole("listbox", { name: "Group type selection" })
      ).toBeInTheDocument();
    });

    it("should have button with aria-label", () => {
      render(<TypeSelectionStep {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Proceed to next step" })
      ).toBeInTheDocument();
    });
  });
});

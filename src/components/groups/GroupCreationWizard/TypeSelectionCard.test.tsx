import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TypeSelectionCard } from "./TypeSelectionCard";

describe("TypeSelectionCard", () => {
  const defaultProps = {
    icon: "globe" as const,
    title: "Public",
    description: "Anyone can find and join this group",
    bullets: ["Visible in search", "Open membership"],
    selected: false,
    onSelect: vi.fn(),
  };

  describe("Rendering", () => {
    it("should render the title", () => {
      render(<TypeSelectionCard {...defaultProps} />);

      expect(screen.getByText("Public")).toBeInTheDocument();
    });

    it("should render the description", () => {
      render(<TypeSelectionCard {...defaultProps} />);

      expect(
        screen.getByText("Anyone can find and join this group")
      ).toBeInTheDocument();
    });

    it("should render all bullet points", () => {
      render(<TypeSelectionCard {...defaultProps} />);

      expect(screen.getByText("Visible in search")).toBeInTheDocument();
      expect(screen.getByText("Open membership")).toBeInTheDocument();
    });

    it("should render the globe icon for globe type", () => {
      render(<TypeSelectionCard {...defaultProps} icon="globe" />);

      // The Globe icon from lucide-react renders as an SVG
      const card = screen.getByRole("option");
      expect(card.querySelector("svg")).toBeInTheDocument();
    });

    it("should render the lock icon for lock type", () => {
      render(<TypeSelectionCard {...defaultProps} icon="lock" />);

      const card = screen.getByRole("option");
      expect(card.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Default State", () => {
    it("should not show checkmark when not selected", () => {
      render(<TypeSelectionCard {...defaultProps} selected={false} />);

      // Check icon has class w-4 h-4, which is distinct from other icons
      const card = screen.getByRole("option");
      // The checkmark div with bg-hush-purple should not exist
      expect(card.querySelector(".bg-hush-purple.w-6.h-6")).toBeNull();
    });

    it("should have aria-selected false when not selected", () => {
      render(<TypeSelectionCard {...defaultProps} selected={false} />);

      expect(screen.getByRole("option")).toHaveAttribute(
        "aria-selected",
        "false"
      );
    });
  });

  describe("Selected State", () => {
    it("should show checkmark when selected", () => {
      render(<TypeSelectionCard {...defaultProps} selected={true} />);

      const card = screen.getByRole("option");
      // The checkmark container should be visible
      expect(card.querySelector(".bg-hush-purple")).toBeInTheDocument();
    });

    it("should have aria-selected true when selected", () => {
      render(<TypeSelectionCard {...defaultProps} selected={true} />);

      expect(screen.getByRole("option")).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    it("should have selected styling classes", () => {
      render(<TypeSelectionCard {...defaultProps} selected={true} />);

      const card = screen.getByRole("option");
      expect(card).toHaveClass("border-hush-purple");
    });
  });

  describe("Click Interaction", () => {
    it("should call onSelect when clicked", () => {
      const onSelect = vi.fn();
      render(<TypeSelectionCard {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole("option"));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("should not call onSelect when disabled and clicked", () => {
      const onSelect = vi.fn();
      render(
        <TypeSelectionCard {...defaultProps} onSelect={onSelect} disabled />
      );

      fireEvent.click(screen.getByRole("option"));

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard Interaction", () => {
    it("should call onSelect when Enter is pressed", () => {
      const onSelect = vi.fn();
      render(<TypeSelectionCard {...defaultProps} onSelect={onSelect} />);

      const card = screen.getByRole("option");
      fireEvent.keyDown(card, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("should call onSelect when Space is pressed", () => {
      const onSelect = vi.fn();
      render(<TypeSelectionCard {...defaultProps} onSelect={onSelect} />);

      const card = screen.getByRole("option");
      fireEvent.keyDown(card, { key: " " });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("should not call onSelect for other keys", () => {
      const onSelect = vi.fn();
      render(<TypeSelectionCard {...defaultProps} onSelect={onSelect} />);

      const card = screen.getByRole("option");
      fireEvent.keyDown(card, { key: "a" });
      fireEvent.keyDown(card, { key: "Tab" });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("should not call onSelect when disabled and key pressed", () => {
      const onSelect = vi.fn();
      render(
        <TypeSelectionCard {...defaultProps} onSelect={onSelect} disabled />
      );

      const card = screen.getByRole("option");
      fireEvent.keyDown(card, { key: "Enter" });
      fireEvent.keyDown(card, { key: " " });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("should have aria-disabled true when disabled", () => {
      render(<TypeSelectionCard {...defaultProps} disabled />);

      expect(screen.getByRole("option")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });

    it("should have opacity-50 class when disabled", () => {
      render(<TypeSelectionCard {...defaultProps} disabled />);

      expect(screen.getByRole("option")).toHaveClass("opacity-50");
    });

    it("should have tabIndex -1 when disabled", () => {
      render(<TypeSelectionCard {...defaultProps} disabled />);

      expect(screen.getByRole("option")).toHaveAttribute("tabindex", "-1");
    });

    it("should have tabIndex 0 when not disabled", () => {
      render(<TypeSelectionCard {...defaultProps} disabled={false} />);

      expect(screen.getByRole("option")).toHaveAttribute("tabindex", "0");
    });
  });

  describe("Accessibility", () => {
    it("should have role option", () => {
      render(<TypeSelectionCard {...defaultProps} />);

      expect(screen.getByRole("option")).toBeInTheDocument();
    });

    it("should be focusable", () => {
      render(<TypeSelectionCard {...defaultProps} />);

      const card = screen.getByRole("option");
      card.focus();

      expect(card).toHaveFocus();
    });
  });
});

/**
 * Unit tests for UnbanGapPlaceholder component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnbanGapPlaceholder } from "./UnbanGapPlaceholder";

describe("UnbanGapPlaceholder", () => {
  describe("Rendering", () => {
    it("renders the placeholder message", () => {
      render(<UnbanGapPlaceholder />);

      expect(
        screen.getByText("You were banned during this period. Messages unavailable.")
      ).toBeInTheDocument();
    });

    it("renders the shield icon", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("has dashed border styling", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("border-dashed");
    });

    it("is centered with max width", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("mx-auto");
      expect(wrapper).toHaveClass("max-w-md");
    });
  });

  describe("Accessibility", () => {
    it("has role status", () => {
      render(<UnbanGapPlaceholder />);

      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("has accessible aria-label", () => {
      render(<UnbanGapPlaceholder />);

      const placeholder = screen.getByRole("status");
      expect(placeholder).toHaveAttribute(
        "aria-label",
        "Messages unavailable due to ban period"
      );
    });

    it("icon has aria-hidden", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Visual Styling", () => {
    it("has background color", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("bg-hush-bg-hover");
    });

    it("has proper spacing", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("py-4");
      expect(wrapper).toHaveClass("px-6");
      expect(wrapper).toHaveClass("my-4");
    });

    it("has rounded corners", () => {
      const { container } = render(<UnbanGapPlaceholder />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("rounded-lg");
    });
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkPreviewSkeleton } from "./LinkPreviewSkeleton";

describe("LinkPreviewSkeleton", () => {
  it("should render skeleton elements", () => {
    render(<LinkPreviewSkeleton />);

    // Should have aria-busy attribute
    const container = screen.getByLabelText("Loading link preview");
    expect(container).toHaveAttribute("aria-busy", "true");
  });

  it("should have pulse animation class", () => {
    render(<LinkPreviewSkeleton />);

    const container = screen.getByLabelText("Loading link preview");
    expect(container).toHaveClass("animate-pulse");
  });

  it("should have accessible label", () => {
    render(<LinkPreviewSkeleton />);

    expect(screen.getByLabelText("Loading link preview")).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContentCarousel } from "./ContentCarousel";

describe("ContentCarousel", () => {
  const threeItems = [
    <div key="a" data-testid="item-a">Item A</div>,
    <div key="b" data-testid="item-b">Item B</div>,
    <div key="c" data-testid="item-c">Item C</div>,
  ];

  describe("Single Item", () => {
    it("should render single item without navigation controls", () => {
      render(
        <ContentCarousel>
          {[<div key="only">Only Item</div>]}
        </ContentCarousel>
      );

      expect(screen.getByText("Only Item")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId("page-indicator")).not.toBeInTheDocument();
    });
  });

  describe("Empty", () => {
    it("should render nothing for empty children array", () => {
      const { container } = render(<ContentCarousel>{[]}</ContentCarousel>);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Multiple Items", () => {
    it("should show navigation controls", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("should show page indicator with correct initial position", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("should show first item initially", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });

    it("should navigate to next item on next button click", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByText("Item B")).toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("should navigate to previous item on previous button click", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      // Go to second item first
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("2 / 3")).toBeInTheDocument();

      // Go back
      fireEvent.click(screen.getByRole("button", { name: /previous/i }));
      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("should disable previous button at start", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    });

    it("should disable next button at end", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      expect(screen.getByText("3 / 3")).toBeInTheDocument();
      expect(nextButton).toBeDisabled();
    });

    it("should not wrap around at the end", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton); // Should have no effect

      expect(screen.getByText("3 / 3")).toBeInTheDocument();
      expect(screen.getByText("Item C")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("should navigate with right arrow key", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      const container = screen.getByRole("region");
      fireEvent.keyDown(container, { key: "ArrowRight" });
      expect(screen.getByText("Item B")).toBeInTheDocument();
    });

    it("should navigate with left arrow key", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      const container = screen.getByRole("region");
      fireEvent.keyDown(container, { key: "ArrowRight" });
      expect(screen.getByText("Item B")).toBeInTheDocument();

      fireEvent.keyDown(container, { key: "ArrowLeft" });
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });
  });

  describe("Touch Swipe Navigation", () => {
    it("should navigate forward on left swipe", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      const container = screen.getByTestId("content-carousel");
      fireEvent.touchStart(container, { touches: [{ clientX: 200 }] });
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100 }] }); // diff > 50

      expect(screen.getByText("Item B")).toBeInTheDocument();
    });

    it("should navigate backward on right swipe", () => {
      render(<ContentCarousel>{threeItems}</ContentCarousel>);

      // First go to item B
      const container = screen.getByTestId("content-carousel");
      fireEvent.touchStart(container, { touches: [{ clientX: 200 }] });
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100 }] });
      expect(screen.getByText("Item B")).toBeInTheDocument();

      // Swipe right to go back
      fireEvent.touchStart(container, { touches: [{ clientX: 100 }] });
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 200 }] });
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });
  });

  describe("Variable Height", () => {
    it("should render items without fixed height constraint", () => {
      render(
        <ContentCarousel>
          {[
            <div key="tall" style={{ height: 200 }}>Tall</div>,
            <div key="short" style={{ height: 50 }}>Short</div>,
          ]}
        </ContentCarousel>
      );

      const carouselItem = screen.getByTestId("carousel-item");
      // No fixed height style in the inline styles
      expect(carouselItem.style.height).toBe("");
    });
  });
});

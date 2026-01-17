import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkPreviewCard } from "./LinkPreviewCard";
import type { UrlMetadata } from "@/lib/urlDetector/urlMetadataCache";

// Helper to create test metadata
function createTestMetadata(overrides?: Partial<UrlMetadata>): UrlMetadata {
  return {
    url: "https://example.com/article",
    domain: "example.com",
    title: "Test Article Title",
    description: "This is a test description for the article.",
    imageUrl: "https://example.com/image.jpg",
    imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    success: true,
    errorMessage: null,
    ...overrides,
  };
}

describe("LinkPreviewCard", () => {
  describe("Rendering", () => {
    it("should render with full metadata", () => {
      const metadata = createTestMetadata();
      render(<LinkPreviewCard metadata={metadata} />);

      expect(screen.getByText("Test Article Title")).toBeInTheDocument();
      expect(screen.getByText("This is a test description for the article.")).toBeInTheDocument();
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });

    it("should render thumbnail when imageBase64 is provided", () => {
      const metadata = createTestMetadata();
      const { container } = render(<LinkPreviewCard metadata={metadata} />);

      // img has alt="" for decorative purposes, so we query by tag
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", expect.stringContaining("data:image/jpeg;base64"));
    });

    it("should render fallback icon when no image", () => {
      const metadata = createTestMetadata({ imageBase64: null });
      render(<LinkPreviewCard metadata={metadata} />);

      // Should not have an img element
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("should truncate long titles at 60 characters", () => {
      const longTitle = "A".repeat(80);
      const metadata = createTestMetadata({ title: longTitle });
      render(<LinkPreviewCard metadata={metadata} />);

      // Should show 60 chars + "..."
      const titleElement = screen.getByText(/^A{60}\.\.\./);
      expect(titleElement).toBeInTheDocument();
    });

    it("should truncate long descriptions at 120 characters", () => {
      const longDescription = "B".repeat(150);
      const metadata = createTestMetadata({ description: longDescription });
      render(<LinkPreviewCard metadata={metadata} />);

      // Should show truncated description
      const descElement = screen.getByText(/^B{120}\.\.\./);
      expect(descElement).toBeInTheDocument();
    });

    it("should use domain as title when title is null", () => {
      const metadata = createTestMetadata({ title: null });
      render(<LinkPreviewCard metadata={metadata} />);

      // Should show domain in the title position
      const titles = screen.getAllByText("example.com");
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it("should not render description if null", () => {
      const metadata = createTestMetadata({ description: null });
      render(<LinkPreviewCard metadata={metadata} />);

      expect(screen.queryByText("This is a test description")).not.toBeInTheDocument();
    });
  });

  describe("Interaction", () => {
    it("should open URL in new tab on click", () => {
      const metadata = createTestMetadata();
      const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

      render(<LinkPreviewCard metadata={metadata} />);
      const card = screen.getByRole("button");
      fireEvent.click(card);

      expect(windowOpen).toHaveBeenCalledWith(
        "https://example.com/article",
        "_blank",
        "noopener,noreferrer"
      );

      windowOpen.mockRestore();
    });

    it("should call custom onClick handler when provided", () => {
      const metadata = createTestMetadata();
      const handleClick = vi.fn();

      render(<LinkPreviewCard metadata={metadata} onClick={handleClick} />);
      const card = screen.getByRole("button");
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should be keyboard accessible with Enter key", () => {
      const metadata = createTestMetadata();
      const handleClick = vi.fn();

      render(<LinkPreviewCard metadata={metadata} onClick={handleClick} />);
      const card = screen.getByRole("button");
      fireEvent.keyDown(card, { key: "Enter" });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should be keyboard accessible with Space key", () => {
      const metadata = createTestMetadata();
      const handleClick = vi.fn();

      render(<LinkPreviewCard metadata={metadata} onClick={handleClick} />);
      const card = screen.getByRole("button");
      fireEvent.keyDown(card, { key: " " });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should have proper aria-label for screen readers", () => {
      const metadata = createTestMetadata({
        title: "Article Title",
        domain: "example.com",
      });
      render(<LinkPreviewCard metadata={metadata} />);

      const card = screen.getByRole("button");
      expect(card).toHaveAttribute(
        "aria-label",
        "Link preview: Article Title from example.com"
      );
    });

    it("should be focusable", () => {
      const metadata = createTestMetadata();
      render(<LinkPreviewCard metadata={metadata} />);

      const card = screen.getByRole("button");
      expect(card).toHaveAttribute("tabIndex", "0");
    });
  });
});

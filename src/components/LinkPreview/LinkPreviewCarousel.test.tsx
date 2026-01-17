import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkPreviewCarousel } from "./LinkPreviewCarousel";
import type { UrlMetadata } from "@/lib/urlDetector/urlMetadataCache";
import type { ParsedUrl } from "@/lib/urlDetector/urlDetector";

// Helper to create test parsed URL
function createParsedUrl(url: string): ParsedUrl {
  return {
    url,
    normalizedUrl: url.toLowerCase(),
    startIndex: 0,
    endIndex: url.length,
    raw: url,
  };
}

// Helper to create test metadata
function createTestMetadata(url: string, overrides?: Partial<UrlMetadata>): UrlMetadata {
  const domain = new URL(url).hostname;
  return {
    url,
    domain,
    title: `Title for ${domain}`,
    description: `Description for ${domain}`,
    imageUrl: null,
    imageBase64: null,
    success: true,
    errorMessage: null,
    ...overrides,
  };
}

describe("LinkPreviewCarousel", () => {
  describe("Single URL", () => {
    it("should render single preview without navigation controls", () => {
      const urls = [createParsedUrl("https://example.com")];
      const metadataMap = new Map([
        ["https://example.com", createTestMetadata("https://example.com")],
      ]);

      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      expect(screen.getByText("Title for example.com")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/\/ /)).not.toBeInTheDocument(); // No page indicator
    });

    it("should show skeleton when loading", () => {
      const urls = [createParsedUrl("https://example.com")];

      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={new Map()}
          loadingUrls={new Set(["https://example.com"])}
        />
      );

      expect(screen.getByLabelText("Loading link preview")).toBeInTheDocument();
    });
  });

  describe("Multiple URLs", () => {
    const urls = [
      createParsedUrl("https://a.com"),
      createParsedUrl("https://b.com"),
      createParsedUrl("https://c.com"),
    ];

    const metadataMap = new Map([
      ["https://a.com", createTestMetadata("https://a.com")],
      ["https://b.com", createTestMetadata("https://b.com")],
      ["https://c.com", createTestMetadata("https://c.com")],
    ]);

    it("should show navigation controls for multiple URLs", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("should show page indicator", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("should show first preview initially", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      expect(screen.getByText("Title for a.com")).toBeInTheDocument();
    });

    it("should navigate to next preview on next button click", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      expect(screen.getByText("Title for b.com")).toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("should navigate to previous preview on previous button click", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      // Go to second
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);
      expect(screen.getByText("2 / 3")).toBeInTheDocument();

      // Go back to first
      const prevButton = screen.getByRole("button", { name: /previous/i });
      fireEvent.click(prevButton);
      expect(screen.getByText("Title for a.com")).toBeInTheDocument();
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("should disable previous button at start", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      const prevButton = screen.getByRole("button", { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it("should disable next button at end", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      const nextButton = screen.getByRole("button", { name: /next/i });

      // Navigate to the end
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      expect(screen.getByText("3 / 3")).toBeInTheDocument();
      expect(nextButton).toBeDisabled();
    });

    it("should not wrap around at the end", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      const nextButton = screen.getByRole("button", { name: /next/i });

      // Navigate to the end and try to go further
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton); // Should have no effect

      expect(screen.getByText("3 / 3")).toBeInTheDocument();
      expect(screen.getByText("Title for c.com")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    const urls = [
      createParsedUrl("https://a.com"),
      createParsedUrl("https://b.com"),
    ];

    const metadataMap = new Map([
      ["https://a.com", createTestMetadata("https://a.com")],
      ["https://b.com", createTestMetadata("https://b.com")],
    ]);

    it("should navigate with arrow keys", () => {
      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      const container = screen.getByRole("region");

      // Navigate right
      fireEvent.keyDown(container, { key: "ArrowRight" });
      expect(screen.getByText("Title for b.com")).toBeInTheDocument();

      // Navigate left
      fireEvent.keyDown(container, { key: "ArrowLeft" });
      expect(screen.getByText("Title for a.com")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should render nothing for empty URLs array", () => {
      const { container } = render(
        <LinkPreviewCarousel
          urls={[]}
          metadataMap={new Map()}
          loadingUrls={new Set()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Error State", () => {
    it("should show error message for failed fetch", () => {
      const urls = [createParsedUrl("https://error.com")];
      const metadataMap = new Map([
        [
          "https://error.com",
          createTestMetadata("https://error.com", {
            success: false,
            title: null,
            description: null,
            errorMessage: "Failed to fetch",
          }),
        ],
      ]);

      render(
        <LinkPreviewCarousel
          urls={urls}
          metadataMap={metadataMap}
          loadingUrls={new Set()}
        />
      );

      // When errorMessage is provided, it should be displayed
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
    });
  });
});

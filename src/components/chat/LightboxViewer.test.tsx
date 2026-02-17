import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LightboxViewer } from "./LightboxViewer";
import type { AttachmentRefMeta } from "@/types";

// Mock react-zoom-pan-pinch to avoid complex DOM rendering in tests
vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-wrapper">{children}</div>
  ),
  TransformComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-component">{children}</div>
  ),
}));

// Mock fileTypeIcons to avoid importing lucide-react icons in tests
vi.mock("@/lib/attachments/fileTypeIcons", () => ({
  getFileTypeIcon: (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const iconMap: Record<string, { colorClass: string; label: string }> = {
      pdf: { colorClass: "text-red-400", label: "PDF Document" },
      docx: { colorClass: "text-blue-400", label: "Word Document" },
      zip: { colorClass: "text-yellow-400", label: "ZIP Archive" },
    };
    const entry = iconMap[ext] ?? { colorClass: "text-gray-500", label: "File" };
    return {
      icon: ({ className, ...props }: { className?: string; "data-testid"?: string }) => (
        <span className={className} {...props}>FileIcon</span>
      ),
      colorClass: entry.colorClass,
      label: entry.label,
    };
  },
  formatFileSize: (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  },
}));

function makeAttachment(
  id: string,
  name: string,
  mime = "image/png",
  size = 1024,
): AttachmentRefMeta {
  return { id, hash: `hash-${id}`, mimeType: mime, size, fileName: name };
}

describe("LightboxViewer", () => {
  const singleAttachment = [makeAttachment("att-1", "photo.png")];
  const threeAttachments = [
    makeAttachment("att-1", "photo1.png"),
    makeAttachment("att-2", "photo2.jpg", "image/jpeg"),
    makeAttachment("att-3", "photo3.png"),
  ];

  const makeImageUrls = (...ids: string[]) =>
    new Map(ids.map(id => [id, `blob:${id}`]));

  const emptyProgress = new Map<string, number>();

  describe("Rendering", () => {
    it("should render dark backdrop overlay", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      const overlay = screen.getByTestId("lightbox-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay.className).toContain("bg-black/80");
    });

    it("should render image when URL is available", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-image")).toBeInTheDocument();
    });

    it("should render close button", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-close")).toBeInTheDocument();
    });

    it("should render download button when image is loaded", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-download")).toBeInTheDocument();
    });
  });

  describe("Close Behavior", () => {
    it("should call onClose when X button is clicked", () => {
      const onClose = vi.fn();
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={onClose}
        />,
      );
      fireEvent.click(screen.getByTestId("lightbox-close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={onClose}
        />,
      );
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", () => {
      const onClose = vi.fn();
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={onClose}
        />,
      );
      fireEvent.click(screen.getByTestId("lightbox-overlay"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Carousel Navigation", () => {
    it("should not show navigation for single image", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("lightbox-prev")).not.toBeInTheDocument();
      expect(screen.queryByTestId("lightbox-next")).not.toBeInTheDocument();
      expect(screen.queryByTestId("lightbox-page-indicator")).not.toBeInTheDocument();
    });

    it("should show navigation for multiple images", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-prev")).toBeInTheDocument();
      expect(screen.getByTestId("lightbox-next")).toBeInTheDocument();
      expect(screen.getByTestId("lightbox-page-indicator")).toBeInTheDocument();
    });

    it("should show correct page indicator", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("1 / 3");
    });

    it("should advance to next image on next click", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId("lightbox-next"));
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("2 / 3");
    });

    it("should go to previous image on prev click", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={1}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("2 / 3");
      fireEvent.click(screen.getByTestId("lightbox-prev"));
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("1 / 3");
    });

    it("should disable prev button at first image", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-prev")).toBeDisabled();
    });

    it("should disable next button at last image", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={2}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-next")).toBeDisabled();
    });

    it("should navigate with arrow keys", () => {
      render(
        <LightboxViewer
          attachments={threeAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1", "att-2", "att-3")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("2 / 3");
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("1 / 3");
    });
  });

  describe("Download Progress", () => {
    it("should show progress indicator when downloading", () => {
      const progress = new Map([["att-1", 50]]);
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={progress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-progress")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("should show correct progress percentage", () => {
      const progress = new Map([["att-1", 75]]);
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={progress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should not show progress when download is complete (100%)", () => {
      const progress = new Map([["att-1", 100]]);
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={progress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("lightbox-progress")).not.toBeInTheDocument();
      expect(screen.getByTestId("lightbox-image")).toBeInTheDocument();
    });

    it("should not show progress indicator when no download active", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("lightbox-progress")).not.toBeInTheDocument();
    });
  });

  describe("Download Button", () => {
    it("should trigger download with original filename", () => {
      // Mock document.createElement to track download link
      const mockClick = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === "a") {
          Object.defineProperty(el, "click", { value: mockClick });
        }
        return el;
      });

      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId("lightbox-download"));
      expect(mockClick).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    it("should not show download button when image is not loaded", () => {
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={new Map([["att-1", 50]])}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("lightbox-download")).not.toBeInTheDocument();
    });
  });

  describe("Non-Image Files", () => {
    it("should show file info for non-image attachments", () => {
      const pdfAttachment = [
        makeAttachment("att-pdf", "report.pdf", "application/pdf", 5 * 1024 * 1024),
      ];
      render(
        <LightboxViewer
          attachments={pdfAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-pdf")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-file-info")).toBeInTheDocument();
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
      expect(screen.getByText("5.0 MB")).toBeInTheDocument();
    });

    it("should show colored icon for non-PDF document", () => {
      const docAttachment = [
        makeAttachment("att-doc", "readme.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 2048),
      ];
      render(
        <LightboxViewer
          attachments={docAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-doc-icon")).toBeInTheDocument();
      expect(screen.getByText("readme.docx")).toBeInTheDocument();
      expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    });

    it("should show PDF thumbnail when thumbnail URL available", () => {
      const pdfAttachment = [
        makeAttachment("att-pdf", "report.pdf", "application/pdf", 1024 * 1024),
      ];
      const thumbs = new Map([["att-pdf", "blob:pdf-thumb"]]);
      render(
        <LightboxViewer
          attachments={pdfAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          thumbnailUrls={thumbs}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-doc-thumbnail")).toBeInTheDocument();
      expect(screen.getByTestId("lightbox-doc-thumbnail")).toHaveAttribute("src", "blob:pdf-thumb");
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });
  });

  describe("Auto-Download Request", () => {
    it("should call onRequestDownload when image URL is not available", () => {
      const onRequestDownload = vi.fn();
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onRequestDownload={onRequestDownload}
          onClose={vi.fn()}
        />,
      );
      expect(onRequestDownload).toHaveBeenCalledWith("att-1");
    });

    it("should not call onRequestDownload when image URL is available", () => {
      const onRequestDownload = vi.fn();
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={makeImageUrls("att-1")}
          downloadProgress={emptyProgress}
          onRequestDownload={onRequestDownload}
          onClose={vi.fn()}
        />,
      );
      expect(onRequestDownload).not.toHaveBeenCalled();
    });

    it("should be stuck with no image and no progress when onRequestDownload is not provided and no URL exists", () => {
      // This documents the bug: if ChatView doesn't wire onRequestDownload,
      // the lightbox opens but the full-size image download never starts.
      // The lightbox renders the overlay but the content area is empty.
      render(
        <LightboxViewer
          attachments={singleAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );

      // Overlay IS visible
      expect(screen.getByTestId("lightbox-overlay")).toBeInTheDocument();
      // But no image and no progress - stuck in blank state
      expect(screen.queryByTestId("lightbox-image")).not.toBeInTheDocument();
      expect(screen.queryByTestId("lightbox-progress")).not.toBeInTheDocument();
    });

    it("should auto-download for video attachments (for video player)", () => {
      const onRequestDownload = vi.fn();
      const videoAttachment = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      render(
        <LightboxViewer
          attachments={videoAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onRequestDownload={onRequestDownload}
          onClose={vi.fn()}
        />,
      );
      expect(onRequestDownload).toHaveBeenCalledWith("att-v");
    });

    it("should NOT auto-download for document attachments", () => {
      const onRequestDownload = vi.fn();
      const docAttachment = [makeAttachment("att-d", "report.pdf", "application/pdf")];
      render(
        <LightboxViewer
          attachments={docAttachment}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onRequestDownload={onRequestDownload}
          onClose={vi.fn()}
        />,
      );
      expect(onRequestDownload).not.toHaveBeenCalled();
    });
  });

  // FEAT-068: Video Lightbox
  describe("Video Lightbox", () => {
    it("should render video player when video URL is available", () => {
      const videoAtt = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      const videoUrls = new Map([["att-v", "blob:video-full"]]);
      render(
        <LightboxViewer
          attachments={videoAtt}
          initialIndex={0}
          imageUrls={videoUrls}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("video-player")).toBeInTheDocument();
      expect(screen.getByTestId("video-player-element")).toHaveAttribute("src", "blob:video-full");
    });

    it("should render video frame with play overlay when only thumbnail available", () => {
      const videoAtt = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      const thumbs = new Map([["att-v", "blob:video-frame"]]);
      render(
        <LightboxViewer
          attachments={videoAtt}
          initialIndex={0}
          imageUrls={new Map()}
          thumbnailUrls={thumbs}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-video")).toBeInTheDocument();
      expect(screen.getByTestId("lightbox-video-frame")).toHaveAttribute("src", "blob:video-frame");
      expect(screen.getByTestId("lightbox-play-icon")).toBeInTheDocument();
    });

    it("should render video fallback when no thumbnail", () => {
      const videoAtt = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      render(
        <LightboxViewer
          attachments={videoAtt}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-video-fallback")).toBeInTheDocument();
      expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    });

    it("should show download button for video attachment", () => {
      const videoAtt = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      render(
        <LightboxViewer
          attachments={videoAtt}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-download")).toBeInTheDocument();
    });

    it("should call onRequestDownload when download button clicked for video without full URL", () => {
      const onRequestDownload = vi.fn();
      const videoAtt = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      render(
        <LightboxViewer
          attachments={videoAtt}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onRequestDownload={onRequestDownload}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId("lightbox-download"));
      expect(onRequestDownload).toHaveBeenCalledWith("att-v");
    });

    it("should not show zoom/pan wrapper for video", () => {
      const videoAtt = [makeAttachment("att-v", "clip.mp4", "video/mp4")];
      const thumbs = new Map([["att-v", "blob:video-frame"]]);
      render(
        <LightboxViewer
          attachments={videoAtt}
          initialIndex={0}
          imageUrls={new Map()}
          thumbnailUrls={thumbs}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("transform-wrapper")).not.toBeInTheDocument();
    });
  });

  // FEAT-068: Document Download from Lightbox
  describe("Document Download", () => {
    it("should show download button for document attachment", () => {
      const docAtt = [makeAttachment("att-d", "report.pdf", "application/pdf")];
      render(
        <LightboxViewer
          attachments={docAtt}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-download")).toBeInTheDocument();
    });

    it("should call onRequestDownload when download clicked for document", () => {
      const onRequestDownload = vi.fn();
      const docAtt = [makeAttachment("att-d", "archive.zip", "application/zip", 10240)];
      render(
        <LightboxViewer
          attachments={docAtt}
          initialIndex={0}
          imageUrls={new Map()}
          downloadProgress={emptyProgress}
          onRequestDownload={onRequestDownload}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTestId("lightbox-download"));
      expect(onRequestDownload).toHaveBeenCalledWith("att-d");
    });
  });

  // FEAT-068: Mixed-type Carousel
  describe("Mixed-Type Carousel", () => {
    const mixedAttachments = [
      makeAttachment("att-img", "photo.png", "image/png"),
      makeAttachment("att-vid", "clip.mp4", "video/mp4"),
      makeAttachment("att-doc", "report.pdf", "application/pdf"),
    ];

    it("should show image view at index 0", () => {
      render(
        <LightboxViewer
          attachments={mixedAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-img")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-image")).toBeInTheDocument();
    });

    it("should navigate from image to video view", () => {
      const thumbs = new Map([["att-vid", "blob:vid-thumb"]]);
      render(
        <LightboxViewer
          attachments={mixedAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-img")}
          thumbnailUrls={thumbs}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-image")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("lightbox-video")).toBeInTheDocument();
      expect(screen.queryByTestId("lightbox-image")).not.toBeInTheDocument();
    });

    it("should navigate from video to document view", () => {
      const thumbs = new Map([["att-vid", "blob:vid-thumb"]]);
      render(
        <LightboxViewer
          attachments={mixedAttachments}
          initialIndex={1}
          imageUrls={new Map()}
          thumbnailUrls={thumbs}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-video")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("lightbox-file-info")).toBeInTheDocument();
      expect(screen.queryByTestId("lightbox-video")).not.toBeInTheDocument();
    });

    it("should show correct page indicator for mixed types", () => {
      render(
        <LightboxViewer
          attachments={mixedAttachments}
          initialIndex={0}
          imageUrls={makeImageUrls("att-img")}
          downloadProgress={emptyProgress}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("1 / 3");
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("lightbox-page-indicator")).toHaveTextContent("2 / 3");
    });
  });
});

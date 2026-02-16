import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttachmentThumbnail, getAttachmentTypeHint } from "./AttachmentThumbnail";
import type { AttachmentRefMeta } from "@/types";

function createAttachment(overrides?: Partial<AttachmentRefMeta>): AttachmentRefMeta {
  return {
    id: "att-001",
    hash: "abc123",
    mimeType: "image/jpeg",
    size: 1024000,
    fileName: "photo.jpg",
    ...overrides,
  };
}

describe("AttachmentThumbnail", () => {
  describe("Skeleton Loading State", () => {
    it("should render skeleton when no thumbnail URL", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByTestId("attachment-skeleton")).toBeInTheDocument();
    });

    it("should have animate-pulse class on skeleton", () => {
      const { container } = render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl={null}
        />
      );

      const pulseEl = container.querySelector(".animate-pulse");
      expect(pulseEl).toBeInTheDocument();
    });
  });

  describe("Image Thumbnail", () => {
    it("should render image when thumbnail URL is provided", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl="blob:http://localhost/thumb-001"
        />
      );

      expect(screen.getByTestId("attachment-image")).toBeInTheDocument();
      const img = screen.getByTestId("attachment-img");
      expect(img).toHaveAttribute("src", "blob:http://localhost/thumb-001");
    });

    it("should set alt text from fileName", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({ fileName: "sunset.png" })}
          thumbnailUrl="blob:test"
        />
      );

      expect(screen.getByAltText("sunset.png")).toBeInTheDocument();
    });
  });

  describe("GIF Auto-play", () => {
    it("should render GIF image element with correct source", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({ mimeType: "image/gif", fileName: "animation.gif" })}
          thumbnailUrl="blob:http://localhost/gif-data"
        />
      );

      const img = screen.getByTestId("attachment-img");
      expect(img).toHaveAttribute("src", "blob:http://localhost/gif-data");
    });
  });

  describe("Click Handler", () => {
    it("should call onClick when thumbnail is clicked", () => {
      const onClick = vi.fn();
      render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl="blob:test"
          onClick={onClick}
        />
      );

      fireEvent.click(screen.getByTestId("attachment-image"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should call onClick on Enter key press", () => {
      const onClick = vi.fn();
      render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl="blob:test"
          onClick={onClick}
        />
      );

      fireEvent.keyDown(screen.getByTestId("attachment-image"), { key: "Enter" });
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Non-Image File (routes to DocumentCard)", () => {
    it("should render DocumentCard for PDF attachment", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({
            mimeType: "application/pdf",
            fileName: "report.pdf",
            size: 2048000,
          })}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByTestId("document-card")).toBeInTheDocument();
      expect(screen.getByTestId("document-icon")).toBeInTheDocument();
    });

    it("should display filename for document attachment", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({
            mimeType: "application/pdf",
            fileName: "report.pdf",
          })}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });

    it("should display file size for document attachment", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({
            mimeType: "application/zip",
            fileName: "archive.zip",
            size: 5242880, // 5MB
          })}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByText("5.0 MB")).toBeInTheDocument();
    });
  });

  describe("FEAT-068: Video routing", () => {
    it("should route video attachment to VideoThumbnail", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({ mimeType: "video/mp4", fileName: "clip.mp4" })}
          thumbnailUrl="blob:video-frame"
        />
      );

      expect(screen.getByTestId("video-thumbnail")).toBeInTheDocument();
      expect(screen.queryByTestId("attachment-image")).not.toBeInTheDocument();
      expect(screen.queryByTestId("document-card")).not.toBeInTheDocument();
    });

    it("should show video skeleton when thumbnail is null", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({ mimeType: "video/mp4", fileName: "clip.mp4" })}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByTestId("video-skeleton")).toBeInTheDocument();
    });
  });

  describe("FEAT-068: Document routing", () => {
    it("should route document attachment to DocumentCard", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileName: "doc.docx",
          })}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByTestId("document-card")).toBeInTheDocument();
      expect(screen.queryByTestId("attachment-image")).not.toBeInTheDocument();
      expect(screen.queryByTestId("video-thumbnail")).not.toBeInTheDocument();
    });

    it("should route unknown MIME type to DocumentCard", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment({
            mimeType: "application/octet-stream",
            fileName: "unknown.bin",
          })}
          thumbnailUrl={null}
        />
      );

      expect(screen.getByTestId("document-card")).toBeInTheDocument();
    });
  });

  describe("Download Progress", () => {
    it("should show progress overlay when downloading", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl="blob:test"
          isDownloading={true}
          downloadProgress={60}
        />
      );

      expect(screen.getByTestId("download-progress")).toBeInTheDocument();
    });

    it("should render progress circle with correct value", () => {
      const { container } = render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl="blob:test"
          isDownloading={true}
          downloadProgress={60}
        />
      );

      // The SVG circle should have strokeDasharray with the progress value
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke-dasharray", "60 40");
    });

    it("should not show progress overlay when not downloading", () => {
      render(
        <AttachmentThumbnail
          attachment={createAttachment()}
          thumbnailUrl="blob:test"
          isDownloading={false}
        />
      );

      expect(screen.queryByTestId("download-progress")).not.toBeInTheDocument();
    });
  });
});

describe("getAttachmentTypeHint", () => {
  it("should return correct hint for images only", () => {
    const attachments = [
      createAttachment({ mimeType: "image/jpeg" }),
      createAttachment({ mimeType: "image/png" }),
    ];
    expect(getAttachmentTypeHint(attachments)).toBe("[2 images]");
  });

  it("should return correct hint for single image", () => {
    expect(getAttachmentTypeHint([createAttachment({ mimeType: "image/jpeg" })])).toBe("[1 image]");
  });

  it("should return correct hint for mixed image and file", () => {
    const attachments = [
      createAttachment({ mimeType: "image/jpeg" }),
      createAttachment({ mimeType: "application/pdf" }),
    ];
    expect(getAttachmentTypeHint(attachments)).toBe("[1 image, 1 file]");
  });

  it("should return correct hint for files only", () => {
    const attachments = [
      createAttachment({ mimeType: "application/pdf" }),
      createAttachment({ mimeType: "application/zip" }),
      createAttachment({ mimeType: "text/plain" }),
    ];
    expect(getAttachmentTypeHint(attachments)).toBe("[3 files]");
  });

  it("should return empty string for no attachments", () => {
    expect(getAttachmentTypeHint([])).toBe("");
  });

  // FEAT-068: Video counting
  it("should return correct hint for videos only", () => {
    const attachments = [
      createAttachment({ mimeType: "video/mp4" }),
      createAttachment({ mimeType: "video/webm" }),
    ];
    expect(getAttachmentTypeHint(attachments)).toBe("[2 videos]");
  });

  it("should return correct hint for single video", () => {
    expect(getAttachmentTypeHint([createAttachment({ mimeType: "video/mp4" })])).toBe("[1 video]");
  });

  it("should return correct hint for mixed image, video, and file", () => {
    const attachments = [
      createAttachment({ mimeType: "image/jpeg" }),
      createAttachment({ mimeType: "video/mp4" }),
      createAttachment({ mimeType: "application/pdf" }),
    ];
    expect(getAttachmentTypeHint(attachments)).toBe("[1 image, 1 video, 1 file]");
  });
});

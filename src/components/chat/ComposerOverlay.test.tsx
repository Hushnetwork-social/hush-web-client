import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ComposerOverlay, ComposerFile } from "./ComposerOverlay";

// Mock URL.createObjectURL / revokeObjectURL
vi.stubGlobal("URL", {
  ...globalThis.URL,
  createObjectURL: vi.fn(() => "blob:mock-url"),
  revokeObjectURL: vi.fn(),
});

// FEAT-068: Mock dynamic imports for video frame extractor and PDF generator
vi.mock("@/lib/attachments/videoFrameExtractor", () => ({
  extractVideoFrames: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/attachments/pdfThumbnailGenerator", () => ({
  generatePdfThumbnail: vi.fn(() => Promise.resolve(null)),
}));

function makeFile(name: string, type = "image/png", size = 1024): File {
  return new File(["x".repeat(size)], name, { type });
}

function makeComposerFile(name: string, type = "image/png", size = 1024): ComposerFile {
  return {
    file: makeFile(name, type, size),
    previewUrl: `blob:preview-${name}`,
  };
}

describe("ComposerOverlay", () => {
  let onSend: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;
  let onAddMore: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSend = vi.fn();
    onClose = vi.fn();
    onAddMore = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderOverlay(
    files: ComposerFile[] = [makeComposerFile("img1.png")],
    text = "",
  ) {
    return render(
      <ComposerOverlay
        initialFiles={files}
        initialText={text}
        onSend={onSend}
        onClose={onClose}
        onAddMore={onAddMore}
      />,
    );
  }

  describe("Rendering", () => {
    it("should render overlay with animation class", () => {
      renderOverlay();
      const overlay = screen.getByTestId("composer-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay.className).toContain("animate-in");
      expect(overlay.className).toContain("fade-in");
    });

    it("should render dark backdrop", () => {
      renderOverlay();
      const overlay = screen.getByTestId("composer-overlay");
      expect(overlay.className).toContain("bg-black/60");
    });

    it("should render image preview for image files", () => {
      renderOverlay();
      expect(screen.getByTestId("composer-preview-image")).toBeInTheDocument();
    });

    it("should render file preview for non-image/non-video/non-PDF files", () => {
      const docFile = makeComposerFile("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 2 * 1024 * 1024);
      renderOverlay([docFile]);
      expect(screen.getByTestId("composer-preview-file")).toBeInTheDocument();
      expect(screen.getByText("report.docx")).toBeInTheDocument();
      expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    });

    it("should render close button", () => {
      renderOverlay();
      expect(screen.getByTestId("composer-close")).toBeInTheDocument();
    });

    it("should render text input", () => {
      renderOverlay();
      expect(screen.getByTestId("composer-text-input")).toBeInTheDocument();
    });

    it("should render send button", () => {
      renderOverlay();
      expect(screen.getByTestId("composer-send")).toBeInTheDocument();
    });
  });

  describe("Text Transfer", () => {
    it("should populate text input with initial text", () => {
      renderOverlay([makeComposerFile("img.png")], "hello world");
      const input = screen.getByTestId("composer-text-input") as HTMLInputElement;
      expect(input.value).toBe("hello world");
    });

    it("should allow editing the text", () => {
      renderOverlay([makeComposerFile("img.png")], "initial");
      const input = screen.getByTestId("composer-text-input");
      fireEvent.change(input, { target: { value: "updated text" } });
      expect((input as HTMLInputElement).value).toBe("updated text");
    });
  });

  describe("Attachment Count", () => {
    it("should show count indicator for single file", () => {
      renderOverlay();
      expect(screen.getByTestId("attachment-count")).toHaveTextContent("1/5");
    });

    it("should show count indicator for multiple files", () => {
      const files = [
        makeComposerFile("a.png"),
        makeComposerFile("b.png"),
        makeComposerFile("c.png"),
      ];
      renderOverlay(files);
      expect(screen.getByTestId("attachment-count")).toHaveTextContent("3/5");
    });

    it("should disable add-more button at max (5) attachments", () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        makeComposerFile(`img${i}.png`),
      );
      renderOverlay(files);
      const addBtn = screen.getByTestId("add-more-button");
      expect(addBtn).toBeDisabled();
      expect(screen.getByTestId("attachment-count")).toHaveTextContent("5/5");
    });

    it("should enable add-more button when below max", () => {
      renderOverlay();
      const addBtn = screen.getByTestId("add-more-button");
      expect(addBtn).not.toBeDisabled();
    });
  });

  describe("Add More", () => {
    it("should call onAddMore when '+' button is clicked", () => {
      renderOverlay();
      fireEvent.click(screen.getByTestId("add-more-button"));
      expect(onAddMore).toHaveBeenCalledTimes(1);
    });
  });

  describe("Remove Attachment", () => {
    it("should remove an attachment when X button is clicked", () => {
      const files = [
        makeComposerFile("a.png"),
        makeComposerFile("b.png"),
        makeComposerFile("c.png"),
      ];
      renderOverlay(files);

      // 3 items initially
      expect(screen.getByTestId("attachment-count")).toHaveTextContent("3/5");

      // Click first remove button
      const removeButtons = screen.getAllByTestId("remove-attachment");
      fireEvent.click(removeButtons[0]);

      // Count should update
      expect(screen.getByTestId("attachment-count")).toHaveTextContent("2/5");
    });

    it("should call onClose when last attachment is removed", () => {
      renderOverlay([makeComposerFile("only.png")], "my text");

      const removeBtn = screen.getByTestId("remove-attachment");
      fireEvent.click(removeBtn);

      expect(onClose).toHaveBeenCalledWith("my text");
    });

    it("should revoke object URL when attachment is removed", () => {
      const files = [
        makeComposerFile("a.png"),
        makeComposerFile("b.png"),
      ];
      renderOverlay(files);

      const removeButtons = screen.getAllByTestId("remove-attachment");
      fireEvent.click(removeButtons[0]);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-a.png");
    });
  });

  describe("Close", () => {
    it("should call onClose with current text when close button is clicked", () => {
      renderOverlay([makeComposerFile("img.png")], "some text");
      fireEvent.click(screen.getByTestId("composer-close"));
      expect(onClose).toHaveBeenCalledWith("some text");
    });

    it("should call onClose with edited text when close button is clicked", () => {
      renderOverlay([makeComposerFile("img.png")], "original");
      const input = screen.getByTestId("composer-text-input");
      fireEvent.change(input, { target: { value: "edited" } });
      fireEvent.click(screen.getByTestId("composer-close"));
      expect(onClose).toHaveBeenCalledWith("edited");
    });

    it("should call onClose when Escape key is pressed", () => {
      renderOverlay([makeComposerFile("img.png")], "text");
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledWith("text");
    });
  });

  describe("Send", () => {
    it("should call onSend with files and text when send button is clicked", () => {
      const file1 = makeComposerFile("photo.png");
      renderOverlay([file1], "caption");

      fireEvent.click(screen.getByTestId("composer-send"));
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith([file1.file], "caption");
    });

    it("should trim text when sending", () => {
      const file1 = makeComposerFile("photo.png");
      renderOverlay([file1], "  padded text  ");

      fireEvent.click(screen.getByTestId("composer-send"));
      expect(onSend).toHaveBeenCalledWith([file1.file], "padded text");
    });

    it("should call onSend when Enter is pressed in the text input", () => {
      const file1 = makeComposerFile("photo.png");
      renderOverlay([file1], "msg");

      const form = screen.getByTestId("composer-text-input").closest("form")!;
      fireEvent.submit(form);

      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith([file1.file], "msg");
    });

    it("should send all files when multiple are present", () => {
      const files = [
        makeComposerFile("a.png"),
        makeComposerFile("b.png"),
      ];
      renderOverlay(files, "");

      fireEvent.click(screen.getByTestId("composer-send"));
      expect(onSend).toHaveBeenCalledWith(
        [files[0].file, files[1].file],
        "",
      );
    });
  });

  describe("Carousel for Multiple Files", () => {
    it("should show single preview without carousel for one file", () => {
      renderOverlay([makeComposerFile("single.png")]);
      expect(screen.getByTestId("composer-preview-item")).toBeInTheDocument();
      // No carousel controls for single item
      expect(screen.queryByTestId("content-carousel")).not.toBeInTheDocument();
    });

    it("should show carousel for multiple files", () => {
      const files = [
        makeComposerFile("a.png"),
        makeComposerFile("b.png"),
        makeComposerFile("c.png"),
      ];
      renderOverlay(files);
      expect(screen.getByTestId("content-carousel")).toBeInTheDocument();
    });
  });

  describe("Initial Files Sync", () => {
    it("should update files when initialFiles prop changes", () => {
      const initialFiles = [makeComposerFile("a.png")];
      const { rerender } = render(
        <ComposerOverlay
          initialFiles={initialFiles}
          initialText=""
          onSend={onSend}
          onClose={onClose}
          onAddMore={onAddMore}
        />,
      );

      expect(screen.getByTestId("attachment-count")).toHaveTextContent("1/5");

      const updatedFiles = [
        makeComposerFile("a.png"),
        makeComposerFile("b.png"),
        makeComposerFile("c.png"),
      ];
      rerender(
        <ComposerOverlay
          initialFiles={updatedFiles}
          initialText=""
          onSend={onSend}
          onClose={onClose}
          onAddMore={onAddMore}
        />,
      );

      expect(screen.getByTestId("attachment-count")).toHaveTextContent("3/5");
    });
  });

  // ---- FEAT-068: Video and Document Preview Tests ----

  describe("FEAT-068: Video Preview", () => {
    it("should show skeleton while video frames are being extracted", () => {
      const videoFile = makeComposerFile("clip.mp4", "video/mp4");
      renderOverlay([videoFile]);
      // Video extraction is async, so skeleton should appear while loading
      expect(screen.getByTestId("composer-video-skeleton")).toBeInTheDocument();
    });

    it("should show generic video icon when extraction fails (returns empty frames)", async () => {
      vi.useRealTimers();
      const videoFile = makeComposerFile("clip.mp4", "video/mp4");
      renderOverlay([videoFile]);

      // Wait for async extraction to resolve (empty frames from mock = failure)
      await waitFor(() => {
        expect(screen.getByTestId("composer-preview-file")).toBeInTheDocument();
      });
      expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    });

    it("should show video frame with play overlay when frames are available", async () => {
      vi.useRealTimers();
      const { extractVideoFrames } = await import("@/lib/attachments/videoFrameExtractor");
      const mockFrames = [
        { blob: new Blob(["f1"], { type: "image/jpeg" }), width: 300, height: 169, timestamp: 5 },
        { blob: new Blob(["f2"], { type: "image/jpeg" }), width: 300, height: 169, timestamp: 10 },
        { blob: new Blob(["f3"], { type: "image/jpeg" }), width: 300, height: 169, timestamp: 15 },
      ];
      vi.mocked(extractVideoFrames).mockResolvedValueOnce(mockFrames);

      const videoFile = makeComposerFile("clip.mp4", "video/mp4");
      renderOverlay([videoFile]);

      await waitFor(() => {
        expect(screen.getByTestId("composer-video-preview")).toBeInTheDocument();
      });
      expect(screen.getByTestId("composer-video-frame")).toBeInTheDocument();
      expect(screen.getByTestId("video-play-overlay")).toBeInTheDocument();
      expect(screen.getByTestId("video-shuffle-button")).toBeInTheDocument();
    });

    it("should cycle frames when shuffle button is clicked", async () => {
      vi.useRealTimers();
      const { extractVideoFrames } = await import("@/lib/attachments/videoFrameExtractor");
      const mockFrames = [
        { blob: new Blob(["f1"], { type: "image/jpeg" }), width: 300, height: 169, timestamp: 5 },
        { blob: new Blob(["f2"], { type: "image/jpeg" }), width: 300, height: 169, timestamp: 10 },
      ];
      vi.mocked(extractVideoFrames).mockResolvedValueOnce(mockFrames);

      const videoFile = makeComposerFile("clip.mp4", "video/mp4");
      renderOverlay([videoFile]);

      await waitFor(() => {
        expect(screen.getByTestId("video-shuffle-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("video-shuffle-button"));

      // Video preview should still be rendered after shuffle
      expect(screen.getByTestId("composer-video-preview")).toBeInTheDocument();
      expect(screen.getByTestId("composer-video-frame")).toBeInTheDocument();
    });

    it("should not show shuffle button when only one frame", async () => {
      vi.useRealTimers();
      const { extractVideoFrames } = await import("@/lib/attachments/videoFrameExtractor");
      const singleFrame = [
        { blob: new Blob(["f1"], { type: "image/jpeg" }), width: 300, height: 169, timestamp: 5 },
      ];
      vi.mocked(extractVideoFrames).mockResolvedValueOnce(singleFrame);

      const videoFile = makeComposerFile("clip.mp4", "video/mp4");
      renderOverlay([videoFile]);

      await waitFor(() => {
        expect(screen.getByTestId("composer-video-preview")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("video-shuffle-button")).not.toBeInTheDocument();
    });
  });

  describe("FEAT-068: Document Preview", () => {
    it("should show category icon with filename and size for DOCX", () => {
      const docFile = makeComposerFile("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 5 * 1024);
      renderOverlay([docFile]);

      expect(screen.getByTestId("composer-preview-file")).toBeInTheDocument();
      expect(screen.getByText("report.docx")).toBeInTheDocument();
      expect(screen.getByText("5.0 KB")).toBeInTheDocument();
    });

    it("should show category icon with filename and size for ZIP", () => {
      const zipFile = makeComposerFile("archive.zip", "application/zip", 10 * 1024 * 1024);
      renderOverlay([zipFile]);

      expect(screen.getByTestId("composer-preview-file")).toBeInTheDocument();
      expect(screen.getByText("archive.zip")).toBeInTheDocument();
      expect(screen.getByText("10.0 MB")).toBeInTheDocument();
    });

    it("should show skeleton while PDF thumbnail is generating", () => {
      const pdfFile = makeComposerFile("doc.pdf", "application/pdf");
      renderOverlay([pdfFile]);

      expect(screen.getByTestId("composer-pdf-skeleton")).toBeInTheDocument();
    });

    it("should show fallback icon when PDF thumbnail generation fails", async () => {
      vi.useRealTimers();
      const pdfFile = makeComposerFile("doc.pdf", "application/pdf", 2 * 1024 * 1024);
      renderOverlay([pdfFile]);

      // Wait for async PDF generation to resolve (null from mock = failure → fallback)
      await waitFor(() => {
        expect(screen.getByTestId("composer-preview-file")).toBeInTheDocument();
      });
      expect(screen.getByText("doc.pdf")).toBeInTheDocument();
      expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentCard } from "./DocumentCard";
import type { AttachmentRefMeta } from "@/types";

function createAttachment(overrides?: Partial<AttachmentRefMeta>): AttachmentRefMeta {
  return {
    id: "att-doc-001",
    hash: "abc123",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 2400000,
    fileName: "report.docx",
    ...overrides,
  };
}

describe("DocumentCard", () => {
  it("should render horizontal card with icon, filename, and size", () => {
    render(<DocumentCard attachment={createAttachment()} />);

    expect(screen.getByTestId("document-card")).toBeInTheDocument();
    expect(screen.getByTestId("document-icon")).toBeInTheDocument();
    expect(screen.getByText("report.docx")).toBeInTheDocument();
    expect(screen.getByText("2.3 MB")).toBeInTheDocument();
  });

  it("should call onClick when card is clicked", () => {
    const onClick = vi.fn();
    render(<DocumentCard attachment={createAttachment()} onClick={onClick} />);

    fireEvent.click(screen.getByTestId("document-card"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should call onClick on Enter key press", () => {
    const onClick = vi.fn();
    render(<DocumentCard attachment={createAttachment()} onClick={onClick} />);

    fireEvent.keyDown(screen.getByTestId("document-card"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should show PDF thumbnail when thumbnailUrl is provided", () => {
    render(
      <DocumentCard
        attachment={createAttachment({ mimeType: "application/pdf", fileName: "doc.pdf" })}
        thumbnailUrl="blob:pdf-thumb"
      />
    );

    expect(screen.getByTestId("document-thumbnail")).toBeInTheDocument();
    expect(screen.getByTestId("document-thumbnail")).toHaveAttribute("src", "blob:pdf-thumb");
    expect(screen.queryByTestId("document-icon")).not.toBeInTheDocument();
  });

  it("should show icon when thumbnailUrl is null", () => {
    render(
      <DocumentCard
        attachment={createAttachment({ mimeType: "application/pdf", fileName: "doc.pdf" })}
        thumbnailUrl={null}
      />
    );

    expect(screen.getByTestId("document-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("document-thumbnail")).not.toBeInTheDocument();
  });

  it("should show download progress overlay when downloading", () => {
    render(
      <DocumentCard
        attachment={createAttachment()}
        isDownloading={true}
        downloadProgress={60}
      />
    );

    expect(screen.getByTestId("document-download-progress")).toBeInTheDocument();
  });

  it("should not show download progress when not downloading", () => {
    render(<DocumentCard attachment={createAttachment()} />);

    expect(screen.queryByTestId("document-download-progress")).not.toBeInTheDocument();
  });

  it("should have tooltip with full filename", () => {
    render(<DocumentCard attachment={createAttachment()} />);

    expect(screen.getByTestId("document-card")).toHaveAttribute("title", "report.docx");
  });

  it("should format file size correctly for KB", () => {
    render(
      <DocumentCard
        attachment={createAttachment({ size: 5120, fileName: "small.txt" })}
      />
    );

    expect(screen.getByText("5.0 KB")).toBeInTheDocument();
  });

  it("should render correct icon for ZIP files", () => {
    render(
      <DocumentCard
        attachment={createAttachment({
          mimeType: "application/zip",
          fileName: "archive.zip",
          size: 10485760,
        })}
      />
    );

    expect(screen.getByTestId("document-icon")).toBeInTheDocument();
    expect(screen.getByText("archive.zip")).toBeInTheDocument();
    expect(screen.getByText("10.0 MB")).toBeInTheDocument();
  });
});

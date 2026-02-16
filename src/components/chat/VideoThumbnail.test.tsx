import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoThumbnail, formatDuration } from "./VideoThumbnail";
import type { AttachmentRefMeta } from "@/types";

function createVideoAttachment(overrides?: Partial<AttachmentRefMeta>): AttachmentRefMeta {
  return {
    id: "att-vid-001",
    hash: "xyz789",
    mimeType: "video/mp4",
    size: 15000000,
    fileName: "clip.mp4",
    ...overrides,
  };
}

describe("VideoThumbnail", () => {
  it("should render skeleton when thumbnailUrl is null", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl={null}
      />
    );

    expect(screen.getByTestId("video-skeleton")).toBeInTheDocument();
  });

  it("should render fallback when thumbnailUrl is empty string", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl=""
      />
    );

    expect(screen.getByTestId("video-fallback")).toBeInTheDocument();
  });

  it("should render thumbnail with play icon when URL is provided", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:video-frame"
      />
    );

    expect(screen.getByTestId("video-thumbnail")).toBeInTheDocument();
    expect(screen.getByTestId("video-thumbnail-img")).toHaveAttribute("src", "blob:video-frame");
    expect(screen.getByTestId("video-play-icon")).toBeInTheDocument();
  });

  it("should show duration badge when duration is provided", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
        duration={125}
      />
    );

    expect(screen.getByTestId("video-duration-badge")).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("should not show duration badge when duration is 0", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
        duration={0}
      />
    );

    expect(screen.queryByTestId("video-duration-badge")).not.toBeInTheDocument();
  });

  it("should not show duration badge when duration is undefined", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
      />
    );

    expect(screen.queryByTestId("video-duration-badge")).not.toBeInTheDocument();
  });

  it("should call onClick when thumbnail is clicked", () => {
    const onClick = vi.fn();
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByTestId("video-thumbnail"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should call onClick on Enter key press", () => {
    const onClick = vi.fn();
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
        onClick={onClick}
      />
    );

    fireEvent.keyDown(screen.getByTestId("video-thumbnail"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should show download progress overlay when downloading", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
        isDownloading={true}
        downloadProgress={45}
      />
    );

    expect(screen.getByTestId("video-download-progress")).toBeInTheDocument();
  });

  it("should not show download progress when not downloading", () => {
    render(
      <VideoThumbnail
        attachment={createVideoAttachment()}
        thumbnailUrl="blob:frame"
      />
    );

    expect(screen.queryByTestId("video-download-progress")).not.toBeInTheDocument();
  });
});

describe("formatDuration", () => {
  it("should format 0 seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("should format 5 seconds", () => {
    expect(formatDuration(5)).toBe("0:05");
  });

  it("should format 42 seconds", () => {
    expect(formatDuration(42)).toBe("0:42");
  });

  it("should format 65 seconds as 1:05", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  it("should format 125 seconds as 2:05", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("should format 3600 seconds as 1:00:00", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
  });

  it("should format 3661 seconds as 1:01:01", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("should handle fractional seconds by flooring", () => {
    expect(formatDuration(5.7)).toBe("0:05");
  });
});

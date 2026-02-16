import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZoneOverlay } from "./DropZoneOverlay";

function makeFile(name: string, type = "image/png"): File {
  return new File(["data"], name, { type });
}

describe("DropZoneOverlay", () => {
  describe("Visibility", () => {
    it("should render nothing when visible is false", () => {
      const { container } = render(
        <DropZoneOverlay visible={false} onDrop={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("should render overlay when visible is true", () => {
      render(<DropZoneOverlay visible={true} onDrop={vi.fn()} />);
      expect(screen.getByTestId("drop-zone-overlay")).toBeInTheDocument();
    });

    it("should show hint text when visible", () => {
      render(<DropZoneOverlay visible={true} onDrop={vi.fn()} />);
      expect(screen.getByText("Drop files here")).toBeInTheDocument();
      expect(screen.getByText("Images, documents, or videos")).toBeInTheDocument();
    });
  });

  describe("Drop Handling", () => {
    it("should call onDrop with files when files are dropped", () => {
      const onDrop = vi.fn();
      render(<DropZoneOverlay visible={true} onDrop={onDrop} />);

      const overlay = screen.getByTestId("drop-zone-overlay");
      const file = makeFile("photo.png");
      const dataTransfer = { files: [file] };

      fireEvent.drop(overlay, { dataTransfer });
      expect(onDrop).toHaveBeenCalledTimes(1);
      expect(onDrop).toHaveBeenCalledWith([file]);
    });

    it("should not call onDrop when no files are dropped", () => {
      const onDrop = vi.fn();
      render(<DropZoneOverlay visible={true} onDrop={onDrop} />);

      const overlay = screen.getByTestId("drop-zone-overlay");
      fireEvent.drop(overlay, { dataTransfer: { files: [] } });
      expect(onDrop).not.toHaveBeenCalled();
    });

    it("should call onDrop with multiple files", () => {
      const onDrop = vi.fn();
      render(<DropZoneOverlay visible={true} onDrop={onDrop} />);

      const overlay = screen.getByTestId("drop-zone-overlay");
      const files = [makeFile("a.png"), makeFile("b.jpg", "image/jpeg")];
      fireEvent.drop(overlay, { dataTransfer: { files } });

      expect(onDrop).toHaveBeenCalledWith(files);
    });
  });

  describe("Drag Over", () => {
    it("should prevent default on dragOver to allow drop", () => {
      render(<DropZoneOverlay visible={true} onDrop={vi.fn()} />);
      const overlay = screen.getByTestId("drop-zone-overlay");

      const event = new Event("dragover", { bubbles: true, cancelable: true });
      const prevented = !overlay.dispatchEvent(event);
      // dragover is prevented by the handler
      expect(prevented).toBe(true);
    });
  });
});

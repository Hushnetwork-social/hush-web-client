import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MessageInput, MessageInputHandle } from "./MessageInput";
import { createRef } from "react";

describe("MessageInput", () => {
  describe("Basic Rendering", () => {
    it("should render the input field", () => {
      render(<MessageInput onSend={vi.fn()} />);
      expect(screen.getByTestId("message-input")).toBeInTheDocument();
    });

    it("should render the send button", () => {
      render(<MessageInput onSend={vi.fn()} />);
      expect(screen.getByTestId("send-button")).toBeInTheDocument();
    });
  });

  describe("Sending Messages", () => {
    it("should call onSend with trimmed text on Enter", () => {
      const onSend = vi.fn();
      render(<MessageInput onSend={onSend} />);

      const input = screen.getByTestId("message-input");
      fireEvent.change(input, { target: { value: "  hello world  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onSend).toHaveBeenCalledWith("hello world");
    });

    it("should not call onSend for empty input", () => {
      const onSend = vi.fn();
      render(<MessageInput onSend={onSend} />);

      const input = screen.getByTestId("message-input");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onSend).not.toHaveBeenCalled();
    });

    it("should clear input after sending", () => {
      render(<MessageInput onSend={vi.fn()} />);

      const input = screen.getByTestId("message-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "message" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(input.value).toBe("");
    });
  });

  describe("Imperative Handle (getText / setText)", () => {
    it("should expose getText method that returns current text", () => {
      const ref = createRef<MessageInputHandle>();
      render(<MessageInput ref={ref} onSend={vi.fn()} />);

      const input = screen.getByTestId("message-input");
      fireEvent.change(input, { target: { value: "test text" } });

      expect(ref.current?.getText()).toBe("test text");
    });

    it("should expose setText method that updates the input", () => {
      const ref = createRef<MessageInputHandle>();
      render(<MessageInput ref={ref} onSend={vi.fn()} />);

      act(() => {
        ref.current?.setText("restored text");
      });

      const input = screen.getByTestId("message-input") as HTMLInputElement;
      expect(input.value).toBe("restored text");
    });
  });

  describe("Image Paste Handler (FEAT-067)", () => {
    it("should call onImagePaste when image is pasted", () => {
      const onImagePaste = vi.fn();
      render(<MessageInput onSend={vi.fn()} onImagePaste={onImagePaste} />);

      const input = screen.getByTestId("message-input");
      const file = new File(["pixels"], "screenshot.png", { type: "image/png" });
      const clipboardData = {
        items: [{ type: "image/png", getAsFile: () => file }],
      };

      fireEvent.paste(input, { clipboardData });

      expect(onImagePaste).toHaveBeenCalledTimes(1);
      expect(onImagePaste).toHaveBeenCalledWith([file]);
    });

    it("should not call onImagePaste when text is pasted", () => {
      const onImagePaste = vi.fn();
      render(<MessageInput onSend={vi.fn()} onImagePaste={onImagePaste} />);

      const input = screen.getByTestId("message-input");
      const clipboardData = {
        items: [{ type: "text/plain", getAsFile: () => null }],
      };

      fireEvent.paste(input, { clipboardData });

      expect(onImagePaste).not.toHaveBeenCalled();
    });

    it("should not call onImagePaste when no callback is provided", () => {
      render(<MessageInput onSend={vi.fn()} />);

      const input = screen.getByTestId("message-input");
      const file = new File(["pixels"], "img.png", { type: "image/png" });
      const clipboardData = {
        items: [{ type: "image/png", getAsFile: () => file }],
      };

      // Should not throw
      expect(() => fireEvent.paste(input, { clipboardData })).not.toThrow();
    });

    it("should handle multiple image files in a single paste", () => {
      const onImagePaste = vi.fn();
      render(<MessageInput onSend={vi.fn()} onImagePaste={onImagePaste} />);

      const input = screen.getByTestId("message-input");
      const file1 = new File(["a"], "a.png", { type: "image/png" });
      const file2 = new File(["b"], "b.jpg", { type: "image/jpeg" });
      const clipboardData = {
        items: [
          { type: "image/png", getAsFile: () => file1 },
          { type: "image/jpeg", getAsFile: () => file2 },
        ],
      };

      fireEvent.paste(input, { clipboardData });

      expect(onImagePaste).toHaveBeenCalledWith([file1, file2]);
    });

    it("should only include image items from mixed clipboard data", () => {
      const onImagePaste = vi.fn();
      render(<MessageInput onSend={vi.fn()} onImagePaste={onImagePaste} />);

      const input = screen.getByTestId("message-input");
      const imageFile = new File(["px"], "photo.png", { type: "image/png" });
      const clipboardData = {
        items: [
          { type: "text/plain", getAsFile: () => null },
          { type: "image/png", getAsFile: () => imageFile },
        ],
      };

      fireEvent.paste(input, { clipboardData });

      expect(onImagePaste).toHaveBeenCalledWith([imageFile]);
    });
  });

  describe("Escape on Empty", () => {
    it("should call onEscapeEmpty when Escape is pressed with empty input", () => {
      const onEscapeEmpty = vi.fn();
      render(<MessageInput onSend={vi.fn()} onEscapeEmpty={onEscapeEmpty} />);

      const input = screen.getByTestId("message-input");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onEscapeEmpty).toHaveBeenCalledTimes(1);
    });

    it("should not call onEscapeEmpty when Escape is pressed with text in input", () => {
      const onEscapeEmpty = vi.fn();
      render(<MessageInput onSend={vi.fn()} onEscapeEmpty={onEscapeEmpty} />);

      const input = screen.getByTestId("message-input");
      fireEvent.change(input, { target: { value: "some text" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onEscapeEmpty).not.toHaveBeenCalled();
    });
  });
});

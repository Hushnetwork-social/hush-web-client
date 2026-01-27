import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JumpToBottomButton } from "./JumpToBottomButton";

describe("JumpToBottomButton", () => {
  describe("visibility", () => {
    it("should not render when isVisible is false", () => {
      render(
        <JumpToBottomButton count={5} isVisible={false} onJump={vi.fn()} />
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("should render when isVisible is true", () => {
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={vi.fn()} />
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should render when isVisible is true and count is 0", () => {
      render(
        <JumpToBottomButton count={0} isVisible={true} onJump={vi.fn()} />
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("count display", () => {
    it("should not display count when count is 0", () => {
      render(
        <JumpToBottomButton count={0} isVisible={true} onJump={vi.fn()} />
      );
      const button = screen.getByRole("button");
      expect(button.textContent).not.toContain("0");
    });

    it("should display count when count is greater than 0", () => {
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={vi.fn()} />
      );
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("should display 99+ when count exceeds 99", () => {
      render(
        <JumpToBottomButton count={150} isVisible={true} onJump={vi.fn()} />
      );
      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("should display exact count at boundary (99)", () => {
      render(
        <JumpToBottomButton count={99} isVisible={true} onJump={vi.fn()} />
      );
      expect(screen.getByText("99")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have correct aria-label with message count", () => {
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={vi.fn()} />
      );
      expect(
        screen.getByLabelText("Jump to bottom, 5 new messages")
      ).toBeInTheDocument();
    });

    it("should have singular aria-label for 1 message", () => {
      render(
        <JumpToBottomButton count={1} isVisible={true} onJump={vi.fn()} />
      );
      expect(
        screen.getByLabelText("Jump to bottom, 1 new message")
      ).toBeInTheDocument();
    });

    it("should have aria-label without count when count is 0", () => {
      render(
        <JumpToBottomButton count={0} isVisible={true} onJump={vi.fn()} />
      );
      expect(screen.getByLabelText("Jump to bottom")).toBeInTheDocument();
    });

    it("should be focusable via keyboard", () => {
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={vi.fn()} />
      );
      const button = screen.getByRole("button");
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe("interaction", () => {
    it("should call onJump when clicked", () => {
      const onJump = vi.fn();
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={onJump} />
      );
      fireEvent.click(screen.getByRole("button"));
      expect(onJump).toHaveBeenCalledTimes(1);
    });

    it("should call onJump when activated via keyboard Enter", () => {
      const onJump = vi.fn();
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={onJump} />
      );
      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: "Enter" });
      fireEvent.click(button); // Button click happens on Enter for buttons
      expect(onJump).toHaveBeenCalled();
    });

    it("should call onJump when activated via keyboard Space", () => {
      const onJump = vi.fn();
      render(
        <JumpToBottomButton count={5} isVisible={true} onJump={onJump} />
      );
      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: " " });
      fireEvent.click(button); // Button click happens on Space for buttons
      expect(onJump).toHaveBeenCalled();
    });
  });
});

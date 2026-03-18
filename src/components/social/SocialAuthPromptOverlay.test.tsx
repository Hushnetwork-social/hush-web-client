import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SocialAuthPromptOverlay } from "./SocialAuthPromptOverlay";

describe("SocialAuthPromptOverlay", () => {
  it("routes the CTA through auth with the canonical return target", () => {
    render(
      <SocialAuthPromptOverlay
        onClose={vi.fn()}
        returnTo="/social/post/post-123"
      />
    );

    expect(screen.getByTestId("social-auth-overlay-cta")).toHaveAttribute(
      "href",
      "/auth?returnTo=%2Fsocial%2Fpost%2Fpost-123"
    );
    expect(screen.getByTestId("social-auth-overlay-return-copy")).toHaveTextContent(
      "you'll come right back to this same post"
    );
  });

  it("falls back to the base auth route when no safe return target is provided", () => {
    render(
      <SocialAuthPromptOverlay
        onClose={vi.fn()}
        returnTo="https://example.com/social/post/post-123"
      />
    );

    expect(screen.getByTestId("social-auth-overlay-cta")).toHaveAttribute(
      "href",
      "/auth"
    );
  });

  it("supports both button and backdrop dismissal", () => {
    const onClose = vi.fn();
    render(<SocialAuthPromptOverlay onClose={onClose} returnTo="/social/post/post-123" />);

    fireEvent.click(screen.getByTestId("social-auth-overlay-card"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("social-auth-overlay-close"));
    fireEvent.click(screen.getByTestId("social-auth-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

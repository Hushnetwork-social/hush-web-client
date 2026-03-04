import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SocialPostPermalinkPage from "./page";

let accessParam: string | null = null;
let postIdParam = "post-123";

vi.mock("next/navigation", () => ({
  useParams: () => ({ postId: postIdParam }),
  useSearchParams: () => ({
    get: (key: string) => (key === "access" ? accessParam : null),
  }),
}));

describe("SocialPostPermalinkPage", () => {
  beforeEach(() => {
    accessParam = null;
    postIdParam = "post-123";
  });

  it("renders public permalink content by default", () => {
    render(<SocialPostPermalinkPage />);

    expect(screen.getByTestId("social-permalink-public")).toBeInTheDocument();
    expect(screen.getByText("Post ID: post-123")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-react")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-comment")).toBeInTheDocument();
  });

  it("renders guest denial with create-account CTA", () => {
    accessParam = "guest";
    render(<SocialPostPermalinkPage />);

    expect(screen.getByTestId("social-permalink-guest")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-guest-cta")).toBeInTheDocument();
  });

  it("renders privacy-safe unauthorized state for logged-in user without permission", () => {
    accessParam = "denied";
    render(<SocialPostPermalinkPage />);

    expect(screen.getByTestId("social-permalink-denied")).toBeInTheDocument();
    expect(screen.getByText("You do not have permission to view this post")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-denied-cta")).toBeInTheDocument();
    expect(screen.queryByText("Post ID: post-123")).not.toBeInTheDocument();
  });
});

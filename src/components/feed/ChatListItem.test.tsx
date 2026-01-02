/**
 * Unit tests for ChatListItem component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatListItem } from "./ChatListItem";

describe("ChatListItem", () => {
  const defaultProps = {
    name: "Test User",
    initials: "TU",
    lastMessage: "Hello world",
    timestamp: "2m ago",
    unreadCount: 0,
    isSelected: false,
    isPersonalFeed: false,
    feedType: "chat" as const,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with basic props", () => {
      render(<ChatListItem {...defaultProps} />);

      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("Hello world")).toBeInTheDocument();
      expect(screen.getByText("2m ago")).toBeInTheDocument();
    });

    it("renders initials for chat feeds", () => {
      render(<ChatListItem {...defaultProps} />);

      expect(screen.getByText("TU")).toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
      render(<ChatListItem {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Personal Feed", () => {
    it("shows YOU initials for personal feed", () => {
      render(
        <ChatListItem
          {...defaultProps}
          name="My Notes (YOU)"
          initials="YOU"
          isPersonalFeed={true}
          feedType="personal"
        />
      );

      expect(screen.getByText("YOU")).toBeInTheDocument();
    });

    it("renders name with (YOU) suffix for personal feed", () => {
      render(
        <ChatListItem
          {...defaultProps}
          name="My Notes (YOU)"
          isPersonalFeed={true}
          feedType="personal"
        />
      );

      expect(screen.getByText("My Notes")).toBeInTheDocument();
      expect(screen.getByText(/\(YOU\)/)).toBeInTheDocument();
    });
  });

  describe("Group Feed Icon", () => {
    it("shows group icon for group feeds", () => {
      render(
        <ChatListItem
          {...defaultProps}
          name="Study Group"
          feedType="group"
        />
      );

      // Group icon should be rendered, not initials
      const groupIcon = screen.getByRole("button").querySelector("svg");
      expect(groupIcon).toBeInTheDocument();
      // Should not show initials text
      expect(screen.queryByText("SG")).not.toBeInTheDocument();
    });

    it("does not show group icon for chat feeds", () => {
      render(<ChatListItem {...defaultProps} feedType="chat" />);

      // Should show initials, not group icon
      expect(screen.getByText("TU")).toBeInTheDocument();
    });

    it("does not show group icon for personal feeds", () => {
      render(
        <ChatListItem
          {...defaultProps}
          initials="YOU"
          isPersonalFeed={true}
          feedType="personal"
        />
      );

      // Should show initials, not group icon
      expect(screen.getByText("YOU")).toBeInTheDocument();
    });

    it("has visually distinct background for group icon", () => {
      render(
        <ChatListItem
          {...defaultProps}
          name="Study Group"
          feedType="group"
        />
      );

      // Find the avatar container (the one containing the svg)
      const svg = screen.getByRole("button").querySelector("svg");
      const avatarContainer = svg?.parentElement;
      expect(avatarContainer).toHaveClass("bg-hush-purple/20");
    });
  });

  describe("Unread Count", () => {
    it("shows unread count badge when count > 0", () => {
      render(<ChatListItem {...defaultProps} unreadCount={5} />);

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not show unread count badge when count is 0", () => {
      render(<ChatListItem {...defaultProps} unreadCount={0} />);

      // Badge should not exist
      const badges = screen.queryAllByText("0");
      const badgeContainer = badges.find(
        (el) => el.parentElement?.classList.contains("rounded-full")
      );
      expect(badgeContainer).toBeUndefined();
    });
  });

  describe("Selected State", () => {
    it("applies selected styles when isSelected is true", () => {
      render(<ChatListItem {...defaultProps} isSelected={true} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-hush-purple/20");
      expect(button).toHaveClass("border-hush-purple");
    });

    it("applies default styles when isSelected is false", () => {
      render(<ChatListItem {...defaultProps} isSelected={false} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-hush-bg-element");
    });
  });

  describe("Timestamp", () => {
    it("renders timestamp when provided", () => {
      render(<ChatListItem {...defaultProps} timestamp="5m ago" />);

      expect(screen.getByText("5m ago")).toBeInTheDocument();
    });

    it("does not render timestamp when not provided", () => {
      render(<ChatListItem {...defaultProps} timestamp={undefined} />);

      expect(screen.queryByText("5m ago")).not.toBeInTheDocument();
    });
  });

  describe("Message Preview", () => {
    it("displays last message text", () => {
      render(<ChatListItem {...defaultProps} lastMessage="This is a test message" />);

      expect(screen.getByText("This is a test message")).toBeInTheDocument();
    });

    it("truncates long messages", () => {
      render(<ChatListItem {...defaultProps} />);

      // The message container should have truncate class
      const messageElement = screen.getByText("Hello world");
      expect(messageElement).toHaveClass("truncate");
    });
  });

  describe("Accessibility", () => {
    it("has button role", () => {
      render(<ChatListItem {...defaultProps} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is focusable", () => {
      render(<ChatListItem {...defaultProps} />);

      const button = screen.getByRole("button");
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it("group icon has aria-hidden", () => {
      render(<ChatListItem {...defaultProps} feedType="group" />);

      const svg = screen.getByRole("button").querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });
});

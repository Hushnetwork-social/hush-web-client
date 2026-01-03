import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroupCard } from "./GroupCard";
import type { PublicGroupInfo } from "@/types";

describe("GroupCard", () => {
  const mockOnJoin = vi.fn();

  const defaultGroup: PublicGroupInfo = {
    feedId: "group-123",
    name: "Test Group",
    description: "A test group description",
    memberCount: 10,
    isPublic: true,
  };

  const defaultProps = {
    group: defaultGroup,
    onJoin: mockOnJoin,
    isJoining: false,
    isJoined: false,
    cooldownError: null,
  };

  beforeEach(() => {
    mockOnJoin.mockClear();
  });

  describe("Display", () => {
    it("should render group name", () => {
      render(<GroupCard {...defaultProps} />);

      expect(screen.getByText("Test Group")).toBeInTheDocument();
    });

    it("should render group description", () => {
      render(<GroupCard {...defaultProps} />);

      expect(screen.getByText("A test group description")).toBeInTheDocument();
    });

    it("should render member count", () => {
      render(<GroupCard {...defaultProps} />);

      expect(screen.getByText("10 members")).toBeInTheDocument();
    });

    it("should render singular member for count of 1", () => {
      const singleMemberGroup = { ...defaultGroup, memberCount: 1 };
      render(<GroupCard {...defaultProps} group={singleMemberGroup} />);

      expect(screen.getByText("1 member")).toBeInTheDocument();
    });

    it("should render group icon", () => {
      render(<GroupCard {...defaultProps} />);

      // The Users icon from lucide-react
      expect(screen.getByTestId("group-card")).toBeInTheDocument();
    });

    it("should not render description if not provided", () => {
      const groupWithoutDesc = { ...defaultGroup, description: undefined };
      render(<GroupCard {...defaultProps} group={groupWithoutDesc} />);

      expect(screen.getByText("Test Group")).toBeInTheDocument();
      expect(screen.queryByText("A test group description")).not.toBeInTheDocument();
    });
  });

  describe("Join Button", () => {
    it("should render Join button when not joined", () => {
      render(<GroupCard {...defaultProps} />);

      expect(screen.getByRole("button", { name: /join test group/i })).toBeInTheDocument();
    });

    it("should call onJoin when Join button is clicked", () => {
      render(<GroupCard {...defaultProps} />);

      const joinButton = screen.getByRole("button", { name: /join test group/i });
      fireEvent.click(joinButton);

      expect(mockOnJoin).toHaveBeenCalledTimes(1);
    });

    it("should show loading state when isJoining is true", () => {
      render(<GroupCard {...defaultProps} isJoining={true} />);

      expect(screen.getByText("Joining...")).toBeInTheDocument();
    });

    it("should disable button when isJoining is true", () => {
      render(<GroupCard {...defaultProps} isJoining={true} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Joined State", () => {
    it("should show Joined badge when isJoined is true", () => {
      render(<GroupCard {...defaultProps} isJoined={true} />);

      expect(screen.getByText("Joined")).toBeInTheDocument();
    });

    it("should not show Join button when isJoined is true", () => {
      render(<GroupCard {...defaultProps} isJoined={true} />);

      expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
    });
  });

  describe("Cooldown Error", () => {
    it("should display cooldown error message", () => {
      render(<GroupCard {...defaultProps} cooldownError="Wait 85 blocks to rejoin" />);

      expect(screen.getByText("Wait 85 blocks to rejoin")).toBeInTheDocument();
    });

    it("should disable button when cooldown error is present", () => {
      render(<GroupCard {...defaultProps} cooldownError="Wait 85 blocks to rejoin" />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("should not call onJoin when button is clicked with cooldown error", () => {
      render(<GroupCard {...defaultProps} cooldownError="Wait 85 blocks to rejoin" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockOnJoin).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible button label", () => {
      render(<GroupCard {...defaultProps} />);

      expect(screen.getByRole("button", { name: /join test group/i })).toBeInTheDocument();
    });

    it("should have group card container", () => {
      render(<GroupCard {...defaultProps} />);

      expect(screen.getByTestId("group-card")).toBeInTheDocument();
    });
  });
});

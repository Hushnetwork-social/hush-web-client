import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RoleBadge } from "./RoleBadge";

describe("RoleBadge", () => {
  describe("Admin role", () => {
    it("should render admin badge with crown icon", () => {
      render(<RoleBadge role="Admin" />);

      const badge = screen.getByTitle("Admin");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-hush-purple/20");
      expect(badge).toHaveClass("text-hush-purple");
    });

    it("should show label when showLabel is true", () => {
      render(<RoleBadge role="Admin" showLabel />);

      expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("should apply small size by default", () => {
      render(<RoleBadge role="Admin" />);

      const badge = screen.getByTitle("Admin");
      expect(badge).toHaveClass("px-1.5");
      expect(badge).toHaveClass("py-0.5");
    });

    it("should apply medium size when specified", () => {
      render(<RoleBadge role="Admin" size="md" />);

      const badge = screen.getByTitle("Admin");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("py-1");
    });
  });

  describe("Blocked role", () => {
    it("should render blocked badge with shield-off icon", () => {
      render(<RoleBadge role="Blocked" />);

      const badge = screen.getByTitle("Blocked");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("bg-red-500/20");
      expect(badge).toHaveClass("text-red-400");
    });

    it("should show label when showLabel is true", () => {
      render(<RoleBadge role="Blocked" showLabel />);

      expect(screen.getByText("Blocked")).toBeInTheDocument();
    });
  });

  describe("Member role", () => {
    it("should not render anything for Member role", () => {
      const { container } = render(<RoleBadge role="Member" />);

      expect(container.firstChild).toBeNull();
    });

    it("should not render even with showLabel true", () => {
      const { container } = render(<RoleBadge role="Member" showLabel />);

      expect(container.firstChild).toBeNull();
    });
  });
});

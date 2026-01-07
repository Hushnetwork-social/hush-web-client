import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useCreateGroupFlow } from "./useCreateGroupFlow";
import type { SelectedMember } from "./MemberSelector";

describe("useCreateGroupFlow", () => {
  describe("Initial State", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      expect(result.current.currentStep).toBe("type");
      expect(result.current.groupType).toBeNull();
      expect(result.current.selectedMembers).toEqual([]);
      expect(result.current.name).toBe("");
      expect(result.current.description).toBe("");
    });

    it("should have totalSteps of 2 initially (before type selection)", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      expect(result.current.totalSteps).toBe(2);
    });

    it("should have currentStepNumber of 1 initially", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      expect(result.current.currentStepNumber).toBe(1);
    });

    it("should not be able to proceed without selecting type", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      expect(result.current.canProceed).toBe(false);
    });
  });

  describe("setGroupType", () => {
    it("should set group type to public", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
      });

      expect(result.current.groupType).toBe("public");
      expect(result.current.totalSteps).toBe(2);
    });

    it("should set group type to private", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("private");
      });

      expect(result.current.groupType).toBe("private");
      expect(result.current.totalSteps).toBe(3);
    });

    it("should enable proceeding after type is selected", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
      });

      expect(result.current.canProceed).toBe(true);
    });
  });

  describe("Public Flow Navigation", () => {
    it("should navigate from type to details for public groups", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
      });

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("details");
      expect(result.current.currentStepNumber).toBe(2);
    });

    it("should navigate back from details to type for public groups", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
      });

      act(() => {
        result.current.goNext();
      });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentStep).toBe("type");
      expect(result.current.currentStepNumber).toBe(1);
    });
  });

  describe("Private Flow Navigation", () => {
    it("should navigate from type to members for private groups", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("private");
      });

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("members");
      expect(result.current.currentStepNumber).toBe(2);
    });

    it("should navigate from members to details for private groups", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("private");
      });

      act(() => {
        result.current.goNext();
      });

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("details");
      expect(result.current.currentStepNumber).toBe(3);
    });

    it("should navigate back from details to members for private groups", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("private");
        result.current.goNext();
        result.current.goNext();
      });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentStep).toBe("members");
    });

    it("should navigate back from members to type", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("private");
        result.current.goNext();
      });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentStep).toBe("type");
    });
  });

  describe("State Setters", () => {
    it("should set selected members", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      const members: SelectedMember[] = [
        {
          publicSigningAddress: "0x123",
          publicEncryptAddress: "0x456",
          displayName: "Alice",
        },
      ];

      act(() => {
        result.current.setSelectedMembers(members);
      });

      expect(result.current.selectedMembers).toEqual(members);
    });

    it("should set name", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setName("My Group");
      });

      expect(result.current.name).toBe("My Group");
    });

    it("should set description", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setDescription("This is my group");
      });

      expect(result.current.description).toBe("This is my group");
    });
  });

  describe("canProceed", () => {
    it("should allow proceeding from members step with 0 members", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("private");
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("members");
      expect(result.current.canProceed).toBe(true);
    });

    it("should require name on details step", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("details");
      expect(result.current.canProceed).toBe(false);

      act(() => {
        result.current.setName("My Group");
      });

      expect(result.current.canProceed).toBe(true);
    });

    it("should not allow empty name (whitespace only)", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
        result.current.goNext();
        result.current.setName("   ");
      });

      expect(result.current.canProceed).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset all state to initial values", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      // Set up some state
      act(() => {
        result.current.setGroupType("private");
        result.current.goNext();
        result.current.setSelectedMembers([
          {
            publicSigningAddress: "0x123",
            publicEncryptAddress: "0x456",
            displayName: "Alice",
          },
        ]);
        result.current.goNext();
        result.current.setName("Test Group");
        result.current.setDescription("Test Description");
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all state is reset
      expect(result.current.currentStep).toBe("type");
      expect(result.current.groupType).toBeNull();
      expect(result.current.selectedMembers).toEqual([]);
      expect(result.current.name).toBe("");
      expect(result.current.description).toBe("");
    });
  });

  describe("Edge Cases", () => {
    it("should not go back from type step", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentStep).toBe("type");
    });

    it("should not go forward from details step", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("details");

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe("details");
    });

    it("should allow changing type while on type step", () => {
      const { result } = renderHook(() => useCreateGroupFlow());

      act(() => {
        result.current.setGroupType("public");
      });

      expect(result.current.groupType).toBe("public");
      expect(result.current.totalSteps).toBe(2);

      act(() => {
        result.current.setGroupType("private");
      });

      expect(result.current.groupType).toBe("private");
      expect(result.current.totalSteps).toBe(3);
    });
  });
});

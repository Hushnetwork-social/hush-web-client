"use client";

import { useState, useCallback, useMemo } from "react";
import type { SelectedMember } from "./MemberSelector";

export type GroupType = "public" | "private" | null;
export type FlowStep = "type" | "members" | "details";

export interface CreateGroupFlowState {
  currentStep: FlowStep;
  groupType: GroupType;
  selectedMembers: SelectedMember[];
  name: string;
  description: string;
}

export interface UseCreateGroupFlowReturn {
  // State
  currentStep: FlowStep;
  groupType: GroupType;
  selectedMembers: SelectedMember[];
  name: string;
  description: string;

  // Actions
  setGroupType: (type: GroupType) => void;
  setSelectedMembers: (members: SelectedMember[]) => void;
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;

  // Computed
  totalSteps: number;
  currentStepNumber: number;
  canProceed: boolean;
}

const initialState: CreateGroupFlowState = {
  currentStep: "type",
  groupType: null,
  selectedMembers: [],
  name: "",
  description: "",
};

/**
 * Custom hook for managing the Create Group wizard flow.
 *
 * Provides conditional navigation based on group type:
 * - Public groups: 2 steps (type → details)
 * - Private groups: 3 steps (type → members → details)
 */
export function useCreateGroupFlow(): UseCreateGroupFlowReturn {
  const [state, setState] = useState<CreateGroupFlowState>(initialState);

  // Calculate total steps based on group type
  const totalSteps = useMemo(() => {
    if (state.groupType === "public") return 2;
    if (state.groupType === "private") return 3;
    return 2; // Default before type is selected
  }, [state.groupType]);

  // Calculate current step number (1-indexed)
  const currentStepNumber = useMemo(() => {
    switch (state.currentStep) {
      case "type":
        return 1;
      case "members":
        return 2;
      case "details":
        return state.groupType === "public" ? 2 : 3;
      default:
        return 1;
    }
  }, [state.currentStep, state.groupType]);

  // Determine if user can proceed from current step
  const canProceed = useMemo(() => {
    switch (state.currentStep) {
      case "type":
        return state.groupType !== null;
      case "members":
        // Members are optional for Private groups
        return true;
      case "details":
        return state.name.trim().length > 0;
      default:
        return false;
    }
  }, [state.currentStep, state.groupType, state.name]);

  // Set group type
  const setGroupType = useCallback((type: GroupType) => {
    setState((prev) => ({ ...prev, groupType: type }));
  }, []);

  // Set selected members
  const setSelectedMembers = useCallback((members: SelectedMember[]) => {
    setState((prev) => ({ ...prev, selectedMembers: members }));
  }, []);

  // Set name
  const setName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, name }));
  }, []);

  // Set description
  const setDescription = useCallback((description: string) => {
    setState((prev) => ({ ...prev, description }));
  }, []);

  // Navigate to next step
  const goNext = useCallback(() => {
    setState((prev) => {
      switch (prev.currentStep) {
        case "type":
          // Public goes directly to details, Private goes to members
          return {
            ...prev,
            currentStep: prev.groupType === "public" ? "details" : "members",
          };
        case "members":
          return { ...prev, currentStep: "details" };
        case "details":
          // Already at last step
          return prev;
        default:
          return prev;
      }
    });
  }, []);

  // Navigate to previous step
  const goBack = useCallback(() => {
    setState((prev) => {
      switch (prev.currentStep) {
        case "type":
          // Already at first step
          return prev;
        case "members":
          return { ...prev, currentStep: "type" };
        case "details":
          // Public goes back to type, Private goes back to members
          return {
            ...prev,
            currentStep: prev.groupType === "public" ? "type" : "members",
          };
        default:
          return prev;
      }
    });
  }, []);

  // Reset all state to initial values
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // State
    currentStep: state.currentStep,
    groupType: state.groupType,
    selectedMembers: state.selectedMembers,
    name: state.name,
    description: state.description,

    // Actions
    setGroupType,
    setSelectedMembers,
    setName,
    setDescription,
    goNext,
    goBack,
    reset,

    // Computed
    totalSteps,
    currentStepNumber,
    canProceed,
  };
}

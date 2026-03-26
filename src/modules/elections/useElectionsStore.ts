import { create } from 'zustand';
import type {
  ElectionCommandResponse,
  ElectionDraftInput,
  ElectionWarningCodeProto,
  ElectionSummary,
  GetElectionOpenReadinessResponse,
  GetElectionResponse,
  InviteElectionTrusteeRequest,
  ResolveElectionTrusteeInvitationRequest,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';

export type ElectionsFeedbackTone = 'success' | 'error';

export interface ElectionsFeedback {
  tone: ElectionsFeedbackTone;
  message: string;
  details: string[];
}

interface ElectionsState {
  ownerPublicAddress: string | null;
  elections: ElectionSummary[];
  selectedElectionId: string | null;
  selectedElection: GetElectionResponse | null;
  openReadiness: GetElectionOpenReadinessResponse | null;
  isLoadingList: boolean;
  isLoadingDetail: boolean;
  isSubmitting: boolean;
  feedback: ElectionsFeedback | null;
  error: string | null;
  setOwnerPublicAddress: (ownerPublicAddress: string) => void;
  beginNewElection: () => void;
  clearFeedback: () => void;
  loadOwnerDashboard: (ownerPublicAddress: string) => Promise<void>;
  loadElection: (electionId: string) => Promise<void>;
  createDraft: (draft: ElectionDraftInput, snapshotReason: string) => Promise<boolean>;
  updateDraft: (draft: ElectionDraftInput, snapshotReason: string) => Promise<boolean>;
  inviteTrustee: (request: InviteElectionTrusteeRequest) => Promise<boolean>;
  revokeInvitation: (request: ResolveElectionTrusteeInvitationRequest) => Promise<boolean>;
  loadOpenReadiness: (
    requiredWarningCodes: ElectionWarningCodeProto[]
  ) => Promise<GetElectionOpenReadinessResponse | null>;
  openElection: (requiredWarningCodes: ElectionWarningCodeProto[]) => Promise<boolean>;
  closeElection: () => Promise<boolean>;
  finalizeElection: () => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  ownerPublicAddress: null,
  elections: [],
  selectedElectionId: null,
  selectedElection: null,
  openReadiness: null,
  isLoadingList: false,
  isLoadingDetail: false,
  isSubmitting: false,
  feedback: null,
  error: null,
};

function buildCommandFailureFeedback(response: ElectionCommandResponse): ElectionsFeedback {
  const details = response.ValidationErrors.length > 0
    ? response.ValidationErrors
    : [response.ErrorMessage || 'The election command was rejected.'];

  return {
    tone: 'error',
    message: response.ErrorMessage || details[0] || 'The election command was rejected.',
    details,
  };
}

function buildThrownErrorFeedback(error: unknown, fallbackMessage: string): ElectionsFeedback {
  return {
    tone: 'error',
    message: error instanceof Error ? error.message : fallbackMessage,
    details: [],
  };
}

export const useElectionsStore = create<ElectionsState>((set, get) => ({
  ...initialState,

  setOwnerPublicAddress: (ownerPublicAddress) => {
    set({ ownerPublicAddress });
  },

  beginNewElection: () => {
    set({
      selectedElectionId: null,
      selectedElection: null,
      openReadiness: null,
      feedback: null,
      error: null,
    });
  },

  clearFeedback: () => {
    set({ feedback: null, error: null });
  },

  loadOwnerDashboard: async (ownerPublicAddress) => {
    set({
      ownerPublicAddress,
      isLoadingList: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.getElectionsByOwner({
        OwnerPublicAddress: ownerPublicAddress,
      });

      const selectedElectionId = get().selectedElectionId;
      const hasExistingSelection = !!selectedElectionId
        && response.Elections.some((election) => election.ElectionId === selectedElectionId);
      const resolvedSelection = hasExistingSelection
        ? selectedElectionId
        : response.Elections[0]?.ElectionId ?? null;

      set({
        elections: response.Elections,
        selectedElectionId: resolvedSelection,
      });

      if (resolvedSelection) {
        await get().loadElection(resolvedSelection);
      } else {
        set({
          selectedElection: null,
          openReadiness: null,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load owned elections.',
      });
    } finally {
      set({ isLoadingList: false });
    }
  },

  loadElection: async (electionId) => {
    set({
      isLoadingDetail: true,
      selectedElectionId: electionId,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.getElection({ ElectionId: electionId });

      if (!response.Success) {
        set({
          selectedElection: response,
          openReadiness: null,
          error: response.ErrorMessage || 'Failed to load election details.',
        });
        return;
      }

      set({
        selectedElection: response,
        openReadiness: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load election details.',
      });
    } finally {
      set({ isLoadingDetail: false });
    }
  },

  createDraft: async (draft, snapshotReason) => {
    const ownerPublicAddress = get().ownerPublicAddress;
    if (!ownerPublicAddress) {
      set({
        feedback: {
          tone: 'error',
          message: 'Owner public address is missing.',
          details: [],
        },
      });
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.createElectionDraft({
        OwnerPublicAddress: ownerPublicAddress,
        ActorPublicAddress: ownerPublicAddress,
        SnapshotReason: snapshotReason,
        Draft: draft,
      });

      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      const electionId = response.Election?.ElectionId ?? null;
      await get().loadOwnerDashboard(ownerPublicAddress);

      if (electionId) {
        await get().loadElection(electionId);
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Election draft created.',
          details: [],
        },
      });

      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to create election draft.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  updateDraft: async (draft, snapshotReason) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress) {
      set({
        feedback: {
          tone: 'error',
          message: 'No draft election is selected.',
          details: [],
        },
      });
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.updateElectionDraft({
        ElectionId: electionId,
        ActorPublicAddress: ownerPublicAddress,
        SnapshotReason: snapshotReason,
        Draft: draft,
      });

      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await get().loadOwnerDashboard(ownerPublicAddress);
      await get().loadElection(electionId);

      set({
        feedback: {
          tone: 'success',
          message: 'Election draft updated.',
          details: [],
        },
      });

      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to update election draft.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  inviteTrustee: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.inviteElectionTrustee(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await get().loadElection(request.ElectionId);
      set({
        feedback: {
          tone: 'success',
          message: 'Trustee invitation created.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to invite trustee.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  revokeInvitation: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.revokeElectionTrusteeInvitation(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await get().loadElection(request.ElectionId);
      set({
        feedback: {
          tone: 'success',
          message: 'Trustee invitation revoked.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to revoke trustee invitation.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  loadOpenReadiness: async (requiredWarningCodes) => {
    const electionId = get().selectedElectionId;
    if (!electionId) {
      set({ openReadiness: null });
      return null;
    }

    try {
      const response = await electionsService.getElectionOpenReadiness({
        ElectionId: electionId,
        RequiredWarningCodes: requiredWarningCodes,
      });

      set({ openReadiness: response });
      return response;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to load election readiness.'),
      });
      return null;
    }
  },

  openElection: async (requiredWarningCodes) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.openElection({
        ElectionId: electionId,
        ActorPublicAddress: ownerPublicAddress,
        RequiredWarningCodes: requiredWarningCodes,
        FrozenEligibleVoterSetHash: '',
        TrusteePolicyExecutionReference: '',
        ReportingPolicyExecutionReference: '',
        ReviewWindowExecutionReference: '',
      });

      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await get().loadElection(electionId);
      await get().loadOwnerDashboard(ownerPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Election opened.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to open election.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  closeElection: async () => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.closeElection({
        ElectionId: electionId,
        ActorPublicAddress: ownerPublicAddress,
        AcceptedBallotSetHash: '',
        FinalEncryptedTallyHash: '',
      });

      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await get().loadElection(electionId);
      await get().loadOwnerDashboard(ownerPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Election closed.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to close election.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  finalizeElection: async () => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.finalizeElection({
        ElectionId: electionId,
        ActorPublicAddress: ownerPublicAddress,
        AcceptedBallotSetHash: '',
        FinalEncryptedTallyHash: '',
      });

      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await get().loadElection(electionId);
      await get().loadOwnerDashboard(ownerPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Election finalized.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to finalize election.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));

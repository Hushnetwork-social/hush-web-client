import { create } from 'zustand';
import {
  type CompleteElectionCeremonyTrusteeRequest,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeInvitationStatusProto,
  type GetElectionCeremonyActionViewResponse,
  type JoinElectionCeremonyRequest,
  type PublishElectionCeremonyTransportKeyRequest,
  type RecordElectionCeremonySelfTestRequest,
  type RecordElectionCeremonyShareExportRequest,
  type RecordElectionCeremonyShareImportRequest,
  type RecordElectionCeremonyValidationFailureRequest,
  type RestartElectionCeremonyRequest,
  type StartElectionCeremonyRequest,
  type SubmitElectionCeremonyMaterialRequest,
} from '@/lib/grpc';
import type {
  ElectionDraftInput,
  ElectionWarningCodeProto,
  ElectionSummary,
  GetElectionOpenReadinessResponse,
  GetElectionResponse,
  InviteElectionTrusteeRequest,
  ResolveElectionTrusteeInvitationRequest,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import { getGovernedActionLabel } from './contracts';
import {
  createAcceptElectionTrusteeInvitationTransaction,
  createApproveElectionGovernedProposalTransaction,
  createCloseElectionTransaction,
  createCompleteElectionCeremonyTrusteeTransaction,
  createElectionDraftTransaction,
  createElectionTrusteeInvitationTransaction,
  createFinalizeElectionTransaction,
  createJoinElectionCeremonyTransaction,
  createOpenElectionTransaction,
  createPublishElectionCeremonyTransportKeyTransaction,
  createRejectElectionTrusteeInvitationTransaction,
  createRecordElectionCeremonySelfTestSuccessTransaction,
  createRecordElectionCeremonyShareExportTransaction,
  createRecordElectionCeremonyShareImportTransaction,
  createRecordElectionCeremonyValidationFailureTransaction,
  createRevokeElectionTrusteeInvitationTransaction,
  createRestartElectionCeremonyTransaction,
  createRetryElectionGovernedProposalExecutionTransaction,
  createStartElectionCeremonyTransaction,
  createStartElectionGovernedProposalTransaction,
  createSubmitElectionCeremonyMaterialTransaction,
  createUpdateElectionDraftTransaction,
} from './transactionService';

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
  ceremonyActionView: GetElectionCeremonyActionViewResponse | null;
  openReadiness: GetElectionOpenReadinessResponse | null;
  isLoadingList: boolean;
  isLoadingDetail: boolean;
  isLoadingCeremonyActionView: boolean;
  isSubmitting: boolean;
  feedback: ElectionsFeedback | null;
  error: string | null;
  setOwnerPublicAddress: (ownerPublicAddress: string) => void;
  beginNewElection: () => void;
  clearFeedback: () => void;
  loadOwnerDashboard: (ownerPublicAddress: string) => Promise<void>;
  loadElection: (electionId: string) => Promise<void>;
  loadCeremonyActionView: (
    actorPublicAddress: string,
    electionId?: string
  ) => Promise<GetElectionCeremonyActionViewResponse | null>;
  createDraft: (
    draft: ElectionDraftInput,
    snapshotReason: string,
    ownerPublicEncryptAddress: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  updateDraft: (
    draft: ElectionDraftInput,
    snapshotReason: string,
    ownerPublicEncryptAddress: string,
    ownerPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  inviteTrustee: (
    request: InviteElectionTrusteeRequest,
    ownerPublicEncryptAddress: string,
    ownerPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  acceptTrusteeInvitation: (
    request: ResolveElectionTrusteeInvitationRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  rejectTrusteeInvitation: (
    request: ResolveElectionTrusteeInvitationRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  revokeInvitation: (
    request: ResolveElectionTrusteeInvitationRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  loadOpenReadiness: (
    requiredWarningCodes: ElectionWarningCodeProto[]
  ) => Promise<GetElectionOpenReadinessResponse | null>;
  startGovernedProposal: (
    actionType: ElectionGovernedActionTypeProto,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  approveGovernedProposal: (
    proposalId: string,
    actorPublicAddress: string,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string,
    approvalNote?: string
  ) => Promise<boolean>;
  retryGovernedProposalExecution: (
    proposalId: string,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  startElectionCeremony: (
    request: StartElectionCeremonyRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  restartElectionCeremony: (
    request: RestartElectionCeremonyRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  publishElectionCeremonyTransportKey: (
    request: PublishElectionCeremonyTransportKeyRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  joinElectionCeremony: (
    request: JoinElectionCeremonyRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  recordElectionCeremonySelfTestSuccess: (
    request: RecordElectionCeremonySelfTestRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  submitElectionCeremonyMaterial: (
    request: SubmitElectionCeremonyMaterialRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  recordElectionCeremonyValidationFailure: (
    request: RecordElectionCeremonyValidationFailureRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  completeElectionCeremonyTrustee: (
    request: CompleteElectionCeremonyTrusteeRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  recordElectionCeremonyShareExport: (
    request: RecordElectionCeremonyShareExportRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  recordElectionCeremonyShareImport: (
    request: RecordElectionCeremonyShareImportRequest,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  openElection: (
    requiredWarningCodes: ElectionWarningCodeProto[],
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  closeElection: (
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  finalizeElection: (
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  ownerPublicAddress: null,
  elections: [],
  selectedElectionId: null,
  selectedElection: null,
  ceremonyActionView: null,
  openReadiness: null,
  isLoadingList: false,
  isLoadingDetail: false,
  isLoadingCeremonyActionView: false,
  isSubmitting: false,
  feedback: null,
  error: null,
};

function buildThrownErrorFeedback(error: unknown, fallbackMessage: string): ElectionsFeedback {
  return {
    tone: 'error',
    message: error instanceof Error ? error.message : fallbackMessage,
    details: [],
  };
}

async function refreshElectionContext(
  get: () => ElectionsState,
  actorPublicAddress?: string | null
): Promise<void> {
  const electionId = get().selectedElectionId;
  if (!electionId) {
    return;
  }

  await get().loadElection(electionId);

  const resolvedActorPublicAddress = actorPublicAddress ?? get().ownerPublicAddress;
  if (resolvedActorPublicAddress) {
    await get().loadCeremonyActionView(resolvedActorPublicAddress, electionId);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForIndexedElection(
  electionId: string,
  maxAttempts: number = 12,
  delayMs: number = 500
): Promise<GetElectionResponse | null> {
  return waitForIndexedElectionMatch(electionId, () => true, maxAttempts, delayMs);
}

async function waitForIndexedElectionMatch(
  electionId: string,
  isMatch: (response: GetElectionResponse) => boolean,
  maxAttempts: number = 12,
  delayMs: number = 500
): Promise<GetElectionResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await electionsService.getElection({ ElectionId: electionId });
      if (response.Success && response.Election && isMatch(response)) {
        return response;
      }
    } catch {
      // Query surface is eventually consistent after block indexing. Retry below.
    }

    if (attempt < maxAttempts - 1) {
      await delay(delayMs);
    }
  }

  return null;
}

async function waitForIndexedCeremonyActionViewMatch(
  electionId: string,
  actorPublicAddress: string,
  isMatch: (response: GetElectionCeremonyActionViewResponse) => boolean,
  maxAttempts: number = 12,
  delayMs: number = 500
): Promise<GetElectionCeremonyActionViewResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await electionsService.getElectionCeremonyActionView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      if (response.Success && isMatch(response)) {
        return response;
      }
    } catch {
      // Query surface is eventually consistent after block indexing. Retry below.
    }

    if (attempt < maxAttempts - 1) {
      await delay(delayMs);
    }
  }

  return null;
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
      ceremonyActionView: null,
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
          ceremonyActionView: null,
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

  loadCeremonyActionView: async (actorPublicAddress, electionId) => {
    const resolvedElectionId = electionId ?? get().selectedElectionId;
    if (!resolvedElectionId) {
      set({ ceremonyActionView: null });
      return null;
    }

    set({
      isLoadingCeremonyActionView: true,
      error: null,
    });

    try {
      const response = await electionsService.getElectionCeremonyActionView({
        ElectionId: resolvedElectionId,
        ActorPublicAddress: actorPublicAddress,
      });

      if (!response.Success) {
        set({
          ceremonyActionView: response,
          error: response.ErrorMessage || 'Failed to load ceremony actions.',
        });
        return response;
      }

      set({
        ceremonyActionView: response,
      });
      return response;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to load ceremony actions.'),
      });
      return null;
    } finally {
      set({ isLoadingCeremonyActionView: false });
    }
  },

  createDraft: async (draft, snapshotReason, ownerPublicEncryptAddress, signingPrivateKeyHex) => {
    const ownerPublicAddress = get().ownerPublicAddress;
    if (!ownerPublicAddress || !ownerPublicEncryptAddress || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Owner signing or encryption credentials are missing.',
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
      const { signedTransaction, electionId } = await createElectionDraftTransaction(
        ownerPublicAddress,
        ownerPublicEncryptAddress,
        snapshotReason,
        draft,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit election draft transaction.',
            details: [],
          },
        });
        return false;
      }

      const indexedElection = await waitForIndexedElection(electionId);

      set({ selectedElectionId: electionId });
      await get().loadOwnerDashboard(ownerPublicAddress);

      if (indexedElection?.Success && indexedElection.Election) {
        await get().loadElection(electionId);
        set({
          feedback: {
            tone: 'success',
            message: 'Election draft created.',
            details: [],
          },
        });
        return true;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Election draft submitted.',
          details: [
            'The transaction was accepted and is waiting for block confirmation before the draft appears in the query view.',
          ],
        },
      });

      return false;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to create election draft.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  updateDraft: async (
    draft,
    snapshotReason,
    ownerPublicEncryptAddress,
    ownerPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (
      !electionId ||
      !ownerPublicAddress ||
      !ownerPublicEncryptAddress ||
      !ownerPrivateEncryptKeyHex ||
      !signingPrivateKeyHex
    ) {
      set({
        feedback: {
          tone: 'error',
          message: !electionId || !ownerPublicAddress
            ? 'No draft election is selected.'
            : 'Owner signing or encryption credentials are missing.',
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
      const currentRevision = get().selectedElection?.Election?.CurrentDraftRevision ?? 0;
      const { signedTransaction } = await createUpdateElectionDraftTransaction(
        electionId,
        ownerPublicAddress,
        ownerPublicEncryptAddress,
        ownerPrivateEncryptKeyHex,
        snapshotReason,
        draft,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit election draft update transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Election draft update submitted.',
          details: [
            'Waiting for block confirmation before the updated draft revision appears in the query view.',
          ],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) =>
          (response.Election?.CurrentDraftRevision ?? 0) > currentRevision
          && (response.LatestDraftSnapshot?.DraftRevision ?? 0) > currentRevision
      );

      if (!indexedElection?.Success || !indexedElection.Election) {
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

  inviteTrustee: async (
    request,
    ownerPublicEncryptAddress,
    ownerPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!ownerPublicEncryptAddress || !ownerPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Owner signing or encryption credentials are missing.',
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
      const { signedTransaction, invitationId } = await createElectionTrusteeInvitationTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        ownerPublicEncryptAddress,
        ownerPrivateEncryptKeyHex,
        request.TrusteeUserAddress,
        request.TrusteeDisplayName,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit trustee invitation transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Trustee invitation submitted.',
          details: [
            'Waiting for block confirmation before the invitation appears in the trustee roster.',
          ],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.TrusteeInvitations.some((invitation) => invitation.Id === invitationId)
      );

      if (!indexedElection?.Success || !indexedElection.Election) {
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

  acceptTrusteeInvitation: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createAcceptElectionTrusteeInvitationTransaction(
        request.ElectionId,
        request.InvitationId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit trustee acceptance transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Trustee acceptance submitted.',
          details: [
            'Waiting for block confirmation before the invitation status updates in the trustee roster.',
          ],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.TrusteeInvitations.some((invitation) =>
            invitation.Id === request.InvitationId
            && invitation.Status === ElectionTrusteeInvitationStatusProto.Accepted)
      );

      if (!indexedElection?.Success || !indexedElection.Election) {
        return false;
      }

      await get().loadElection(request.ElectionId);
      await get().loadCeremonyActionView(request.ActorPublicAddress, request.ElectionId);
      set({
        feedback: {
          tone: 'success',
          message: 'Trustee invitation accepted.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to accept trustee invitation.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  rejectTrusteeInvitation: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createRejectElectionTrusteeInvitationTransaction(
        request.ElectionId,
        request.InvitationId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit trustee rejection transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Trustee rejection submitted.',
          details: [
            'Waiting for block confirmation before the invitation status updates in the trustee roster.',
          ],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.TrusteeInvitations.some((invitation) =>
            invitation.Id === request.InvitationId
            && invitation.Status === ElectionTrusteeInvitationStatusProto.Rejected)
      );

      if (!indexedElection?.Success || !indexedElection.Election) {
        return false;
      }

      await get().loadElection(request.ElectionId);
      await get().loadCeremonyActionView(request.ActorPublicAddress, request.ElectionId);
      set({
        feedback: {
          tone: 'success',
          message: 'Trustee invitation rejected.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to reject trustee invitation.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  revokeInvitation: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Owner signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createRevokeElectionTrusteeInvitationTransaction(
        request.ElectionId,
        request.InvitationId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit trustee revocation transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Trustee revocation submitted.',
          details: [
            'Waiting for block confirmation before the trustee roster shows the revoked invitation.',
          ],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.TrusteeInvitations.some((invitation) =>
            invitation.Id === request.InvitationId
            && invitation.Status === ElectionTrusteeInvitationStatusProto.Revoked)
      );

      if (!indexedElection?.Success || !indexedElection.Election) {
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

  startGovernedProposal: async (
    actionType,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (
      !electionId ||
      !ownerPublicAddress ||
      !actorPublicEncryptAddress ||
      !actorPrivateEncryptKeyHex ||
      !signingPrivateKeyHex
    ) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction, proposalId } = await createStartElectionGovernedProposalTransaction(
        electionId,
        actionType,
        ownerPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        signingPrivateKeyHex,
      );

      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit governed proposal transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: `${getGovernedActionLabel(actionType)} proposal submitted.`,
          details: ['Waiting for block confirmation before the governed proposal appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) => {
          const proposal = response.GovernedProposals.find((candidate) => candidate.Id === proposalId);
          if (!proposal) {
            return false;
          }

          if (actionType === ElectionGovernedActionTypeProto.Close) {
            return Boolean(response.Election?.VoteAcceptanceLockedAt);
          }

          return true;
        },
      );
      if (!indexedElection) {
        return false;
      }

      await get().loadElection(electionId);
      await get().loadOwnerDashboard(ownerPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: `${getGovernedActionLabel(actionType)} proposal started.`,
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to start governed proposal.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  approveGovernedProposal: async (
    proposalId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex,
    approvalNote = ''
  ) => {
    const electionId = get().selectedElectionId;
    if (!electionId || !actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createApproveElectionGovernedProposalTransaction(
        electionId,
        proposalId,
        actorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        approvalNote,
        signingPrivateKeyHex,
      );

      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit governed approval transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Governed approval submitted.',
          details: ['Waiting for block confirmation before the approval appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) =>
          response.GovernedProposalApprovals.some((approval) =>
            approval.ProposalId === proposalId && approval.TrusteeUserAddress === actorPublicAddress),
      );
      if (!indexedElection) {
        return false;
      }

      await get().loadElection(electionId);

      const ownerPublicAddress = get().ownerPublicAddress;
      if (ownerPublicAddress) {
        await get().loadOwnerDashboard(ownerPublicAddress);
      }

      const indexedProposal = indexedElection.GovernedProposals.find(
        (candidate) => candidate.Id === proposalId
      );

      set({
        feedback: {
          tone: 'success',
          message:
            indexedProposal?.ExecutionStatus ===
            ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded
              ? 'Approval recorded and proposal executed.'
              : 'Approval recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to approve governed proposal.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  retryGovernedProposalExecution: async (
    proposalId,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (
      !electionId ||
      !ownerPublicAddress ||
      !actorPublicEncryptAddress ||
      !actorPrivateEncryptKeyHex ||
      !signingPrivateKeyHex
    ) {
      return false;
    }

    const baselineProposal = get().selectedElection?.GovernedProposals.find(
      (candidate) => candidate.Id === proposalId
    );
    const baselineAttemptKey = baselineProposal?.LastExecutionAttemptedAt
      ? `${baselineProposal.LastExecutionAttemptedAt.seconds}:${baselineProposal.LastExecutionAttemptedAt.nanos}`
      : '';

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createRetryElectionGovernedProposalExecutionTransaction(
        electionId,
        proposalId,
        ownerPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        signingPrivateKeyHex,
      );

      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit governed retry transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Governed proposal retry submitted.',
          details: ['Waiting for block confirmation before the proposal execution state updates.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) => {
          const proposal = response.GovernedProposals.find((candidate) => candidate.Id === proposalId);
          if (!proposal) {
            return false;
          }

          if (proposal.ExecutionStatus === ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded) {
            return true;
          }

          const nextAttemptKey = proposal.LastExecutionAttemptedAt
            ? `${proposal.LastExecutionAttemptedAt.seconds}:${proposal.LastExecutionAttemptedAt.nanos}`
            : '';
          return nextAttemptKey !== baselineAttemptKey;
        },
      );
      if (!indexedElection) {
        return false;
      }

      await get().loadElection(electionId);
      await get().loadOwnerDashboard(ownerPublicAddress);
      const indexedProposal = indexedElection.GovernedProposals.find(
        (candidate) => candidate.Id === proposalId
      );
      set({
        feedback: {
          tone: 'success',
          message:
            indexedProposal?.ExecutionStatus ===
            ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded
              ? 'Governed proposal execution retried.'
              : 'Governed proposal retry indexed, but execution is still failing.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to retry governed proposal execution.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  startElectionCeremony: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
          details: [],
        },
      });
      return false;
    }

    const baselineVersionNumber = Math.max(
      0,
      ...(get().selectedElection?.CeremonyVersions ?? []).map((version) => version.VersionNumber)
    );

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createStartElectionCeremonyTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.ProfileId,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit start ceremony transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony version start submitted.',
          details: ['Waiting for block confirmation before the ceremony version appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.CeremonyVersions.some((version) =>
            version.ProfileId === request.ProfileId
            && version.VersionNumber > baselineVersionNumber),
      );
      if (!indexedElection) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony version started.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to start ceremony version.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  restartElectionCeremony: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
          details: [],
        },
      });
      return false;
    }

    const baselineVersionNumber = Math.max(
      0,
      ...(get().selectedElection?.CeremonyVersions ?? []).map((version) => version.VersionNumber)
    );

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createRestartElectionCeremonyTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.ProfileId,
        request.RestartReason,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit restart ceremony transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony version restart submitted.',
          details: ['Waiting for block confirmation before the new ceremony version appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.CeremonyVersions.some((version) =>
            version.ProfileId === request.ProfileId
            && version.VersionNumber > baselineVersionNumber),
      );
      if (!indexedElection) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony version restarted.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to restart ceremony version.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  publishElectionCeremonyTransportKey: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createPublishElectionCeremonyTransportKeyTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        request.TransportPublicKeyFingerprint,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit transport key transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Transport key submission accepted.',
          details: ['Waiting for block confirmation before the trustee transport key appears in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.ActorPublicAddress,
        (response) =>
          response.SelfTrusteeState?.TransportPublicKeyFingerprint === request.TransportPublicKeyFingerprint
          && Boolean(response.SelfTrusteeState?.TransportPublicKeyPublishedAt),
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Transport key published.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to publish transport key.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  joinElectionCeremony: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createJoinElectionCeremonyTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit join ceremony transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony join submitted.',
          details: ['Waiting for block confirmation before the joined state appears in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.ActorPublicAddress,
        (response) => Boolean(response.SelfTrusteeState?.JoinedAt),
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Joined the ceremony version.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to join the ceremony version.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  recordElectionCeremonySelfTestSuccess: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createRecordElectionCeremonySelfTestSuccessTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit ceremony self-test transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony self-test submission accepted.',
          details: ['Waiting for block confirmation before the self-test state appears in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.ActorPublicAddress,
        (response) => Boolean(response.SelfTrusteeState?.SelfTestSucceededAt),
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony self-test recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to record ceremony self-test.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  submitElectionCeremonyMaterial: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createSubmitElectionCeremonyMaterialTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        request.RecipientTrusteeUserAddress,
        request.MessageType,
        request.PayloadVersion,
        request.EncryptedPayload,
        request.PayloadFingerprint,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit ceremony material transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony material submission accepted.',
          details: ['Waiting for block confirmation before the material appears in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.ActorPublicAddress,
        (response) =>
          Boolean(response.SelfTrusteeState?.MaterialSubmittedAt)
          || Boolean(response.SelfTrusteeState?.CompletedAt),
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony material submitted.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to submit ceremony material.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  recordElectionCeremonyValidationFailure: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } =
        await createRecordElectionCeremonyValidationFailureTransaction(
          request.ElectionId,
          request.ActorPublicAddress,
          actorPublicEncryptAddress,
          actorPrivateEncryptKeyHex,
          request.CeremonyVersionId,
          request.TrusteeUserAddress,
          request.ValidationFailureReason,
          request.EvidenceReference,
          signingPrivateKeyHex,
        );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit ceremony validation failure transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony validation failure submission accepted.',
          details: ['Waiting for block confirmation before the trustee validation state updates in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.ActiveCeremonyTrusteeStates.some((state) =>
            state.TrusteeUserAddress === request.TrusteeUserAddress
            && Boolean(state.ValidationFailedAt)),
      );
      if (!indexedElection) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Ceremony validation failure recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to record ceremony validation failure.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  completeElectionCeremonyTrustee: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createCompleteElectionCeremonyTrusteeTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        request.TrusteeUserAddress,
        request.ShareVersion,
        request.TallyPublicKeyFingerprint,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit ceremony completion transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Trustee ceremony completion submission accepted.',
          details: ['Waiting for block confirmation before the completed trustee state appears in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.TrusteeUserAddress,
        (response) =>
          response.SelfTrusteeState?.TrusteeUserAddress === request.TrusteeUserAddress
          && Boolean(response.SelfTrusteeState?.CompletedAt)
          && response.SelfTrusteeState?.ShareVersion === request.ShareVersion,
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.TrusteeUserAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Trustee ceremony completion recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to complete the trustee ceremony flow.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  recordElectionCeremonyShareExport: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createRecordElectionCeremonyShareExportTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        request.ShareVersion,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit share export transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Share export submission accepted.',
          details: ['Waiting for block confirmation before the share custody state updates in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.ActorPublicAddress,
        (response) =>
          response.SelfShareCustody?.ShareVersion === request.ShareVersion
          && Boolean(response.SelfShareCustody?.LastExportedAt),
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Share export recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to record share export.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  recordElectionCeremonyShareImport: async (
    request,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    if (!actorPublicEncryptAddress || !actorPrivateEncryptKeyHex || !signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Actor signing or encryption credentials are missing.',
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
      const { signedTransaction } = await createRecordElectionCeremonyShareImportTransaction(
        request.ElectionId,
        request.ActorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        request.CeremonyVersionId,
        request.ImportedElectionId,
        request.ImportedCeremonyVersionId,
        request.ImportedTrusteeUserAddress,
        request.ImportedShareVersion,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit share import transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Share import submission accepted.',
          details: ['Waiting for block confirmation before the share import state appears in the query view.'],
        },
      });

      const indexedActionView = await waitForIndexedCeremonyActionViewMatch(
        request.ElectionId,
        request.ActorPublicAddress,
        (response) => Boolean(response.SelfShareCustody?.LastImportedAt),
      );
      if (!indexedActionView) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
      set({
        feedback: {
          tone: 'success',
          message: 'Share import recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to record share import.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },

  openElection: async (
    requiredWarningCodes,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (
      !electionId ||
      !ownerPublicAddress ||
      !actorPublicEncryptAddress ||
      !actorPrivateEncryptKeyHex ||
      !signingPrivateKeyHex
    ) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createOpenElectionTransaction(
        electionId,
        ownerPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        requiredWarningCodes,
        null,
        '',
        '',
        '',
        signingPrivateKeyHex,
      );

      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit open election transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Election open submitted.',
          details: ['Waiting for block confirmation before the open boundary appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) =>
          response.Election?.LifecycleState === ElectionLifecycleStateProto.Open
          && Boolean(response.Election?.OpenArtifactId),
      );
      if (!indexedElection) {
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

  closeElection: async (
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (
      !electionId ||
      !ownerPublicAddress ||
      !actorPublicEncryptAddress ||
      !actorPrivateEncryptKeyHex ||
      !signingPrivateKeyHex
    ) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createCloseElectionTransaction(
        electionId,
        ownerPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        null,
        null,
        signingPrivateKeyHex,
      );

      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit close election transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Election close submitted.',
          details: ['Waiting for block confirmation before the close boundary appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) =>
          response.Election?.LifecycleState === ElectionLifecycleStateProto.Closed
          && Boolean(response.Election?.CloseArtifactId),
      );
      if (!indexedElection) {
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

  finalizeElection: async (
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (
      !electionId ||
      !ownerPublicAddress ||
      !actorPublicEncryptAddress ||
      !actorPrivateEncryptKeyHex ||
      !signingPrivateKeyHex
    ) {
      return false;
    }

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createFinalizeElectionTransaction(
        electionId,
        ownerPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        null,
        null,
        signingPrivateKeyHex,
      );

      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit finalize election transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Election finalize submitted.',
          details: ['Waiting for block confirmation before the finalize boundary appears in the query view.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) =>
          response.Election?.LifecycleState === ElectionLifecycleStateProto.Finalized
          && Boolean(response.Election?.FinalizeArtifactId),
      );
      if (!indexedElection) {
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

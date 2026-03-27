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
  type RestartElectionCeremonyRequest,
  type StartElectionCeremonyRequest,
  type SubmitElectionCeremonyMaterialRequest,
} from '@/lib/grpc';
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
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import { getGovernedActionLabel } from './contracts';
import {
  createApproveElectionGovernedProposalTransaction,
  createCloseElectionTransaction,
  createElectionDraftTransaction,
  createElectionTrusteeInvitationTransaction,
  createFinalizeElectionTransaction,
  createOpenElectionTransaction,
  createRevokeElectionTrusteeInvitationTransaction,
  createRetryElectionGovernedProposalExecutionTransaction,
  createStartElectionGovernedProposalTransaction,
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
  revokeInvitation: (
    request: ResolveElectionTrusteeInvitationRequest,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  loadOpenReadiness: (
    requiredWarningCodes: ElectionWarningCodeProto[]
  ) => Promise<GetElectionOpenReadinessResponse | null>;
  startGovernedProposal: (
    actionType: ElectionGovernedActionTypeProto,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  approveGovernedProposal: (
    proposalId: string,
    actorPublicAddress: string,
    signingPrivateKeyHex: string,
    approvalNote?: string
  ) => Promise<boolean>;
  retryGovernedProposalExecution: (
    proposalId: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  startElectionCeremony: (request: StartElectionCeremonyRequest) => Promise<boolean>;
  restartElectionCeremony: (request: RestartElectionCeremonyRequest) => Promise<boolean>;
  publishElectionCeremonyTransportKey: (
    request: PublishElectionCeremonyTransportKeyRequest
  ) => Promise<boolean>;
  joinElectionCeremony: (request: JoinElectionCeremonyRequest) => Promise<boolean>;
  recordElectionCeremonySelfTestSuccess: (
    request: RecordElectionCeremonySelfTestRequest
  ) => Promise<boolean>;
  submitElectionCeremonyMaterial: (
    request: SubmitElectionCeremonyMaterialRequest
  ) => Promise<boolean>;
  completeElectionCeremonyTrustee: (
    request: CompleteElectionCeremonyTrusteeRequest
  ) => Promise<boolean>;
  recordElectionCeremonyShareExport: (
    request: RecordElectionCeremonyShareExportRequest
  ) => Promise<boolean>;
  openElection: (
    requiredWarningCodes: ElectionWarningCodeProto[],
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
  closeElection: (signingPrivateKeyHex: string) => Promise<boolean>;
  finalizeElection: (signingPrivateKeyHex: string) => Promise<boolean>;
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

function getCommandCeremonyActor(
  request: { ActorPublicAddress?: string },
  fallbackActorPublicAddress: string | null,
  commandResponse: ElectionCommandResponse
): string | null {
  return request.ActorPublicAddress
    ?? commandResponse.CeremonyTrusteeState?.TrusteeUserAddress
    ?? fallbackActorPublicAddress;
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

  revokeInvitation: async (request, signingPrivateKeyHex) => {
    if (!signingPrivateKeyHex) {
      set({
        feedback: {
          tone: 'error',
          message: 'Owner signing credentials are missing.',
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

  startGovernedProposal: async (actionType, signingPrivateKeyHex) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress || !signingPrivateKeyHex) {
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
    signingPrivateKeyHex,
    approvalNote = ''
  ) => {
    const electionId = get().selectedElectionId;
    if (!electionId || !signingPrivateKeyHex) {
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

  retryGovernedProposalExecution: async (proposalId, signingPrivateKeyHex) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress || !signingPrivateKeyHex) {
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

  startElectionCeremony: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.startElectionCeremony(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
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

  restartElectionCeremony: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.restartElectionCeremony(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
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

  publishElectionCeremonyTransportKey: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.publishElectionCeremonyTransportKey(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await refreshElectionContext(
        get,
        getCommandCeremonyActor(request, get().ownerPublicAddress, response)
      );
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

  joinElectionCeremony: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.joinElectionCeremony(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await refreshElectionContext(
        get,
        getCommandCeremonyActor(request, get().ownerPublicAddress, response)
      );
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

  recordElectionCeremonySelfTestSuccess: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.recordElectionCeremonySelfTestSuccess(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await refreshElectionContext(
        get,
        getCommandCeremonyActor(request, get().ownerPublicAddress, response)
      );
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

  submitElectionCeremonyMaterial: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.submitElectionCeremonyMaterial(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await refreshElectionContext(
        get,
        getCommandCeremonyActor(request, get().ownerPublicAddress, response)
      );
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

  completeElectionCeremonyTrustee: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.completeElectionCeremonyTrustee(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await refreshElectionContext(
        get,
        getCommandCeremonyActor(request, get().ownerPublicAddress, response)
      );
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

  recordElectionCeremonyShareExport: async (request) => {
    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.recordElectionCeremonyShareExport(request);
      if (!response.Success) {
        set({ feedback: buildCommandFailureFeedback(response) });
        return false;
      }

      await refreshElectionContext(
        get,
        getCommandCeremonyActor(request, get().ownerPublicAddress, response)
      );
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

  openElection: async (requiredWarningCodes, signingPrivateKeyHex) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress || !signingPrivateKeyHex) {
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

  closeElection: async (signingPrivateKeyHex) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress || !signingPrivateKeyHex) {
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

  finalizeElection: async (signingPrivateKeyHex) => {
    const electionId = get().selectedElectionId;
    const ownerPublicAddress = get().ownerPublicAddress;

    if (!electionId || !ownerPublicAddress || !signingPrivateKeyHex) {
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

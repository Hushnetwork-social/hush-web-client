import { create } from 'zustand';
import {
  type CompleteElectionCeremonyTrusteeRequest,
  type ElectionHubEntryView,
  type ElectionReportAccessGrantView,
  ElectionFinalizationShareStatusProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  ProtocolPackageBindingStatusProto,
  ElectionTrusteeCeremonyStateProto,
  type GetElectionHubViewResponse,
  type SubmitElectionFinalizationShareRequest,
  ElectionTrusteeInvitationStatusProto,
  type GetElectionCeremonyActionViewResponse,
  type Identity,
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
  GetElectionReportAccessGrantsResponse,
  GetElectionResponse,
  InviteElectionTrusteeRequest,
  ResolveElectionTrusteeInvitationRequest,
} from '@/lib/grpc';
import { infoLog } from '@/lib/debug-logger';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import { getGovernedActionLabel } from './contracts';
import {
  createAcceptElectionTrusteeInvitationTransaction,
  createApproveElectionGovernedProposalTransaction,
  createCloseElectionTransaction,
  createCompleteElectionCeremonyTrusteeTransaction,
  createElectionDraftTransaction,
  createElectionReportAccessGrantTransaction,
  createElectionTrusteeInvitationTransaction,
  createFinalizeElectionTransaction,
  createJoinElectionCeremonyTransaction,
  createOpenElectionTransaction,
  createPublishElectionCeremonyTransportKeyTransaction,
  createRefreshProtocolPackageBindingTransaction,
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
  createSubmitElectionFinalizationShareTransaction,
  createSubmitElectionCeremonyMaterialTransaction,
  createUpdateElectionDraftTransaction,
} from './transactionService';

export type ElectionsFeedbackTone = 'success' | 'error';

export interface ElectionsFeedback {
  tone: ElectionsFeedbackTone;
  message: string;
  details: string[];
}

type LoadOwnerDashboardOptions = {
  autoSelectFirst?: boolean;
};

type LoadElectionOptions = {
  silent?: boolean;
};

type LoadCeremonyActionViewOptions = {
  silent?: boolean;
};

interface ElectionsState {
  actorPublicAddress: string | null;
  ownerPublicAddress: string | null;
  elections: ElectionSummary[];
  hubView: GetElectionHubViewResponse | null;
  hubEntries: ElectionHubEntryView[];
  selectedHubEntry: ElectionHubEntryView | null;
  reportAccessGrants: ElectionReportAccessGrantView[];
  canManageReportAccessGrants: boolean;
  reportAccessGrantDeniedReason: string;
  grantSearchResults: Identity[];
  grantSearchQuery: string;
  selectedElectionId: string | null;
  selectedElection: GetElectionResponse | null;
  ceremonyActionView: GetElectionCeremonyActionViewResponse | null;
  openReadiness: GetElectionOpenReadinessResponse | null;
  isLoadingHub: boolean;
  isLoadingReportAccessGrants: boolean;
  isLoadingList: boolean;
  isLoadingDetail: boolean;
  isLoadingCeremonyActionView: boolean;
  isSearchingGrantCandidates: boolean;
  isSubmitting: boolean;
  feedback: ElectionsFeedback | null;
  error: string | null;
  grantSearchError: string | null;
  setActorPublicAddress: (actorPublicAddress: string) => void;
  setOwnerPublicAddress: (ownerPublicAddress: string) => void;
  beginNewElection: () => void;
  clearFeedback: () => void;
  clearGrantCandidateSearch: () => void;
  loadElectionHub: (actorPublicAddress: string) => Promise<void>;
  selectHubElection: (actorPublicAddress: string, electionId: string) => Promise<void>;
  loadReportAccessGrants: (
    actorPublicAddress: string,
    electionId?: string
  ) => Promise<GetElectionReportAccessGrantsResponse | null>;
  searchGrantCandidates: (query: string) => Promise<void>;
  loadOwnerDashboard: (
    ownerPublicAddress: string,
    options?: LoadOwnerDashboardOptions
  ) => Promise<void>;
  loadElection: (electionId: string, options?: LoadElectionOptions) => Promise<void>;
  loadCeremonyActionView: (
    actorPublicAddress: string,
    electionId?: string,
    options?: LoadCeremonyActionViewOptions
  ) => Promise<GetElectionCeremonyActionViewResponse | null>;
  createReportAccessGrant: (
    designatedAuditorPublicAddress: string,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string
  ) => Promise<boolean>;
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
  refreshProtocolPackageBinding: (
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
  submitFinalizationShare: (
    request: SubmitElectionFinalizationShareRequest,
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
  actorPublicAddress: null,
  ownerPublicAddress: null,
  elections: [],
  hubView: null,
  hubEntries: [],
  selectedHubEntry: null,
  reportAccessGrants: [],
  canManageReportAccessGrants: false,
  reportAccessGrantDeniedReason: '',
  grantSearchResults: [],
  grantSearchQuery: '',
  selectedElectionId: null,
  selectedElection: null,
  ceremonyActionView: null,
  openReadiness: null,
  isLoadingHub: false,
  isLoadingReportAccessGrants: false,
  isLoadingList: false,
  isLoadingDetail: false,
  isLoadingCeremonyActionView: false,
  isSearchingGrantCandidates: false,
  isSubmitting: false,
  feedback: null,
  error: null,
  grantSearchError: null,
};

function buildThrownErrorFeedback(error: unknown, fallbackMessage: string): ElectionsFeedback {
  return {
    tone: 'error',
    message: error instanceof Error ? error.message : fallbackMessage,
    details: [],
  };
}

function getResolvedActorPublicAddress(get: () => ElectionsState): string | null {
  return get().actorPublicAddress ?? get().ownerPublicAddress;
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

async function waitForIndexedGrantListMatch(
  electionId: string,
  actorPublicAddress: string,
  isMatch: (response: GetElectionReportAccessGrantsResponse) => boolean,
  maxAttempts: number = 12,
  delayMs: number = 500
): Promise<GetElectionReportAccessGrantsResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await electionsService.getElectionReportAccessGrants({
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

  setActorPublicAddress: (actorPublicAddress) => {
    set({ actorPublicAddress });
  },

  setOwnerPublicAddress: (ownerPublicAddress) => {
    set({ ownerPublicAddress, actorPublicAddress: ownerPublicAddress });
  },

  beginNewElection: () => {
    set({
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: null,
      ceremonyActionView: null,
      openReadiness: null,
      reportAccessGrants: [],
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      feedback: null,
      error: null,
    });
  },

  clearFeedback: () => {
    set({ feedback: null, error: null });
  },

  clearGrantCandidateSearch: () => {
    set({
      grantSearchResults: [],
      grantSearchQuery: '',
      grantSearchError: null,
    });
  },

  loadElectionHub: async (actorPublicAddress) => {
    set({
      actorPublicAddress,
      isLoadingHub: true,
      feedback: null,
      error: null,
    });

    try {
      const response = await electionsService.getElectionHubView({
        ActorPublicAddress: actorPublicAddress,
      });
      const selectedElectionId = get().selectedElectionId;
      const hasExistingSelection = !!selectedElectionId
        && response.Elections.some((entry) => entry.Election.ElectionId === selectedElectionId);
      const resolvedSelection = hasExistingSelection
        ? selectedElectionId
        : response.Elections[0]?.Election.ElectionId ?? null;
      const selectedHubEntry =
        response.Elections.find((entry) => entry.Election.ElectionId === resolvedSelection) ?? null;

      set({
        hubView: response,
        hubEntries: response.Elections,
        selectedHubEntry,
        selectedElectionId: resolvedSelection,
        error: response.Success ? null : response.ErrorMessage || 'Failed to load election hub.',
      });

      if (response.Success && resolvedSelection) {
        await Promise.all([
          get().loadElection(resolvedSelection),
          get().loadReportAccessGrants(actorPublicAddress, resolvedSelection),
        ]);
      } else if (!resolvedSelection) {
        set({
          selectedElection: null,
          reportAccessGrants: [],
          canManageReportAccessGrants: false,
          reportAccessGrantDeniedReason: response.EmptyStateReason || '',
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load election hub.',
        hubView: null,
        hubEntries: [],
        selectedHubEntry: null,
      });
    } finally {
      set({ isLoadingHub: false });
    }
  },

  selectHubElection: async (actorPublicAddress, electionId) => {
    set({
      actorPublicAddress,
      selectedElectionId: electionId,
      selectedHubEntry:
        get().hubEntries.find((entry) => entry.Election.ElectionId === electionId) ?? null,
      feedback: null,
      error: null,
    });

    await Promise.all([
      get().loadElection(electionId),
      get().loadReportAccessGrants(actorPublicAddress, electionId),
    ]);
  },

  loadReportAccessGrants: async (actorPublicAddress, electionId) => {
    const resolvedElectionId = electionId ?? get().selectedElectionId;
    if (!resolvedElectionId) {
      set({
        reportAccessGrants: [],
        canManageReportAccessGrants: false,
        reportAccessGrantDeniedReason: '',
      });
      return null;
    }

    set({
      actorPublicAddress,
      isLoadingReportAccessGrants: true,
      reportAccessGrantDeniedReason: '',
    });

    try {
      const response = await electionsService.getElectionReportAccessGrants({
        ElectionId: resolvedElectionId,
        ActorPublicAddress: actorPublicAddress,
      });

      set({
        reportAccessGrants: response.Success ? response.Grants : [],
        canManageReportAccessGrants: response.Success && response.CanManageGrants,
        reportAccessGrantDeniedReason:
          response.DeniedReason || (!response.Success ? response.ErrorMessage : ''),
      });

      return response;
    } catch (error) {
      set({
        reportAccessGrants: [],
        canManageReportAccessGrants: false,
        reportAccessGrantDeniedReason: '',
        error: error instanceof Error ? error.message : 'Failed to load report access grants.',
      });
      return null;
    } finally {
      set({ isLoadingReportAccessGrants: false });
    }
  },

  searchGrantCandidates: async (query) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      set({
        grantSearchResults: [],
        grantSearchQuery: '',
        grantSearchError: null,
      });
      return;
    }

    set({
      isSearchingGrantCandidates: true,
      grantSearchQuery: query,
      grantSearchError: null,
    });

    try {
      const response = await identityService.searchByDisplayName(normalizedQuery);
      set({
        grantSearchResults: response.Identities ?? [],
      });
    } catch (error) {
      set({
        grantSearchResults: [],
        grantSearchError:
          error instanceof Error ? error.message : 'Failed to search grant candidates.',
      });
    } finally {
      set({ isSearchingGrantCandidates: false });
    }
  },

  loadOwnerDashboard: async (ownerPublicAddress, options) => {
    const autoSelectFirst = options?.autoSelectFirst ?? true;
    set({
      actorPublicAddress: ownerPublicAddress,
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
        : autoSelectFirst
          ? response.Elections[0]?.ElectionId ?? null
          : null;

      set({
        elections: response.Elections,
        selectedElectionId: resolvedSelection,
        selectedHubEntry:
          get().hubEntries.find((entry) => entry.Election.ElectionId === resolvedSelection) ?? null,
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

  loadElection: async (electionId, options) => {
    const isSilent = options?.silent ?? false;

    set({
      ...(isSilent ? {} : { isLoadingDetail: true, feedback: null, error: null }),
      selectedElectionId: electionId,
      selectedHubEntry:
        get().hubEntries.find((entry) => entry.Election.ElectionId === electionId) ?? null,
    });

    try {
      const response = await electionsService.getElection({ ElectionId: electionId });
      const openArtifactId = response.Election?.OpenArtifactId || '';
      const openArtifact =
        response.BoundaryArtifacts?.find((artifact) => artifact.Id === openArtifactId) ?? null;
      const storedProtectedTallySnapshotPresent = Boolean(openArtifact?.CeremonySnapshot);
      const boundaryArtifactCount = response.BoundaryArtifacts?.length ?? 0;

      infoLog(
        `[ElectionBoundarySummary] source=owner-workspace-load electionId=${electionId} ` +
          `detailLoadSucceeded=${response.Success} lifecycleState=${response.Election?.LifecycleState ?? 'null'} ` +
          `openArtifactId=${openArtifactId || 'null'} ` +
          `storedProtectedTallySnapshotPresent=${storedProtectedTallySnapshotPresent} ` +
          `boundaryArtifactCount=${boundaryArtifactCount}`,
      );

      infoLog('[ElectionBoundary]', {
        source: 'owner-workspace-load',
        electionId,
        detailLoadSucceeded: response.Success,
        lifecycleState: response.Election?.LifecycleState ?? null,
        openArtifactId: openArtifactId || null,
        storedProtectedTallySnapshotPresent,
        boundaryArtifactCount,
      });

      if (!response.Success) {
        set({
          selectedHubEntry:
            get().hubEntries.find((entry) => entry.Election.ElectionId === electionId) ?? null,
          selectedElection: response,
          ceremonyActionView: null,
          openReadiness: null,
          error: response.ErrorMessage || 'Failed to load election details.',
        });
        return;
      }

      set({
        selectedHubEntry:
          get().hubEntries.find((entry) => entry.Election.ElectionId === electionId) ?? null,
        selectedElection: response,
        openReadiness: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load election details.',
      });
    } finally {
      if (!isSilent) {
        set({ isLoadingDetail: false });
      }
    }
  },

  loadCeremonyActionView: async (actorPublicAddress, electionId, options) => {
    const resolvedElectionId = electionId ?? get().selectedElectionId;
    if (!resolvedElectionId) {
      set({ ceremonyActionView: null });
      return null;
    }

    const isSilent = options?.silent ?? false;

    set({
      ...(isSilent ? {} : { isLoadingCeremonyActionView: true, error: null }),
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
      if (!isSilent) {
        set({ isLoadingCeremonyActionView: false });
      }
    }
  },

  createReportAccessGrant: async (
    designatedAuditorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex
  ) => {
    const actorPublicAddress = getResolvedActorPublicAddress(get);
    const electionId = get().selectedElectionId;
    if (!actorPublicAddress || !electionId) {
      set({
        feedback: {
          tone: 'error',
          message: 'Select an election before managing designated-auditor access.',
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
      const { signedTransaction } = await createElectionReportAccessGrantTransaction(
        electionId,
        actorPublicAddress,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        designatedAuditorPublicAddress,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message:
              submitResult.message
              || 'Failed to submit designated-auditor grant transaction.',
            details: [],
          },
        });
        return false;
      }

      const indexedGrants = await waitForIndexedGrantListMatch(
        electionId,
        actorPublicAddress,
        (response) =>
          response.Grants.some(
            (grant) =>
              grant.ActorPublicAddress === designatedAuditorPublicAddress
              && grant.ElectionId === electionId
          )
      );
      if (!indexedGrants) {
        return false;
      }

      set({
        reportAccessGrants: indexedGrants.Grants,
        canManageReportAccessGrants: indexedGrants.CanManageGrants,
        reportAccessGrantDeniedReason: indexedGrants.DeniedReason,
        grantSearchResults: [],
        grantSearchQuery: '',
        grantSearchError: null,
      });

      await Promise.all([
        get().loadElectionHub(actorPublicAddress),
        get().loadElection(electionId),
      ]);

      set({
        feedback: {
          tone: 'success',
          message: 'Designated-auditor access granted.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to grant designated-auditor access.'),
      });
      return false;
    } finally {
      set({ isSubmitting: false });
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

  refreshProtocolPackageBinding: async (
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
      const { signedTransaction } = await createRefreshProtocolPackageBindingTransaction(
        electionId,
        ownerPublicAddress,
        ownerPublicEncryptAddress,
        ownerPrivateEncryptKeyHex,
        signingPrivateKeyHex
      );
      const submitResult = await submitTransaction(signedTransaction);

      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit protocol package refresh transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Protocol package refresh submitted.',
          details: [
            'Waiting for block confirmation before the latest approved package refs appear in readiness.',
          ],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        electionId,
        (response) =>
          response.ProtocolPackageBinding?.Status === ProtocolPackageBindingStatusProto.Latest
      );

      if (!indexedElection?.Success || !indexedElection.Election) {
        return false;
      }

      await get().loadElection(electionId);
      set({
        feedback: {
          tone: 'success',
          message: 'Protocol package refs refreshed.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to refresh protocol package refs.'),
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
        (response) =>
          Boolean(response.SelfTrusteeState?.SelfTestSucceededAt)
          && response.SelfTrusteeState?.State !== ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed,
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
        request.ShareVersion,
        request.CloseCountingPublicCommitment,
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
          (response.SelfTrusteeState?.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted
            && Boolean(response.SelfTrusteeState?.MaterialSubmittedAt))
          || response.SelfTrusteeState?.State === ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted
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

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          response.ActiveCeremonyTrusteeStates.some(
            (state) =>
              state.TrusteeUserAddress === request.TrusteeUserAddress
              && Boolean(state.CompletedAt)
              && state.ShareVersion === request.ShareVersion
          ),
      );
      if (!indexedElection) {
        return false;
      }

      await refreshElectionContext(get, request.ActorPublicAddress);
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

  submitFinalizationShare: async (
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

    const baselineActorShareCount = (get().selectedElection?.FinalizationShares ?? []).filter(
      (share) =>
        share.FinalizationSessionId === request.FinalizationSessionId &&
        share.TrusteeUserAddress === request.ActorPublicAddress
    ).length;

    set({
      isSubmitting: true,
      feedback: null,
      error: null,
    });

    try {
      const { signedTransaction } = await createSubmitElectionFinalizationShareTransaction(
        request,
        actorPublicEncryptAddress,
        actorPrivateEncryptKeyHex,
        signingPrivateKeyHex,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        set({
          feedback: {
            tone: 'error',
            message: submitResult.message || 'Failed to submit finalization share transaction.',
            details: [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: 'Finalization share submitted.',
          details: ['Waiting for block confirmation before the session progress refreshes.'],
        },
      });

      const indexedElection = await waitForIndexedElectionMatch(
        request.ElectionId,
        (response) =>
          (response.FinalizationShares ?? []).filter(
            (share) =>
              share.FinalizationSessionId === request.FinalizationSessionId &&
              share.TrusteeUserAddress === request.ActorPublicAddress
          ).length > baselineActorShareCount,
      );
      if (!indexedElection) {
        return false;
      }

      await get().loadElection(request.ElectionId);
      const ownerPublicAddress = get().ownerPublicAddress;
      if (ownerPublicAddress) {
        await get().loadOwnerDashboard(ownerPublicAddress);
      }

      const latestShare = (indexedElection.FinalizationShares ?? [])
        .filter(
          (share) =>
            share.FinalizationSessionId === request.FinalizationSessionId &&
            share.TrusteeUserAddress === request.ActorPublicAddress
        )
        .sort(
          (left, right) =>
            ((right.SubmittedAt?.seconds ?? 0) * 1000 + Math.floor((right.SubmittedAt?.nanos ?? 0) / 1_000_000)) -
            ((left.SubmittedAt?.seconds ?? 0) * 1000 + Math.floor((left.SubmittedAt?.nanos ?? 0) / 1_000_000))
        )[0];
      const releaseEvidence = (indexedElection.FinalizationReleaseEvidenceRecords ?? []).find(
        (record) => record.FinalizationSessionId === request.FinalizationSessionId
      );

      if (latestShare?.Status === ElectionFinalizationShareStatusProto.FinalizationShareRejected) {
        set({
          feedback: {
            tone: 'error',
            message: latestShare.FailureReason || 'Finalization share was rejected.',
            details: latestShare.FailureCode ? [latestShare.FailureCode] : [],
          },
        });
        return false;
      }

      set({
        feedback: {
          tone: 'success',
          message: releaseEvidence
            ? 'Finalization share recorded and aggregate release completed.'
            : 'Finalization share recorded.',
          details: [],
        },
      });
      return true;
    } catch (error) {
      set({
        feedback: buildThrownErrorFeedback(error, 'Failed to submit the finalization share.'),
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

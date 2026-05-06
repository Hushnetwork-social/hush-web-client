import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ElectionFinalizationReleaseEvidence,
  ElectionFinalizationSession,
  ElectionFinalizationShare,
  ElectionCeremonyTrusteeState,
  ElectionCommandResponse,
  ElectionDraftInput,
  ElectionDraftSnapshot,
  ElectionProtocolPackageBindingView,
  ElectionRecordView,
  ElectionSummary,
  GetElectionCeremonyActionViewResponse,
  GetElectionOpenReadinessResponse,
  GetElectionResponse,
} from "@/lib/grpc";
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionFinalizationReleaseModeProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationTargetTypeProto,
  ElectionGovernanceModeProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  ElectionTrusteeInvitationStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ProtocolPackageAccessLocationKindProto,
  ProtocolPackageApprovalStatusProto,
  ProtocolPackageBindingSourceProto,
  ProtocolPackageBindingStatusProto,
  ProtocolPackageExternalReviewStatusProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from "@/lib/grpc";
import { useBlockchainStore } from "@/modules/blockchain";
import { ElectionsWorkspace } from "./ElectionsWorkspace";
import { createDefaultElectionDraft, normalizeElectionDraft } from "./contracts";
import { useElectionsStore } from "./useElectionsStore";

const {
  electionsServiceMock,
  blockchainServiceMock,
  transactionServiceMock,
  identityServiceMock,
} = vi.hoisted(() => ({
    electionsServiceMock: {
      approveElectionGovernedProposal: vi.fn(),
      closeElection: vi.fn(),
      createElectionDraft: vi.fn(),
      finalizeElection: vi.fn(),
      getElection: vi.fn(),
      getElectionCeremonyActionView: vi.fn(),
      getElectionOpenReadiness: vi.fn(),
      getElectionReportAccessGrants: vi.fn(),
      getElectionsByOwner: vi.fn(),
      inviteElectionTrustee: vi.fn(),
      openElection: vi.fn(),
      restartElectionCeremony: vi.fn(),
      revokeElectionTrusteeInvitation: vi.fn(),
      retryElectionGovernedProposalExecution: vi.fn(),
      startElectionCeremony: vi.fn(),
      startElectionGovernedProposal: vi.fn(),
      updateElectionDraft: vi.fn(),
    },
    blockchainServiceMock: {
      submitTransaction: vi.fn(),
    },
    transactionServiceMock: {
      createApproveElectionGovernedProposalTransaction: vi.fn(),
      createCloseElectionTransaction: vi.fn(),
      createElectionDraftTransaction: vi.fn(),
      createElectionReportAccessGrantTransaction: vi.fn(),
      createElectionTrusteeInvitationTransaction: vi.fn(),
      createFinalizeElectionTransaction: vi.fn(),
      createOpenElectionTransaction: vi.fn(),
      createRevokeElectionTrusteeInvitationTransaction: vi.fn(),
      createRestartElectionCeremonyTransaction: vi.fn(),
      createRetryElectionGovernedProposalExecutionTransaction: vi.fn(),
      createRefreshProtocolPackageBindingTransaction: vi.fn(),
      createStartElectionCeremonyTransaction: vi.fn(),
      createStartElectionGovernedProposalTransaction: vi.fn(),
      createSubmitElectionFinalizationShareTransaction: vi.fn(),
      createUpdateElectionDraftTransaction: vi.fn(),
    },
    identityServiceMock: {
      getIdentity: vi.fn(),
      searchByDisplayName: vi.fn(),
    },
  }));

vi.mock("@/lib/grpc/services/elections", () => ({
  electionsService: electionsServiceMock,
}));

vi.mock("@/modules/blockchain/BlockchainService", () => ({
  submitTransaction: (...args: unknown[]) =>
    blockchainServiceMock.submitTransaction(...args),
}));

vi.mock("@/lib/grpc/services/identity", () => ({
  identityService: identityServiceMock,
}));

vi.mock("./transactionService", () => ({
  createApproveElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createApproveElectionGovernedProposalTransaction(
      ...args,
    ),
  createCloseElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createCloseElectionTransaction(...args),
  createElectionDraftTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionDraftTransaction(...args),
  createElectionReportAccessGrantTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionReportAccessGrantTransaction(...args),
  createElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionTrusteeInvitationTransaction(...args),
  createFinalizeElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createFinalizeElectionTransaction(...args),
  createOpenElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createOpenElectionTransaction(...args),
  createRevokeElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction(
      ...args,
    ),
  createRestartElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRestartElectionCeremonyTransaction(...args),
  createRetryElectionGovernedProposalExecutionTransaction: (
    ...args: unknown[]
  ) =>
    transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction(
      ...args,
    ),
  createRefreshProtocolPackageBindingTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRefreshProtocolPackageBindingTransaction(
      ...args,
    ),
  createStartElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createStartElectionCeremonyTransaction(...args),
  createStartElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createStartElectionGovernedProposalTransaction(
      ...args,
    ),
  createSubmitElectionFinalizationShareTransaction: (...args: unknown[]) =>
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction(
      ...args,
    ),
  createUpdateElectionDraftTransaction: (...args: unknown[]) =>
    transactionServiceMock.createUpdateElectionDraftTransaction(...args),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createProtocolPackageBinding(
  overrides?: Partial<ElectionProtocolPackageBindingView>,
): ElectionProtocolPackageBindingView {
  return {
    Id: "protocol-package-binding-1",
    ElectionId: "election-1",
    PackageId: "omega-hushvoting-v1",
    PackageVersion: "v1.0.0",
    SelectedProfileId: "dkg-prod-3of5",
    SpecPackageHash: "a".repeat(64),
    ProofPackageHash: "b".repeat(64),
    ReleaseManifestHash: "c".repeat(64),
    SpecAccessLocations: [
      {
        LocationKind: ProtocolPackageAccessLocationKindProto.PublicWebsite,
        Label: "Public spec package",
        Location:
          "https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/spec.zip",
        ContentHash: "a".repeat(64),
      },
    ],
    ProofAccessLocations: [
      {
        LocationKind: ProtocolPackageAccessLocationKindProto.PublicWebsite,
        Label: "Public proof package",
        Location:
          "https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/proof.zip",
        ContentHash: "b".repeat(64),
      },
    ],
    PackageApprovalStatus: ProtocolPackageApprovalStatusProto.ApprovedInternal,
    Status: ProtocolPackageBindingStatusProto.Latest,
    Source: ProtocolPackageBindingSourceProto.CatalogSelection,
    DraftRevision: 1,
    BoundAt: timestamp,
    HasSealedAt: false,
    BoundByPublicAddress: "owner-public-key",
    ExternalReviewStatus: ProtocolPackageExternalReviewStatusProto.NotReviewed,
    SourceTransactionId: "",
    SourceBlockHeight: 0,
    SourceBlockId: "",
    ...overrides,
  };
}

function createDraftInput(
  overrides?: Partial<ElectionDraftInput>,
): ElectionDraftInput {
  return normalizeElectionDraft({
    ...createDefaultElectionDraft(),
    Title: "Board Election",
    ExternalReferenceCode: "ORG-2026-01",
    OwnerOptions: [
      {
        OptionId: "option-a",
        DisplayLabel: "Alice",
        ShortDescription: "First option",
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: "option-b",
        DisplayLabel: "Bob",
        ShortDescription: "Second option",
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
    ...overrides,
  });
}

function createElectionRecord(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionRecordView>,
): ElectionRecordView {
  const draft = createDraftInput({
    BindingStatus:
      overrides?.BindingStatus ?? ElectionBindingStatusProto.Binding,
    GovernanceMode:
      overrides?.GovernanceMode ?? ElectionGovernanceModeProto.AdminOnly,
    SelectedProfileId: overrides?.SelectedProfileId ?? "",
  });

  return {
    ElectionId: "election-1",
    Title: draft.Title,
    ShortDescription: draft.ShortDescription,
    OwnerPublicAddress: "owner-public-key",
    ExternalReferenceCode: draft.ExternalReferenceCode,
    LifecycleState: lifecycleState,
    ElectionClass: draft.ElectionClass,
    BindingStatus: draft.BindingStatus,
    SelectedProfileId: draft.SelectedProfileId,
    SelectedProfileDevOnly: draft.SelectedProfileId.includes("-dev-"),
    GovernanceMode: draft.GovernanceMode,
    DisclosureMode: draft.DisclosureMode,
    ParticipationPrivacyMode: draft.ParticipationPrivacyMode,
    VoteUpdatePolicy: draft.VoteUpdatePolicy,
    EligibilitySourceType: draft.EligibilitySourceType,
    EligibilityMutationPolicy: draft.EligibilityMutationPolicy,
    OutcomeRule: draft.OutcomeRule,
    ApprovedClientApplications: draft.ApprovedClientApplications,
    ProtocolOmegaVersion: draft.ProtocolOmegaVersion,
    ReportingPolicy: draft.ReportingPolicy,
    ReviewWindowPolicy: draft.ReviewWindowPolicy,
    CurrentDraftRevision: 1,
    Options: draft.OwnerOptions,
    AcknowledgedWarningCodes: draft.AcknowledgedWarningCodes,
    RequiredApprovalCount: draft.RequiredApprovalCount,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt:
      lifecycleState >= ElectionLifecycleStateProto.Open
        ? timestamp
        : undefined,
    ClosedAt:
      lifecycleState >= ElectionLifecycleStateProto.Closed
        ? timestamp
        : undefined,
    FinalizedAt:
      lifecycleState >= ElectionLifecycleStateProto.Finalized
        ? timestamp
        : undefined,
    OpenArtifactId:
      lifecycleState >= ElectionLifecycleStateProto.Open ? "open-artifact" : "",
    CloseArtifactId:
      lifecycleState >= ElectionLifecycleStateProto.Closed
        ? "close-artifact"
        : "",
    FinalizeArtifactId:
      lifecycleState >= ElectionLifecycleStateProto.Finalized
        ? "finalize-artifact"
        : "",
    ...overrides,
  };
}

function createElectionSummary(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionSummary>,
): ElectionSummary {
  return {
    ElectionId: "election-1",
    Title: "Board Election",
    OwnerPublicAddress: "owner-public-key",
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 1,
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createDraftSnapshot(
  overrides?: Partial<ElectionDraftSnapshot>,
): ElectionDraftSnapshot {
  const policyOverrides = overrides?.Policy;
  const draft = createDraftInput({
    BindingStatus:
      policyOverrides?.BindingStatus ?? ElectionBindingStatusProto.Binding,
    GovernanceMode:
      policyOverrides?.GovernanceMode ?? ElectionGovernanceModeProto.AdminOnly,
    SelectedProfileId: policyOverrides?.SelectedProfileId ?? "",
    RequiredApprovalCount: policyOverrides?.RequiredApprovalCount,
  });

  return {
    Id: "snapshot-1",
    ElectionId: "election-1",
    DraftRevision: 1,
    Metadata: {
      Title: draft.Title,
      ShortDescription: draft.ShortDescription,
      OwnerPublicAddress: "owner-public-key",
      ExternalReferenceCode: draft.ExternalReferenceCode,
    },
    Policy: {
      ElectionClass: draft.ElectionClass,
      BindingStatus: draft.BindingStatus,
      SelectedProfileId: draft.SelectedProfileId,
      SelectedProfileDevOnly: draft.SelectedProfileId.includes("-dev-"),
      GovernanceMode: draft.GovernanceMode,
      DisclosureMode: draft.DisclosureMode,
      ParticipationPrivacyMode: draft.ParticipationPrivacyMode,
      VoteUpdatePolicy: draft.VoteUpdatePolicy,
      EligibilitySourceType: draft.EligibilitySourceType,
      EligibilityMutationPolicy: draft.EligibilityMutationPolicy,
      OutcomeRule: draft.OutcomeRule,
      ApprovedClientApplications: draft.ApprovedClientApplications,
      ProtocolOmegaVersion: draft.ProtocolOmegaVersion,
      ReportingPolicy: draft.ReportingPolicy,
      ReviewWindowPolicy: draft.ReviewWindowPolicy,
      ControlDomainProfileId: policyOverrides?.ControlDomainProfileId,
      ControlDomainProfileVersion: policyOverrides?.ControlDomainProfileVersion,
      ThresholdProfileId: policyOverrides?.ThresholdProfileId,
      RequiredApprovalCount: draft.RequiredApprovalCount,
    },
    Options: draft.OwnerOptions,
    AcknowledgedWarningCodes: draft.AcknowledgedWarningCodes,
    SnapshotReason: "Initial draft",
    RecordedAt: timestamp,
    RecordedByPublicAddress: "owner-public-key",
    ...overrides,
  };
}

function createElectionResponse(
  overrides?: Partial<GetElectionResponse>,
): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: "",
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
    LatestDraftSnapshot: createDraftSnapshot(),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

function createCeremonyActionViewResponse(
  overrides?: Partial<GetElectionCeremonyActionViewResponse>,
): GetElectionCeremonyActionViewResponse {
  return {
    Success: true,
    ErrorMessage: "",
    ActorRole: ElectionCeremonyActorRoleProto.CeremonyActorOwner,
    ActorPublicAddress: "owner-public-key",
    OwnerActions: [
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionStartVersion,
        IsAvailable: true,
        IsCompleted: false,
        Reason: "Start the first ceremony version.",
      },
      {
        ActionType:
          ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion,
        IsAvailable: false,
        IsCompleted: false,
        Reason: "No active version exists yet.",
      },
    ],
    TrusteeActions: [],
    PendingIncomingMessageCount: 0,
    BlockedReasons: [],
    ...overrides,
  };
}

function createCeremonyTrusteeState(
  overrides?: Partial<ElectionCeremonyTrusteeState>,
): ElectionCeremonyTrusteeState {
  return {
    Id: "ceremony-state-1",
    ElectionId: "election-1",
    CeremonyVersionId: "ceremony-version-1",
    TrusteeUserAddress: "trustee-a",
    TrusteeDisplayName: "Alice Trustee",
    State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
    TransportPublicKeyFingerprint: "transport-fingerprint-1",
    LastUpdatedAt: timestamp,
    ShareVersion: "",
    ValidationFailureReason: "",
    ...overrides,
  };
}

function createCommandResponse(
  overrides?: Partial<ElectionCommandResponse>,
): ElectionCommandResponse {
  return {
    Success: true,
    ErrorCode: 0,
    ErrorMessage: "",
    ValidationErrors: [],
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
    CeremonyTranscriptEvents: [],
    ...overrides,
  };
}

function createFinalizationSession(
  overrides?: Partial<ElectionFinalizationSession>,
): ElectionFinalizationSession {
  return {
    Id: "finalization-session-1",
    ElectionId: "election-1",
    GovernedProposalId: "proposal-finalize-1",
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    SessionPurpose:
      ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize,
    CloseArtifactId: "close-artifact",
    AcceptedBallotSetHash: "accepted-ballot-set-hash",
    FinalEncryptedTallyHash: "final-encrypted-tally-hash",
    TargetTallyId: "aggregate-tally-1",
    CeremonySnapshot: {
      CeremonyVersionId: "ceremony-version-1",
      VersionNumber: 1,
      ProfileId: "dkg-prod-3of5",
      TrusteeCount: 3,
      RequiredApprovalCount: 2,
      CompletedTrustees: [
        {
          TrusteeUserAddress: "trustee-a",
          TrusteeDisplayName: "Alice Trustee",
        },
        {
          TrusteeUserAddress: "trustee-b",
          TrusteeDisplayName: "Bob Trustee",
        },
      ],
      TallyPublicKeyFingerprint: "tally-fingerprint-1",
    },
    RequiredShareCount: 2,
    EligibleTrustees: [
      {
        TrusteeUserAddress: "trustee-a",
        TrusteeDisplayName: "Alice Trustee",
      },
      {
        TrusteeUserAddress: "trustee-b",
        TrusteeDisplayName: "Bob Trustee",
      },
    ],
    Status:
      ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
    CreatedAt: timestamp,
    CreatedByPublicAddress: "owner-public-key",
    CompletedAt: undefined,
    ReleaseEvidenceId: "",
    LatestTransactionId: "transaction-1",
    LatestBlockHeight: 10,
    LatestBlockId: "block-1",
    ...overrides,
  };
}

function createFinalizationShare(
  overrides?: Partial<ElectionFinalizationShare>,
): ElectionFinalizationShare {
  return {
    Id: "finalization-share-1",
    FinalizationSessionId: "finalization-session-1",
    ElectionId: "election-1",
    TrusteeUserAddress: "trustee-a",
    TrusteeDisplayName: "Alice Trustee",
    SubmittedByPublicAddress: "trustee-a",
    ShareIndex: 1,
    ShareVersion: "share-v1",
    TargetType:
      ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
    ClaimedCloseArtifactId: "close-artifact",
    ClaimedAcceptedBallotSetHash: "accepted-ballot-set-hash",
    ClaimedFinalEncryptedTallyHash: "final-encrypted-tally-hash",
    ClaimedTargetTallyId: "aggregate-tally-1",
    ClaimedCeremonyVersionId: "ceremony-version-1",
    ClaimedTallyPublicKeyFingerprint: "tally-fingerprint-1",
    Status: ElectionFinalizationShareStatusProto.FinalizationShareAccepted,
    FailureCode: "",
    FailureReason: "",
    SubmittedAt: timestamp,
    SourceTransactionId: "transaction-2",
    SourceBlockHeight: 11,
    SourceBlockId: "block-2",
    ...overrides,
  };
}

function createFinalizationReleaseEvidence(
  overrides?: Partial<ElectionFinalizationReleaseEvidence>,
): ElectionFinalizationReleaseEvidence {
  return {
    Id: "release-evidence-1",
    FinalizationSessionId: "finalization-session-1",
    ElectionId: "election-1",
    SessionPurpose:
      ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize,
    ReleaseMode:
      ElectionFinalizationReleaseModeProto.FinalizationReleaseAggregateTallyOnly,
    CloseArtifactId: "close-artifact",
    AcceptedBallotSetHash: "accepted-ballot-set-hash",
    FinalEncryptedTallyHash: "final-encrypted-tally-hash",
    TargetTallyId: "aggregate-tally-1",
    AcceptedShareCount: 2,
    AcceptedTrustees: [
      {
        TrusteeUserAddress: "trustee-a",
        TrusteeDisplayName: "Alice Trustee",
      },
      {
        TrusteeUserAddress: "trustee-b",
        TrusteeDisplayName: "Bob Trustee",
      },
    ],
    CompletedAt: timestamp,
    CompletedByPublicAddress: "owner-public-key",
    SourceTransactionId: "transaction-3",
    SourceBlockHeight: 12,
    SourceBlockId: "block-3",
    ...overrides,
  };
}

function createReadinessResponse(
  overrides?: Partial<GetElectionOpenReadinessResponse>,
): GetElectionOpenReadinessResponse {
  return {
    IsReadyToOpen: true,
    ValidationErrors: [],
    RequiredWarningCodes: [],
    MissingWarningAcknowledgements: [],
    ProtocolPackageBindingStatus: ProtocolPackageBindingStatusProto.Latest,
    ProtocolPackageBindingMessage: "",
    ...overrides,
  };
}

function createAcceptedTrusteeInvitations() {
  return ["a", "b", "c", "d", "e"].map((suffix) => ({
    Id: `invite-${suffix}`,
    ElectionId: "election-1",
    TrusteeUserAddress: `trustee-${suffix}`,
    TrusteeDisplayName: `Trustee ${suffix.toUpperCase()}`,
    InvitedByPublicAddress: "owner-public-key",
    LinkedMessageId: `message-${suffix}`,
    Status: ElectionTrusteeInvitationStatusProto.Accepted,
    SentAtDraftRevision: 1,
    SentAt: timestamp,
  }));
}

async function openOwnerDetailTab(tabId: string) {
  fireEvent.click(await screen.findByTestId(`elections-detail-tab-${tabId}`));
}

describe("ElectionsWorkspace", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    useBlockchainStore.getState().reset();
    useElectionsStore.getState().reset();
    vi.resetAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    electionsServiceMock.getElectionsByOwner.mockResolvedValue({
      Elections: [],
    });
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse(),
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );
    electionsServiceMock.getElectionOpenReadiness.mockResolvedValue(
      createReadinessResponse(),
    );
    electionsServiceMock.getElectionReportAccessGrants.mockResolvedValue({
      Success: true,
      ErrorMessage: "",
      Grants: [],
      CanManageGrants: true,
      DeniedReason: "",
    });
    electionsServiceMock.createElectionDraft.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.updateElectionDraft.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.revokeElectionTrusteeInvitation.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.startElectionGovernedProposal.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.approveElectionGovernedProposal.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.retryElectionGovernedProposalExecution.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.openElection.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.closeElection.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.finalizeElection.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.startElectionCeremony.mockResolvedValue(
      createCommandResponse(),
    );
    electionsServiceMock.restartElectionCeremony.mockResolvedValue(
      createCommandResponse(),
    );
    identityServiceMock.getIdentity.mockResolvedValue({
      Successfull: false,
      Message: "",
      ProfileName: "",
      PublicSigningAddress: "",
      PublicEncryptAddress: "",
      IsPublic: false,
    });
    identityServiceMock.searchByDisplayName.mockResolvedValue({
      Identities: [],
    });
    blockchainServiceMock.submitTransaction.mockResolvedValue({
      successful: true,
      message: "Accepted",
    });
    transactionServiceMock.createElectionDraftTransaction.mockResolvedValue({
      signedTransaction: "signed-election-transaction",
      electionId: "election-1",
    });
    transactionServiceMock.createElectionReportAccessGrantTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-grant-transaction",
      },
    );
    transactionServiceMock.createStartElectionGovernedProposalTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-start-governed-proposal-transaction",
        proposalId: "proposal-1",
      },
    );
    transactionServiceMock.createApproveElectionGovernedProposalTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-approve-governed-proposal-transaction",
      },
    );
    transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-retry-governed-proposal-transaction",
      },
    );
    transactionServiceMock.createRefreshProtocolPackageBindingTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-refresh-protocol-package-transaction",
      },
    );
    transactionServiceMock.createOpenElectionTransaction.mockResolvedValue({
      signedTransaction: "signed-open-election-transaction",
    });
    transactionServiceMock.createCloseElectionTransaction.mockResolvedValue({
      signedTransaction: "signed-close-election-transaction",
    });
    transactionServiceMock.createFinalizeElectionTransaction.mockResolvedValue({
      signedTransaction: "signed-finalize-election-transaction",
    });
    transactionServiceMock.createElectionTrusteeInvitationTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-trustee-invite-transaction",
        invitationId: "invite-1",
      },
    );
    transactionServiceMock.createUpdateElectionDraftTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-draft-update-transaction",
      },
    );
    transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-trustee-revoke-transaction",
      },
    );
    transactionServiceMock.createStartElectionCeremonyTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-start-election-ceremony-transaction",
      },
    );
    transactionServiceMock.createRestartElectionCeremonyTransaction.mockResolvedValue(
      {
        signedTransaction: "signed-restart-election-ceremony-transaction",
      },
    );
  });

  it("separates the saved election list from the current draft save panel", async () => {
    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    expect(await screen.findByText("Saved Elections")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Select one to continue editing it, or start a brand-new election draft below\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Start new election draft")).toBeInTheDocument();

    expect(screen.getByText("Save Current Draft")).toBeInTheDocument();
    expect(
      screen.getByText(
        /This panel applies only to the election selected on the left\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Latest saved revision")).toBeInTheDocument();
    expect(screen.getByText("Local working copy")).toBeInTheDocument();
    expect(screen.getByText("Revision note")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Election Draft" }),
    ).toBeInTheDocument();
  });

  it("scopes the owner workspace to the requested election when opened from the hub", async () => {
    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          ElectionId: "election-1",
          Title: "AdminOnly Election I",
        }),
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          ElectionId: "election-2",
          Title: "Election with Trustees I",
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: createElectionRecord(ElectionLifecycleStateProto.Draft, {
          ElectionId: "election-2",
          Title: "Election with Trustees I",
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
        initialElectionId="election-2"
      />,
    );

    expect(await screen.findByText("Current Election")).toBeInTheDocument();
    expect(screen.getByTestId("election-summary-election-2")).toBeInTheDocument();
    expect(screen.queryByTestId("election-summary-election-1")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /This workspace stays focused on the election you opened from the hub\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Start new election draft")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New Election Draft" }),
    ).not.toBeInTheDocument();
  });

  it("creates a valid draft and shows save feedback", async () => {
    const createdRecord = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
    );
    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({ Elections: [] })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      });
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createdRecord,
        LatestDraftSnapshot: createDraftSnapshot(),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByTestId("elections-title-input"), {
      target: { value: "Board Election" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply metadata changes" }),
    );

    fireEvent.click(screen.getByTestId("elections-detail-tab-options"));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit ballot options" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    fireEvent.change(screen.getByTestId("elections-option-label-0"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByTestId("elections-option-label-1"), {
      target: { value: "Bob" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply option changes" }),
    );

    fireEvent.click(screen.getByTestId("elections-detail-tab-save"));
    fireEvent.click(screen.getByTestId("elections-save-button"));

    expect(
      await screen.findByText("Election draft created."),
    ).toBeInTheDocument();
    expect(
      transactionServiceMock.createElectionDraftTransaction,
    ).toHaveBeenCalledWith(
      "owner-public-key",
      "owner-encryption-key",
      "Initial draft",
      expect.objectContaining({
        Title: "Board Election",
      }),
      "owner-private-key",
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-election-transaction",
    );
    expect(electionsServiceMock.createElectionDraft).not.toHaveBeenCalled();
  });

  it("allows creating the first draft with metadata only", async () => {
    const createdRecord = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        Title: "Board Election",
        ExternalReferenceCode: "",
        ShortDescription: "",
      },
    );

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({ Elections: [] })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      });
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createdRecord,
        LatestDraftSnapshot: createDraftSnapshot({
          Metadata: {
            Title: "Board Election",
            ShortDescription: "",
            OwnerPublicAddress: "owner-public-key",
            ExternalReferenceCode: "",
          },
          Options: [],
        }),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
        startInNewDraftMode={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByTestId("elections-title-input"), {
      target: { value: "Board Election" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply metadata changes" }),
    );

    expect(screen.getByTestId("elections-save-button")).toBeEnabled();
    fireEvent.click(screen.getByTestId("elections-save-button"));

    expect(
      await screen.findByText("Election draft created."),
    ).toBeInTheDocument();
    expect(
      transactionServiceMock.createElectionDraftTransaction,
    ).toHaveBeenCalledWith(
      "owner-public-key",
      "owner-encryption-key",
      "Initial draft",
      expect.objectContaining({
        Title: "Board Election",
        OwnerOptions: [],
      }),
      "owner-private-key",
    );
  });

  it(
    "shows pending feedback when the draft transaction is accepted before indexing finishes",
    async () => {
    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({ Elections: [] })
      .mockResolvedValueOnce({ Elections: [] });
    electionsServiceMock.getElection.mockResolvedValue({
      Success: false,
      ErrorMessage: "not indexed yet",
      Election: undefined,
      LatestDraftSnapshot: undefined,
      WarningAcknowledgements: [],
      TrusteeInvitations: [],
      BoundaryArtifacts: [],
      GovernedProposals: [],
      GovernedProposalApprovals: [],
      CeremonyProfiles: [],
      CeremonyVersions: [],
      CeremonyTranscriptEvents: [],
      ActiveCeremonyTrusteeStates: [],
    });

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByTestId("elections-title-input"), {
      target: { value: "Board Election" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply metadata changes" }),
    );

    await openOwnerDetailTab("options");
    fireEvent.click(
      screen.getByRole("button", { name: "Edit ballot options" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    fireEvent.change(screen.getByTestId("elections-option-label-0"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByTestId("elections-option-label-1"), {
      target: { value: "Bob" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply option changes" }),
    );

      fireEvent.click(screen.getByTestId("elections-detail-tab-save"));
      fireEvent.click(screen.getByTestId("elections-save-button"));

      expect(
        await screen.findByText("Election draft submitted.", {}, { timeout: 8_000 }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/waiting for block confirmation/i, {}, { timeout: 8_000 }),
      ).toBeInTheDocument();
    },
    12_000,
  );

  it("starts a new draft without pre-seeded ballot options", async () => {
    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("options");
    expect(
      await screen.findByTestId("elections-empty-options"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("elections-option-label-0"),
    ).not.toBeInTheDocument();
  });

  it("marks the save tab as unsaved and warns before leaving a dirty draft", async () => {
    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          ElectionId: "election-1",
          Title: "Board Election I",
        }),
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          ElectionId: "election-2",
          Title: "Board Election II",
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: createElectionRecord(ElectionLifecycleStateProto.Draft, {
          ElectionId: "election-1",
          Title: "Board Election I",
        }),
      }),
    );

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByTestId("elections-title-input"), {
      target: { value: "Board Election I Updated" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply metadata changes" }),
    );

    expect(
      await screen.findByTestId("elections-dirty-draft-banner"),
    ).toHaveTextContent("Unsaved local edits");
    expect(screen.getByTestId("elections-detail-tab-save")).toHaveTextContent(
      "Unsaved",
    );

    fireEvent.click(
      screen.getByRole("link", { name: "Back to HushVoting! Hub" }),
    );
    fireEvent.click(screen.getByTestId("election-summary-election-2"));

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("unsaved local edits"),
    );
    expect(electionsServiceMock.getElection).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Board Election I Updated").length).toBeGreaterThan(
      0,
    );
  });

  it("keeps the workspace on a blank new draft when opened in create mode", async () => {
    electionsServiceMock.getElectionsByOwner.mockResolvedValue({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          Title: "Annual Elections 2026",
        }),
      ],
    });

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
        startInNewDraftMode={true}
      />,
    );

    expect(await screen.findByText("Create Election Draft")).toBeInTheDocument();
    expect(screen.getByText("New Election Draft")).toBeInTheDocument();
    expect(screen.getByText("Creation mode")).toBeInTheDocument();
    expect(screen.getByText("Required before save")).toBeInTheDocument();
    expect(
      screen.getAllByText("Election title is required.").length,
    ).toBeGreaterThan(0);
    await openOwnerDetailTab("options");
    expect(
      screen.getByText(
        /You can still save this draft now and add options later/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByText("Annual Elections 2026")).not.toBeInTheDocument();
    expect(
      screen.queryByText("At least one owner-managed option is required."),
    ).not.toBeInTheDocument();
    expect(electionsServiceMock.getElection).not.toHaveBeenCalled();
  });

  it("updates an existing draft through blockchain submission and waits for the next revision", async () => {
    const baselineElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        Title: "Board Election",
        CurrentDraftRevision: 1,
      },
    );
    const updatedElection = {
      ...baselineElection,
      Title: "Board Election Final",
      CurrentDraftRevision: 2,
    };

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      })
      .mockResolvedValue({
        Elections: [
          createElectionSummary(ElectionLifecycleStateProto.Draft, {
            CurrentDraftRevision: 2,
          }),
        ],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: baselineElection,
          LatestDraftSnapshot: createDraftSnapshot({
            DraftRevision: 1,
            SnapshotReason: "Initial draft",
            Metadata: {
              Title: "Board Election",
              ShortDescription: baselineElection.ShortDescription,
              OwnerPublicAddress: "owner-public-key",
              ExternalReferenceCode: baselineElection.ExternalReferenceCode,
            },
          }),
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: updatedElection,
          LatestDraftSnapshot: createDraftSnapshot({
            DraftRevision: 2,
            SnapshotReason: "Owner draft update",
            Metadata: {
              Title: "Board Election Final",
              ShortDescription: updatedElection.ShortDescription,
              OwnerPublicAddress: "owner-public-key",
              ExternalReferenceCode: updatedElection.ExternalReferenceCode,
            },
          }),
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: updatedElection,
          LatestDraftSnapshot: createDraftSnapshot({
            DraftRevision: 2,
            SnapshotReason: "Owner draft update",
            Metadata: {
              Title: "Board Election Final",
              ShortDescription: updatedElection.ShortDescription,
              OwnerPublicAddress: "owner-public-key",
              ExternalReferenceCode: updatedElection.ExternalReferenceCode,
            },
          }),
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit metadata" }),
    );
    expect(await screen.findByTestId("elections-title-input")).toHaveValue(
      "Board Election",
    );
    expect(
      screen.queryByTestId("election-eligibility-workspace"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Voters / Eligibility")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("elections-title-input"), {
      target: { value: "Board Election Final" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply metadata changes" }),
    );
    fireEvent.click(screen.getByTestId("elections-save-button"));

    await waitFor(() => {
      expect(
        transactionServiceMock.createUpdateElectionDraftTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "Owner draft update",
        expect.objectContaining({
          Title: "Board Election Final",
        }),
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-draft-update-transaction",
    );
    expect(electionsServiceMock.updateElectionDraft).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Election draft updated."),
    ).toBeInTheDocument();
  });

  it("allows saving a governance change even when the persisted election includes the reserved blank option", async () => {
    const reservedBlankOption = {
      OptionId: "reserved-blank",
      DisplayLabel: "Blank vote",
      ShortDescription: "",
      BallotOrder: 3,
      IsBlankOption: true,
    };
    const baselineElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        Title: "Board Election",
        CurrentDraftRevision: 1,
        Options: [...createDraftInput().OwnerOptions, reservedBlankOption],
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: baselineElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Options: [...createDraftInput().OwnerOptions, reservedBlankOption],
        }),
        CeremonyProfiles: [
          {
            ProfileId: "admin-prod-1of1",
            DisplayName: "Admin-only protected circuit",
            Description: "Admin protected",
            ProviderKey: "built-in-admin",
            ProfileVersion: "omega-v1.0.0-admin-prod-1of1",
            TrusteeCount: 1,
            RequiredApprovalCount: 1,
            DevOnly: false,
            RegisteredAt: timestamp,
            LastUpdatedAt: timestamp,
          },
        ],
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("policy");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit draft policy" }),
    );
    fireEvent.change(screen.getByLabelText("Governance mode"), {
      target: { value: `${ElectionGovernanceModeProto.TrusteeThreshold}` },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply policy changes" }),
    );

    expect(
      screen.queryByText(
        "Owner options must not mark themselves as the reserved blank vote option.",
      ),
    ).not.toBeInTheDocument();
    await openOwnerDetailTab("save");
    expect(screen.getByTestId("elections-save-button")).toBeEnabled();

    fireEvent.click(screen.getByTestId("elections-save-button"));

    await waitFor(() => {
      expect(
        transactionServiceMock.createUpdateElectionDraftTransaction,
      ).toHaveBeenCalled();
    });

    const submittedDraft =
      transactionServiceMock.createUpdateElectionDraftTransaction.mock.calls[0]?.[5];

    expect(submittedDraft).toBeDefined();
    expect(submittedDraft.GovernanceMode).toBe(
      ElectionGovernanceModeProto.TrusteeThreshold,
    );
    expect(submittedDraft.SelectedProfileId).toBe("dkg-prod-3of5");
    expect(submittedDraft.RequiredApprovalCount).toBe(3);
    expect(submittedDraft.OwnerOptions).toHaveLength(2);
    expect(
      submittedDraft.OwnerOptions.some(
        (option: { IsBlankOption: boolean }) => option.IsBlankOption,
      ),
    ).toBe(false);
  });

  it("invites a trustee through blockchain submission and waits for indexed readback", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType:
        EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [
        { ApplicationId: "hushsocial", Version: "1.0.0" },
      ],
      ProtocolOmegaVersion: "omega-v1.0.0",
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };
    const indexedInvitations = [
      {
        Id: "invite-1",
        ElectionId: "election-1",
        TrusteeUserAddress: "trustee-z",
        TrusteeDisplayName: "Zoe Trustee",
        InvitedByPublicAddress: "owner-public-key",
        LinkedMessageId: "message-1",
        Status: ElectionTrusteeInvitationStatusProto.Pending,
        SentAtDraftRevision: 1,
        SentAt: timestamp,
      },
    ];

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: indexedInvitations,
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: indexedInvitations,
          CeremonyProfiles: [],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("trustees");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit trustee setup" }),
    );
    expect(
      await screen.findByTestId("elections-trustee-user-address-input"),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByTestId("elections-trustee-user-address-input"),
      {
        target: { value: "trustee-z" },
      },
    );
    fireEvent.change(
      screen.getByTestId("elections-trustee-display-name-input"),
      {
        target: { value: "Zoe Trustee" },
      },
    );

    fireEvent.click(screen.getByTestId("elections-invite-trustee-button"));

    await waitFor(() => {
      expect(
        transactionServiceMock.createElectionTrusteeInvitationTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "trustee-z",
        "Zoe Trustee",
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-trustee-invite-transaction",
    );
    expect(
      await screen.findByText("Trustee invitation created."),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Zoe Trustee (trustee-z)")).length,
    ).toBeGreaterThan(0);
  });

  it("revokes a trustee invitation through blockchain submission and waits for the revoked status", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType:
        EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [
        { ApplicationId: "hushsocial", Version: "1.0.0" },
      ],
      ProtocolOmegaVersion: "omega-v1.0.0",
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };
    const pendingInvitation = {
      Id: "invite-1",
      ElectionId: "election-1",
      TrusteeUserAddress: "trustee-z",
      TrusteeDisplayName: "Zoe Trustee",
      InvitedByPublicAddress: "owner-public-key",
      LinkedMessageId: "message-1",
      Status: ElectionTrusteeInvitationStatusProto.Pending,
      SentAtDraftRevision: 1,
      SentAt: timestamp,
    };
    const revokedInvitation = {
      ...pendingInvitation,
      Status: ElectionTrusteeInvitationStatusProto.Revoked,
      ResolvedAtDraftRevision: 1,
      RevokedAt: timestamp,
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [pendingInvitation],
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [revokedInvitation],
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [revokedInvitation],
          CeremonyProfiles: [],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("trustees");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit trustee setup" }),
    );
    expect(
      (await screen.findAllByText("Zoe Trustee (trustee-z)")).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Revoke"));

    await waitFor(() => {
      expect(
        transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "invite-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-trustee-revoke-transaction",
    );
    expect(
      electionsServiceMock.revokeElectionTrusteeInvitation,
    ).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Trustee invitation revoked."),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Revoked.*Sent at draft revision/i)).length,
    ).toBeGreaterThan(0);
  });

  it("searches Hush accounts and invites a trustee directly from the result", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType:
        EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [
        { ApplicationId: "hushsocial", Version: "1.0.0" },
      ],
      ProtocolOmegaVersion: "omega-v1.0.0",
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };
    const indexedInvitations = [
      {
        Id: "invite-1",
        ElectionId: "election-1",
        TrusteeUserAddress: "trustee-zoe",
        TrusteeDisplayName: "Zoe Trustee",
        InvitedByPublicAddress: "owner-public-key",
        LinkedMessageId: "message-zoe",
        Status: ElectionTrusteeInvitationStatusProto.Pending,
        SentAtDraftRevision: 1,
        SentAt: timestamp,
      },
    ];

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: indexedInvitations,
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: indexedInvitations,
          CeremonyProfiles: [],
        }),
      );
    identityServiceMock.searchByDisplayName.mockResolvedValueOnce({
      Identities: [
        {
          DisplayName: "Zoe Trustee",
          PublicSigningAddress: "trustee-zoe",
          PublicEncryptAddress: "encrypt-zoe",
        },
      ],
    });

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("trustees");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit trustee setup" }),
    );

    fireEvent.change(screen.getByTestId("elections-trustee-search-input"), {
      target: { value: "Zoe" },
    });
    fireEvent.click(screen.getByTestId("elections-search-trustees-button"));

    await waitFor(() => {
      expect(identityServiceMock.searchByDisplayName).toHaveBeenCalledWith(
        "Zoe",
      );
    });

    expect(await screen.findByText("Zoe Trustee")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Invite trustee Zoe Trustee" }),
    );

    await waitFor(() => {
      expect(
        transactionServiceMock.createElectionTrusteeInvitationTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "trustee-zoe",
        "Zoe Trustee",
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-trustee-invite-transaction",
    );
    expect(
      await screen.findByText("Trustee invitation created."),
    ).toBeInTheDocument();
  });

  it("keeps the busy state while the trustee invitation waits for indexing", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType:
        EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [
        { ApplicationId: "hushsocial", Version: "1.0.0" },
      ],
      ProtocolOmegaVersion: "omega-v1.0.0",
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("trustees");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit trustee setup" }),
    );
    expect(
      await screen.findByTestId("elections-trustee-user-address-input"),
    ).toBeInTheDocument();

    vi.useFakeTimers();

    fireEvent.change(
      screen.getByTestId("elections-trustee-user-address-input"),
      {
        target: { value: "trustee-z" },
      },
    );
    fireEvent.change(
      screen.getByTestId("elections-trustee-display-name-input"),
      {
        target: { value: "Zoe Trustee" },
      },
    );

    fireEvent.click(screen.getByTestId("elections-invite-trustee-button"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("Trustee invitation submitted."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/waiting for block confirmation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("elections-invite-trustee-button"),
    ).toBeDisabled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(
      screen.getByText("Trustee invitation submitted."),
    ).toBeInTheDocument();
  });

  it("aligns the trustee approval count with the fixed ceremony rollout shape", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 1,
      },
    );
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType:
        EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [
        { ApplicationId: "hushsocial", Version: "1.0.0" },
      ],
      ProtocolOmegaVersion: "omega-v1.0.0",
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 1,
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          RequiredApprovalCount: 1,
        }),
      ],
    });
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValueOnce(
      createCeremonyActionViewResponse({
        OwnerActions: [
          {
            ActionType:
              ElectionCeremonyActionTypeProto.CeremonyActionStartVersion,
            IsAvailable: false,
            IsCompleted: false,
            Reason:
              "No allowed ceremony profile matches the current accepted trustee roster and threshold.",
          },
          {
            ActionType:
              ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion,
            IsAvailable: false,
            IsCompleted: false,
            Reason:
              "No allowed ceremony profile matches the current accepted trustee roster and threshold.",
          },
        ],
        BlockedReasons: [
          "No allowed ceremony profile matches the current accepted trustee roster and threshold.",
        ],
      }),
    );
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: thresholdElection,
        LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
        CeremonyProfiles: [
          {
            ProfileId: "dkg-prod-3of5",
            DisplayName: "Production-Like 3 of 5",
            Description:
              "Production-like manifest-backed ceremony profile for the initial 3-of-5 trustee rollout over 5 trustees.",
            ProviderKey: "provider-a",
            ProfileVersion: "v1",
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            DevOnly: false,
            RegisteredAt: timestamp,
            LastUpdatedAt: timestamp,
          },
        ],
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("trustees");
    expect(
      await screen.findByText(
        /Aligned locally to the current 3-of-5 trustee rollout\./i,
      ),
    ).toBeInTheDocument();
    await openOwnerDetailTab("ceremony");
    expect(
      screen.getByText(
        /Save the next draft revision to persist the aligned 3-of-5 threshold before the ceremony can start\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /No allowed ceremony profile matches the current accepted trustee roster and threshold\./i,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("elections-ceremony-start-button"),
    ).toBeDisabled();

    await openOwnerDetailTab("trustees");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit trustee setup" }),
    );

    const thresholdInput = screen.getByDisplayValue("3");
    expect(thresholdInput).toHaveAttribute("readonly");
    expect(
      screen.getByText(/The current ceremony rollout is fixed to 3-of-5/i),
    ).toBeInTheDocument();
  });

  it("shows the trustee-threshold block and hides the open action", async () => {
    const trusteeDraft = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 1,
        OutcomeRule: {
          Kind: OutcomeRuleKindProto.PassFail,
          TemplateKey: "pass_fail_yes_no",
          SeatCount: 1,
          BlankVoteCountsForTurnout: true,
          BlankVoteExcludedFromWinnerSelection: true,
          BlankVoteExcludedFromThresholdDenominator: true,
          TieResolutionRule: "tie_unresolved",
          CalculationBasis: "simple_majority_of_non_blank_votes",
        },
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: trusteeDraft,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: trusteeDraft.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 1,
          },
        }),
        TrusteeInvitations: [
          {
            Id: "invite-1",
            ElectionId: "election-1",
            TrusteeUserAddress: "trustee-a",
            TrusteeDisplayName: "Alice",
            InvitedByPublicAddress: "owner-public-key",
            LinkedMessageId: "message-1",
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
        ],
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("readiness");
    expect(
      await screen.findByTestId("elections-ready-to-open-checklist"),
    ).toHaveTextContent("Accepted trustee roster");
    expect(
      screen.getByTestId("elections-ready-to-open-checklist"),
    ).toHaveTextContent(
      "Need at least 5 accepted trustee(s) to match the selected 3-of-5 profile.",
    );
    expect(
      screen.getByTestId("elections-ready-to-open-checklist"),
    ).toHaveTextContent("Key ceremony");
    expect(
      await screen.findByTestId("elections-governed-open-readiness"),
    ).toHaveTextContent("Not ready to start the governed open proposal yet.");
    expect(
      screen.getByTestId("elections-governed-open-readiness"),
    ).toHaveTextContent(
      "Need at least 5 accepted trustee(s) to match the selected 3-of-5 ceremony profile before the governed open proposal can start.",
    );
    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).toHaveTextContent("Unavailable");
    expect(
      screen.queryByTestId(
        `elections-governed-start-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).not.toBeInTheDocument();
    await openOwnerDetailTab("trustees");
    expect(
      await screen.findByTestId("elections-trustee-blocked-panel"),
    ).toHaveTextContent("Proposal approval is active");
    await openOwnerDetailTab("auditors");
    expect(
      screen.getByTestId("elections-auditor-access-overview"),
    ).toHaveTextContent("Manage auditor access");
    expect(screen.queryByText(/FEAT-/)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("elections-open-button"),
    ).not.toBeInTheDocument();
  });

  it("shows the non-binding advisory for advisory elections", async () => {
    const advisoryElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        BindingStatus: ElectionBindingStatusProto.NonBinding,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          BindingStatus: ElectionBindingStatusProto.NonBinding,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: advisoryElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.NonBinding,
            GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: advisoryElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
          },
        }),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    expect(
      await screen.findByTestId("elections-binding-advisory"),
    ).toHaveTextContent("result is advisory");
    expect(screen.getByTestId("elections-mode-freeze-summary")).toHaveTextContent(
      "Non-binding elections may choose either a dev/open circuit or a non-dev circuit",
    );
  });

  it("shows the binding mode freeze summary for default binding drafts", async () => {
    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(createElectionResponse());

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    expect(
      await screen.findByTestId("elections-mode-freeze-summary"),
    ).toHaveTextContent("non-dev circuits");
  });

  it("filters the admin-only circuit catalog by binding status without leaking trustee labels", async () => {
    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(createElectionResponse());

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("policy");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit draft policy" }),
    );

    const policyDialog = await screen.findByRole("dialog", {
      name: "Edit draft policy",
    });
    const profileSelect = (await within(policyDialog).findByTestId(
      "elections-policy-profile-select",
    )) as HTMLSelectElement;
    expect(
      Array.from(profileSelect.options).map((option) => option.textContent?.trim()),
    ).toEqual(["Admin-only protected circuit"]);
    expect(screen.getByTestId("elections-mode-freeze-summary")).toHaveTextContent(
      "non-dev circuits",
    );
    expect(screen.queryByText("Production-Like 3 of 5")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.change(within(policyDialog).getByLabelText("Binding status"), {
        target: { value: `${ElectionBindingStatusProto.NonBinding}` },
      });
    });

    await waitFor(() => {
      expect(
        Array.from(profileSelect.options).map((option) => option.textContent?.trim()),
      ).toEqual([
        "Admin-only protected circuit",
        "Admin-only open audit circuit",
      ]);
    });

    await act(async () => {
      fireEvent.change(profileSelect, {
        target: { value: "admin-dev-1of1" },
      });
      fireEvent.click(
        within(policyDialog).getByRole("button", { name: "Apply policy changes" }),
      );
    });

    expect(screen.getByTestId("elections-mode-freeze-summary")).toHaveTextContent(
      "Non-binding elections may choose either a dev/open circuit or a non-dev circuit",
    );
    expect(screen.getByText("Admin-only open audit circuit")).toBeInTheDocument();
    expect(screen.queryByText("Production-Like 3 of 5")).not.toBeInTheDocument();
  });

  it("restates the mode/profile contract on the ready-to-open tab", async () => {
    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          BindingStatus: ElectionBindingStatusProto.NonBinding,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: createElectionRecord(ElectionLifecycleStateProto.Draft, {
          BindingStatus: ElectionBindingStatusProto.NonBinding,
        }),
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ...createDraftSnapshot().Policy,
            BindingStatus: ElectionBindingStatusProto.NonBinding,
          },
        }),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("readiness");

    expect(
      await screen.findByTestId("elections-open-mode-profile-summary"),
    ).toHaveTextContent("Non-binding election");
    expect(
      screen.getByTestId("elections-open-mode-profile-summary"),
    ).toHaveTextContent("dev/open and non-dev circuits");
  });

  it("shows stale protocol package refs on readiness and refreshes them through blockchain submission", async () => {
    const staleBinding = createProtocolPackageBinding({
      PackageVersion: "v0.9.0",
      Status: ProtocolPackageBindingStatusProto.Stale,
    });
    const latestBinding = createProtocolPackageBinding({
      PackageVersion: "v1.0.0",
      Status: ProtocolPackageBindingStatusProto.Latest,
    });
    const draftElection = createElectionRecord(ElectionLifecycleStateProto.Draft);

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: draftElection,
          LatestDraftSnapshot: createDraftSnapshot(),
          ProtocolPackageBinding: staleBinding,
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: draftElection,
          LatestDraftSnapshot: createDraftSnapshot(),
          ProtocolPackageBinding: latestBinding,
        }),
      );
    electionsServiceMock.getElectionOpenReadiness
      .mockResolvedValueOnce(
        createReadinessResponse({
          IsReadyToOpen: false,
          ProtocolPackageBinding: staleBinding,
          ProtocolPackageBindingStatus: ProtocolPackageBindingStatusProto.Stale,
          ProtocolPackageBindingMessage:
            "Refresh to the latest approved Protocol Omega package before opening.",
        }),
      )
      .mockResolvedValue(
        createReadinessResponse({
          IsReadyToOpen: true,
          ProtocolPackageBinding: latestBinding,
          ProtocolPackageBindingStatus: ProtocolPackageBindingStatusProto.Latest,
          ProtocolPackageBindingMessage:
            "Compatible package refs are ready and will be sealed when the election opens.",
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("readiness");

    expect(
      await screen.findByTestId("elections-protocol-package-readiness"),
    ).toHaveTextContent("Stale package refs");
    expect(screen.getByTestId("elections-ready-to-open-checklist")).toHaveTextContent(
      "Protocol package refs",
    );
    expect(screen.getByTestId("elections-ready-to-open-checklist")).toHaveTextContent(
      "Refresh to the latest approved Protocol Omega package before opening.",
    );

    fireEvent.click(
      within(screen.getByTestId("elections-protocol-package-readiness")).getByTestId(
        "protocol-package-refresh",
      ),
    );

    await waitFor(() => {
      expect(
        transactionServiceMock.createRefreshProtocolPackageBindingTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-refresh-protocol-package-transaction",
    );
    await waitFor(() => {
      expect(screen.getByTestId("elections-protocol-package-readiness")).toHaveTextContent(
        "Latest approved",
      );
    });
  });

  it("shows missing SP-06 trustee-domain evidence as an open blocker", async () => {
    const protocolBinding = createProtocolPackageBinding();
    const trusteeDraft = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      RequiredApprovalCount: 3,
      SelectedProfileId: "dkg-prod-3of5",
      ControlDomainProfileId: "high_assurance_independent_trustees_v1",
      ControlDomainProfileVersion: "v1",
      ThresholdProfileId: "dkg-prod-3of5",
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: trusteeDraft,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ...createDraftSnapshot().Policy,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            SelectedProfileId: "dkg-prod-3of5",
            RequiredApprovalCount: 3,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            ControlDomainProfileId: "high_assurance_independent_trustees_v1",
            ControlDomainProfileVersion: "v1",
            ThresholdProfileId: "dkg-prod-3of5",
          },
        }),
        TrusteeInvitations: createAcceptedTrusteeInvitations(),
        CeremonyVersions: [
          {
            Id: "ceremony-ready",
            ElectionId: "election-1",
            VersionNumber: 1,
            ProfileId: "dkg-prod-3of5",
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionReady,
            StartedAt: timestamp,
            StartedByPublicAddress: "owner-public-key",
            TallyPublicKeyFingerprint: "fingerprint-1",
          },
        ],
        ProtocolPackageBinding: protocolBinding,
      }),
    );
    electionsServiceMock.getElectionOpenReadiness.mockResolvedValue(
      createReadinessResponse({
        IsReadyToOpen: false,
        ProtocolPackageBinding: protocolBinding,
        Sp06Evidence: {
          EvidenceExpected: true,
          PublicEvidenceAvailable: false,
          RestrictedEvidenceAvailable: false,
          ControlDomainProfileId: "high_assurance_independent_trustees_v1",
          ControlDomainProfileVersion: "v1",
          ThresholdProfileId: "dkg-prod-3of5",
          TrusteeCount: 5,
          TrusteeThreshold: 3,
          AcceptedBeforeOpenCount: 5,
          CompleteEvidenceCount: 4,
          MissingEvidenceCount: 1,
          StaleEvidenceCount: 0,
          IncompatibleEvidenceCount: 0,
          AcceptedReleaseArtifactCount: 0,
          MissingReleaseArtifactCount: 0,
          RejectedReleaseArtifactCount: 0,
          LatestCtrlResultCode: "CTRL-OPEN-MISSING",
          Blockers: [
            {
              Code: "CTRL-OPEN-MISSING",
              Message: "Trustee trustee-e has no custody/domain evidence.",
              TrusteeRef: "trustee-e",
              BlocksOpen: true,
              BlocksFinalization: false,
            },
          ],
          Message: "One trustee control-domain evidence item is missing.",
        },
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("readiness");

    expect(
      await screen.findByTestId("elections-sp06-control-domain-readiness"),
    ).toHaveTextContent("high_assurance_independent_trustees_v1 v1");
    expect(screen.getByTestId("elections-sp06-control-domain-readiness")).toHaveTextContent(
      "3 of 5",
    );
    expect(screen.getByTestId("elections-sp06-control-domain-readiness")).toHaveTextContent(
      "Trustee trustee-e has no custody/domain evidence.",
    );
    expect(screen.getByTestId("elections-ready-to-open-checklist")).toHaveTextContent(
      "Trustee control-domain evidence",
    );
    expect(
      await screen.findByTestId("elections-governed-open-readiness"),
    ).toHaveTextContent("Trustee trustee-e has no custody/domain evidence.");
  });

  it("shows incompatible SP-06 trustee profile evidence as an open blocker", async () => {
    const protocolBinding = createProtocolPackageBinding();
    const trusteeDraft = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      RequiredApprovalCount: 3,
      SelectedProfileId: "dkg-prod-3of5",
      ControlDomainProfileId: "high_assurance_independent_trustees_v1",
      ControlDomainProfileVersion: "v1",
      ThresholdProfileId: "dkg-prod-3of5",
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: trusteeDraft,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ...createDraftSnapshot().Policy,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            SelectedProfileId: "dkg-prod-3of5",
            RequiredApprovalCount: 3,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            ControlDomainProfileId: "high_assurance_independent_trustees_v1",
            ControlDomainProfileVersion: "v1",
            ThresholdProfileId: "dkg-prod-3of5",
          },
        }),
        TrusteeInvitations: createAcceptedTrusteeInvitations(),
        CeremonyVersions: [
          {
            Id: "ceremony-ready",
            ElectionId: "election-1",
            VersionNumber: 1,
            ProfileId: "dkg-prod-3of5",
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionReady,
            StartedAt: timestamp,
            StartedByPublicAddress: "owner-public-key",
            TallyPublicKeyFingerprint: "fingerprint-1",
          },
        ],
        ProtocolPackageBinding: protocolBinding,
      }),
    );
    electionsServiceMock.getElectionOpenReadiness.mockResolvedValue(
      createReadinessResponse({
        IsReadyToOpen: false,
        ProtocolPackageBinding: protocolBinding,
        Sp06Evidence: {
          EvidenceExpected: true,
          PublicEvidenceAvailable: false,
          RestrictedEvidenceAvailable: false,
          ControlDomainProfileId: "high_assurance_independent_trustees_v1",
          ControlDomainProfileVersion: "v1",
          ThresholdProfileId: "dkg-prod-3of5",
          TrusteeCount: 5,
          TrusteeThreshold: 3,
          AcceptedBeforeOpenCount: 5,
          CompleteEvidenceCount: 4,
          MissingEvidenceCount: 0,
          StaleEvidenceCount: 0,
          IncompatibleEvidenceCount: 1,
          AcceptedReleaseArtifactCount: 0,
          MissingReleaseArtifactCount: 0,
          RejectedReleaseArtifactCount: 0,
          LatestCtrlResultCode: "CTRL-PROFILE-MISMATCH",
          Blockers: [
            {
              Code: "CTRL-PROFILE-MISMATCH",
              Message: "Trustee trustee-c evidence targets a different ceremony profile.",
              TrusteeRef: "trustee-c",
              BlocksOpen: true,
              BlocksFinalization: false,
            },
          ],
          Message: "One trustee control-domain evidence item is incompatible.",
        },
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("readiness");

    expect(
      await screen.findByTestId("elections-sp06-control-domain-readiness"),
    ).toHaveTextContent("CTRL-PROFILE-MISMATCH");
    expect(screen.getByTestId("elections-sp06-control-domain-readiness")).toHaveTextContent(
      "Trustee trustee-c evidence targets a different ceremony profile.",
    );
    expect(
      await screen.findByTestId("elections-governed-open-readiness"),
    ).toHaveTextContent(
      "Trustee trustee-c evidence targets a different ceremony profile.",
    );
  });

  it("uses stale protocol package refs as the governed-open blocker when trustee readiness is otherwise clear", async () => {
    const staleBinding = createProtocolPackageBinding({
      Status: ProtocolPackageBindingStatusProto.Stale,
    });
    const trusteeDraft = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      RequiredApprovalCount: 3,
      SelectedProfileId: "dkg-prod-3of5",
    });
    const acceptedTrustees = ["a", "b", "c", "d", "e"].map((suffix) => ({
      Id: `invite-${suffix}`,
      ElectionId: "election-1",
      TrusteeUserAddress: `trustee-${suffix}`,
      TrusteeDisplayName: `Trustee ${suffix.toUpperCase()}`,
      InvitedByPublicAddress: "owner-public-key",
      LinkedMessageId: `message-${suffix}`,
      Status: ElectionTrusteeInvitationStatusProto.Accepted,
      SentAtDraftRevision: 1,
      SentAt: timestamp,
    }));

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: trusteeDraft,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ...createDraftSnapshot().Policy,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            RequiredApprovalCount: 3,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          },
        }),
        TrusteeInvitations: acceptedTrustees,
        CeremonyVersions: [
          {
            Id: "ceremony-ready",
            ElectionId: "election-1",
            VersionNumber: 1,
            ProfileId: "dkg-prod-3of5",
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionReady,
            StartedAt: timestamp,
            StartedByPublicAddress: "owner-public-key",
            TallyPublicKeyFingerprint: "fingerprint-1",
          },
        ],
        ProtocolPackageBinding: staleBinding,
      }),
    );
    electionsServiceMock.getElectionOpenReadiness.mockResolvedValue(
      createReadinessResponse({
        IsReadyToOpen: false,
        ProtocolPackageBinding: staleBinding,
        ProtocolPackageBindingStatus: ProtocolPackageBindingStatusProto.Stale,
        ProtocolPackageBindingMessage:
          "Refresh to the latest approved Protocol Omega package before the governed open proposal.",
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("readiness");
    expect(
      await screen.findByTestId("elections-governed-open-readiness"),
    ).toHaveTextContent(
      "Refresh to the latest approved Protocol Omega package before the governed open proposal.",
    );

    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).toHaveTextContent(
      "Refresh to the latest approved Protocol Omega package before the governed open proposal.",
    );
    expect(
      screen.queryByTestId(
        `elections-governed-start-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).not.toBeInTheDocument();
  });

  it("shows lifecycle controls and frozen policy for an open election", async () => {
    const openElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        OpenedAt: timestamp,
        OpenArtifactId: "open-artifact",
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: openElection,
        WarningAcknowledgements: [
          {
            Id: "warning-1",
            ElectionId: "election-1",
            WarningCode: 0,
            DraftRevision: 1,
            AcknowledgedByPublicAddress: "owner-public-key",
            AcknowledgedAt: timestamp,
          },
        ],
        BoundaryArtifacts: [
          {
            Id: "open-artifact",
            ElectionId: "election-1",
            ArtifactType: 0,
            LifecycleState: ElectionLifecycleStateProto.Open,
            SourceDraftRevision: 1,
            Metadata: {
              Title: "Board Election",
              ShortDescription: "",
              OwnerPublicAddress: "owner-public-key",
              ExternalReferenceCode: "ORG-2026-01",
            },
            Policy: {
              ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
              BindingStatus: ElectionBindingStatusProto.Binding,
              GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
              DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
              ParticipationPrivacyMode:
                ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
              VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
              EligibilitySourceType:
                EligibilitySourceTypeProto.OrganizationImportedRoster,
              EligibilityMutationPolicy:
                EligibilityMutationPolicyProto.FrozenAtOpen,
              OutcomeRule: openElection.OutcomeRule,
              ApprovedClientApplications: [
                { ApplicationId: "hushsocial", Version: "1.0.0" },
              ],
              ProtocolOmegaVersion: "omega-v1.0.0",
              ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
              ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
            },
            Options: openElection.Options,
            AcknowledgedWarningCodes: [],
            FrozenEligibleVoterSetHash: "frozen-hash",
            TrusteePolicyExecutionReference: "",
            ReportingPolicyExecutionReference: "",
            ReviewWindowExecutionReference: "",
            AcceptedBallotSetHash: "",
            FinalEncryptedTallyHash: "",
            RecordedAt: timestamp,
            RecordedByPublicAddress: "owner-public-key",
          },
        ],
        ProtocolPackageBinding: createProtocolPackageBinding({
          Status: ProtocolPackageBindingStatusProto.Sealed,
          HasSealedAt: true,
          SealedAt: timestamp,
        }),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    expect(
      await screen.findByTestId("elections-close-button"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("elections-read-only-banner")).toHaveTextContent(
      "Draft editing is frozen after open",
    );
    expect(
      screen.queryByTestId("elections-title-input"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit metadata" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New Election Draft" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Start new election draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Save Current Draft")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("elections-draft-save-overview"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("elections-frozen-policy")).toHaveTextContent(
      "Protocol Omega version",
    );
    expect(screen.getByTestId("elections-warning-evidence")).toHaveTextContent(
      "Low anonymity set",
    );
    expect(screen.getByText("Boundary artifacts")).toBeInTheDocument();
    expect(screen.getByTestId("elections-protocol-package-sealed-refs")).toHaveTextContent(
      "Sealed at open",
    );
  });

  it("opens an election through blockchain submission and waits for the open boundary readback", async () => {
    const draftElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        AcknowledgedWarningCodes: [0],
      },
    );
    const openElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        AcknowledgedWarningCodes: [0],
        OpenedAt: timestamp,
        OpenArtifactId: "open-artifact",
      },
    );

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: draftElection,
          LatestDraftSnapshot: createDraftSnapshot(),
          WarningAcknowledgements: [
            {
              Id: "warning-1",
              ElectionId: "election-1",
              WarningCode: 0,
              DraftRevision: 1,
              AcknowledgedByPublicAddress: "owner-public-key",
              AcknowledgedAt: timestamp,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openElection,
          LatestDraftSnapshot: createDraftSnapshot(),
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: openElection,
          LatestDraftSnapshot: createDraftSnapshot(),
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("lifecycle");
    fireEvent.click(await screen.findByTestId("elections-open-button"));

    expect(await screen.findByText("Election opened.")).toBeInTheDocument();
    expect(
      transactionServiceMock.createOpenElectionTransaction,
    ).toHaveBeenCalledWith(
      "election-1",
      "owner-public-key",
      "owner-encryption-key",
      "owner-encryption-private-key",
      expect.any(Array),
      null,
      "",
      "",
      "",
      "owner-private-key",
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-open-election-transaction",
    );
    expect(electionsServiceMock.openElection).not.toHaveBeenCalled();
  });

  it("closes an election through blockchain submission and waits for the close boundary readback", async () => {
    const openElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        OpenedAt: timestamp,
        OpenArtifactId: "open-artifact",
      },
    );
    const closedElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        OpenedAt: timestamp,
        ClosedAt: timestamp,
        OpenArtifactId: "open-artifact",
        CloseArtifactId: "close-artifact",
      },
    );

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
      })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Closed)],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openElection,
          BoundaryArtifacts: [],
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: closedElection,
          BoundaryArtifacts: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: closedElection,
          BoundaryArtifacts: [],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("lifecycle");
    fireEvent.click(await screen.findByTestId("elections-close-button"));

    expect(await screen.findByText("Election closed.")).toBeInTheDocument();
    expect(
      transactionServiceMock.createCloseElectionTransaction,
    ).toHaveBeenCalledWith(
      "election-1",
      "owner-public-key",
      "owner-encryption-key",
      "owner-encryption-private-key",
      null,
      null,
      "owner-private-key",
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-close-election-transaction",
    );
    expect(electionsServiceMock.closeElection).not.toHaveBeenCalled();
  });

  it("finalizes an election through blockchain submission and waits for the finalize boundary readback", async () => {
    const closedElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        OpenedAt: timestamp,
        ClosedAt: timestamp,
        OpenArtifactId: "open-artifact",
        CloseArtifactId: "close-artifact",
        TallyReadyAt: timestamp,
      },
    );
    const finalizedElection = createElectionRecord(
      ElectionLifecycleStateProto.Finalized,
      {
        OpenedAt: timestamp,
        ClosedAt: timestamp,
        FinalizedAt: timestamp,
        OpenArtifactId: "open-artifact",
        CloseArtifactId: "close-artifact",
        FinalizeArtifactId: "finalize-artifact",
        TallyReadyAt: timestamp,
      },
    );

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Closed)],
      })
      .mockResolvedValueOnce({
        Elections: [
          createElectionSummary(ElectionLifecycleStateProto.Finalized),
        ],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: closedElection,
          BoundaryArtifacts: [],
        }),
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: finalizedElection,
          BoundaryArtifacts: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: finalizedElection,
          BoundaryArtifacts: [],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("lifecycle");
    fireEvent.click(await screen.findByTestId("elections-finalize-button"));

    expect(await screen.findByText("Election finalized.")).toBeInTheDocument();
    expect(
      transactionServiceMock.createFinalizeElectionTransaction,
    ).toHaveBeenCalledWith(
      "election-1",
      "owner-public-key",
      "owner-encryption-key",
      "owner-encryption-private-key",
      null,
      null,
      "owner-private-key",
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-finalize-election-transaction",
    );
    expect(electionsServiceMock.finalizeElection).not.toHaveBeenCalled();
  });

  it("starts a governed close proposal through blockchain submission and waits for the indexed proposal", async () => {
    const openThresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
        OpenArtifactId: "open-artifact",
      },
    );
    const indexedProposal = {
      Id: "proposal-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "",
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Open, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openThresholdElection,
          GovernedProposals: [],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: {
            ...openThresholdElection,
            VoteAcceptanceLockedAt: timestamp,
          },
          GovernedProposals: [indexedProposal],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId("elections-governed-actions"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId(
        `elections-governed-start-${ElectionGovernedActionTypeProto.Close}`,
      ),
    );

    await waitFor(() => {
      expect(
        transactionServiceMock.createStartElectionGovernedProposalTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        ElectionGovernedActionTypeProto.Close,
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-start-governed-proposal-transaction",
    );
    expect(
      electionsServiceMock.startElectionGovernedProposal,
    ).not.toHaveBeenCalled();
  });

  it("retries a failed governed proposal through blockchain submission and waits for the execution update", async () => {
    const openThresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
        OpenArtifactId: "open-artifact",
      },
    );
    const failedProposal = {
      Id: "proposal-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.ExecutionFailed,
      ExecutionFailureReason:
        "The election was not open during the first attempt.",
      LastExecutionTriggeredByPublicAddress: "trustee-a",
      LastExecutionAttemptedAt: timestamp,
    };
    const succeededProposal = {
      ...failedProposal,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
      ExecutionFailureReason: "",
      ExecutedAt: { seconds: timestamp.seconds + 60, nanos: 0 },
      LastExecutionAttemptedAt: { seconds: timestamp.seconds + 60, nanos: 0 },
      LastExecutionTriggeredByPublicAddress: "owner-public-key",
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Open, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openThresholdElection,
          GovernedProposals: [failedProposal],
        }),
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: {
            ...openThresholdElection,
            LifecycleState: ElectionLifecycleStateProto.Closed,
            ClosedAt: timestamp,
            CloseArtifactId: "close-artifact",
          },
          GovernedProposals: [succeededProposal],
        }),
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId("elections-governed-actions"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId(
        `elections-governed-retry-${ElectionGovernedActionTypeProto.Close}`,
      ),
    );

    await waitFor(() => {
      expect(
        transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "proposal-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "owner-private-key",
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      "signed-retry-governed-proposal-transaction",
    );
    expect(
      electionsServiceMock.retryElectionGovernedProposalExecution,
    ).not.toHaveBeenCalled();
  });

  it("surfaces unsupported FEAT-094 values from an existing draft", async () => {
    const unsupportedElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        VoteUpdatePolicy: VoteUpdatePolicyProto.LatestValidVoteWins,
        DisclosureMode:
          ElectionDisclosureModeProto.SeparatedParticipationAndResultReports,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: unsupportedElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
            DisclosureMode:
              ElectionDisclosureModeProto.SeparatedParticipationAndResultReports,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.LatestValidVoteWins,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: unsupportedElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
          },
        }),
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    const unsupportedPanel = await screen.findByTestId(
      "elections-unsupported-panel",
    );
    expect(unsupportedPanel).toHaveTextContent(
      "final-results-only disclosure mode",
    );
    expect(unsupportedPanel).toHaveTextContent(
      "single-submission-only vote update policy",
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId("elections-open-button"),
      ).not.toBeInTheDocument();
    });
  });

  it("starts a trustee-threshold ceremony version from the owner workspace", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      TrusteeInvitations: [
        {
          Id: "invite-1",
          ElectionId: "election-1",
          TrusteeUserAddress: "trustee-a",
          TrusteeDisplayName: "Alice Trustee",
          InvitedByPublicAddress: "owner-public-key",
          LinkedMessageId: "message-1",
          Status: ElectionTrusteeInvitationStatusProto.Accepted,
          SentAtDraftRevision: 1,
          SentAt: timestamp,
        },
        {
          Id: "invite-2",
          ElectionId: "election-1",
          TrusteeUserAddress: "trustee-b",
          TrusteeDisplayName: "Bob Trustee",
          InvitedByPublicAddress: "owner-public-key",
          LinkedMessageId: "message-2",
          Status: ElectionTrusteeInvitationStatusProto.Accepted,
          SentAtDraftRevision: 1,
          SentAt: timestamp,
        },
      ],
      CeremonyProfiles: [
        {
          ProfileId: "dkg-prod-3of5",
          DisplayName: "Production 3 of 5",
          Description: "Production rollout profile",
          ProviderKey: "provider-a",
          ProfileVersion: "v1",
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          DevOnly: false,
          RegisteredAt: timestamp,
          LastUpdatedAt: timestamp,
        },
      ],
    });
    const indexedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      CeremonyVersions: [
        {
          Id: "ceremony-version-1",
          ElectionId: "election-1",
          VersionNumber: 1,
          ProfileId: "dkg-prod-3of5",
          Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          BoundTrustees: [
            {
              TrusteeUserAddress: "trustee-a",
              TrusteeDisplayName: "Alice Trustee",
            },
            {
              TrusteeUserAddress: "trustee-b",
              TrusteeDisplayName: "Bob Trustee",
            },
          ],
          StartedByPublicAddress: "owner-public-key",
          StartedAt: timestamp,
          SupersededReason: "",
          TallyPublicKeyFingerprint: "",
        },
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(indexedElectionResponse)
      .mockResolvedValue(indexedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("ceremony");
    const ceremonySection = await screen.findByTestId(
      "elections-ceremony-section",
    );
    expect(ceremonySection).toBeInTheDocument();
    expect(ceremonySection.className).not.toContain("border-hush-bg-light");
    fireEvent.click(screen.getByTestId("elections-ceremony-start-button"));
    expect(
      await screen.findByTestId("elections-ceremony-confirm-button"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("elections-ceremony-confirm-button"));

    await waitFor(() => {
      expect(
        transactionServiceMock.createStartElectionCeremonyTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "dkg-prod-3of5",
        "owner-private-key",
      );
    });
  });

  it("refreshes owner ceremony progress and shows trustee step status without a manual reload", async () => {
    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(window, "setInterval").mockImplementation(
      ((callback: TimerHandler) => {
        if (typeof callback === "function") {
          intervalCallbacks.push(callback as () => void);
        }
        return 1 as unknown as ReturnType<typeof window.setInterval>;
      }) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      CeremonyProfiles: [
        {
          ProfileId: "dkg-prod-3of5",
          DisplayName: "Production 3 of 5",
          Description: "Production rollout profile",
          ProviderKey: "provider-a",
          ProfileVersion: "v1",
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          DevOnly: false,
          RegisteredAt: timestamp,
          LastUpdatedAt: timestamp,
        },
      ],
      ActiveCeremonyTrusteeStates: [
        createCeremonyTrusteeState({
          TrusteeUserAddress: "trustee-five",
          TrusteeDisplayName: "TrusteeFive",
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateAcceptedTrustee,
          TransportPublicKeyFingerprint: "",
          TransportPublicKeyPublishedAt: undefined,
          JoinedAt: undefined,
          SelfTestSucceededAt: undefined,
          MaterialSubmittedAt: undefined,
          CompletedAt: undefined,
        }),
      ],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      ActiveCeremonyTrusteeStates: [
        createCeremonyTrusteeState({
          TrusteeUserAddress: "trustee-five",
          TrusteeDisplayName: "TrusteeFive",
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
          TransportPublicKeyPublishedAt: timestamp,
          JoinedAt: timestamp,
          SelfTestSucceededAt: timestamp,
          MaterialSubmittedAt: timestamp,
          ShareVersion: "share-v1",
        }),
      ],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("ceremony");
    expect(
      await screen.findByText("Step 1 ready: Publish transport key"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(intervalCallbacks.length).toBeGreaterThan(0);
    });

    await act(async () => {
      intervalCallbacks.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(await screen.findByText("Ready for owner approval")).toBeInTheDocument();
    expect(screen.getAllByText("Trustee-local steps are complete.").length).toBeGreaterThan(0);
    expect(screen.getByTestId("elections-ceremony-approve-next")).toBeInTheDocument();
    expect(electionsServiceMock.getElectionCeremonyActionView.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("refreshes trustee invitation acceptance on the owner trustee setup tab without a manual reload", async () => {
    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(window, "setInterval").mockImplementation(
      ((callback: TimerHandler) => {
        if (typeof callback === "function") {
          intervalCallbacks.push(callback as () => void);
        }
        return 1 as unknown as ReturnType<typeof window.setInterval>;
      }) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const thresholdSnapshot = createDraftSnapshot({
      Policy: {
        ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
        BindingStatus: ElectionBindingStatusProto.Binding,
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
        ParticipationPrivacyMode:
          ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
        VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
        EligibilitySourceType:
          EligibilitySourceTypeProto.OrganizationImportedRoster,
        EligibilityMutationPolicy:
          EligibilityMutationPolicyProto.FrozenAtOpen,
        OutcomeRule: thresholdElection.OutcomeRule,
        ApprovedClientApplications: [
          { ApplicationId: "hushsocial", Version: "1.0.0" },
        ],
        ProtocolOmegaVersion: "omega-v1.0.0",
        ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    });
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: thresholdSnapshot,
      TrusteeInvitations: [
        {
          Id: "invite-1",
          ElectionId: "election-1",
          TrusteeUserAddress: "trustee-one",
          TrusteeDisplayName: "TrusteeOne",
          InvitedByPublicAddress: "owner-public-key",
          LinkedMessageId: "message-1",
          Status: ElectionTrusteeInvitationStatusProto.Accepted,
          SentAtDraftRevision: 1,
          SentAt: timestamp,
        },
        {
          Id: "invite-2",
          ElectionId: "election-1",
          TrusteeUserAddress: "trustee-two",
          TrusteeDisplayName: "TrusteeTwo",
          InvitedByPublicAddress: "owner-public-key",
          LinkedMessageId: "message-2",
          Status: ElectionTrusteeInvitationStatusProto.Pending,
          SentAtDraftRevision: 1,
          SentAt: timestamp,
        },
      ],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      TrusteeInvitations: [
        ...initialElectionResponse.TrusteeInvitations.filter(
          (invitation) => invitation.Id !== "invite-2",
        ),
        {
          Id: "invite-2",
          ElectionId: "election-1",
          TrusteeUserAddress: "trustee-two",
          TrusteeDisplayName: "TrusteeTwo",
          InvitedByPublicAddress: "owner-public-key",
          LinkedMessageId: "message-2",
          Status: ElectionTrusteeInvitationStatusProto.Accepted,
          SentAtDraftRevision: 1,
          SentAt: timestamp,
        },
      ],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("trustees");
    const trusteeOverview = await screen.findByTestId(
      "elections-trustee-overview",
    );
    expect(trusteeOverview).toHaveTextContent("Accepted trustees");
    expect(trusteeOverview).toHaveTextContent("Pending invitations: 1");
    expect(trusteeOverview).toHaveTextContent("TrusteeTwo");
    expect(trusteeOverview).toHaveTextContent("Pending");

    await waitFor(() => {
      expect(intervalCallbacks.length).toBeGreaterThan(0);
    });

    await act(async () => {
      intervalCallbacks.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(await screen.findByTestId("elections-trustee-overview")).toHaveTextContent(
      "Pending invitations: 0",
    );
    expect(screen.getByTestId("elections-trustee-overview")).toHaveTextContent(
      "Accepted",
    );
  });

  it("refreshes governed proposal approvals on the owner tab without a manual reload", async () => {
    const intervalCallbacks: Array<() => void> = [];
    vi.spyOn(window, "setInterval").mockImplementation(
      ((callback: TimerHandler) => {
        if (typeof callback === "function") {
          intervalCallbacks.push(callback as () => void);
        }
        return 1 as unknown as ReturnType<typeof window.setInterval>;
      }) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const pendingOpenProposal = {
      Id: "proposal-open-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Open,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Draft,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "",
    };
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      GovernedProposals: [pendingOpenProposal],
      GovernedProposalApprovals: [],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      GovernedProposalApprovals: [
        {
          Id: "approval-open-1",
          ProposalId: "proposal-open-1",
          ElectionId: "election-1",
          ActionType: ElectionGovernedActionTypeProto.Open,
          LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Draft,
          TrusteeUserAddress: "trustee-a",
          TrusteeDisplayName: "Alice Trustee",
          ApprovalNote: "Ready to open.",
          ApprovedAt: timestamp,
        },
      ],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).toHaveTextContent("0 of 3 approvals recorded");
    await waitFor(() => {
      expect(intervalCallbacks.length).toBeGreaterThan(0);
    });

    await act(async () => {
      intervalCallbacks.forEach((callback) => callback());
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).toHaveTextContent("1 of 3 approvals recorded");
    expect(screen.getByText("Alice Trustee")).toBeInTheDocument();
    expect(screen.getByText("Note: Ready to open.")).toBeInTheDocument();
  });

  it("refreshes governed proposal approvals when block height advances on the owner tab", async () => {
    vi.spyOn(window, "setInterval").mockImplementation(
      (() => 1 as unknown as ReturnType<typeof window.setInterval>) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );
    const pendingOpenProposal = {
      Id: "proposal-open-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Open,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Draft,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "",
    };
    const firstApproval = {
      Id: "approval-open-1",
      ProposalId: "proposal-open-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Open,
      LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Draft,
      TrusteeUserAddress: "trustee-a",
      TrusteeDisplayName: "Alice Trustee",
      ApprovalNote: "Ready to open.",
      ApprovedAt: timestamp,
    };
    const secondApproval = {
      Id: "approval-open-2",
      ProposalId: "proposal-open-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Open,
      LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Draft,
      TrusteeUserAddress: "trustee-b",
      TrusteeDisplayName: "Bob Trustee",
      ApprovalNote: "Threshold almost there.",
      ApprovedAt: {
        seconds: timestamp.seconds + 30,
        nanos: timestamp.nanos,
      },
    };
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      GovernedProposals: [pendingOpenProposal],
      GovernedProposalApprovals: [firstApproval],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      GovernedProposalApprovals: [firstApproval, secondApproval],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).toHaveTextContent("1 of 3 approvals recorded");
    const initialGetElectionCallCount =
      electionsServiceMock.getElection.mock.calls.length;

    await act(async () => {
      useBlockchainStore.getState().setBlockHeight(3934);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThan(
        initialGetElectionCallCount,
      );
    });
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Open}`,
      ),
    ).toHaveTextContent("2 of 3 approvals recorded");
    expect(screen.getByText("Alice Trustee")).toBeInTheDocument();
    expect(screen.getByText("Bob Trustee")).toBeInTheDocument();
    expect(screen.getByText("Note: Threshold almost there.")).toBeInTheDocument();
  });

  it("refreshes close proposal approvals when block height advances on the owner tab", async () => {
    vi.spyOn(window, "setInterval").mockImplementation(
      (() => 1 as unknown as ReturnType<typeof window.setInterval>) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
        OpenedAt: timestamp,
      },
    );
    const pendingCloseProposal = {
      Id: "proposal-close-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "",
    };
    const firstApproval = {
      Id: "approval-close-1",
      ProposalId: "proposal-close-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
      TrusteeUserAddress: "trustee-a",
      TrusteeDisplayName: "Alice Trustee",
      ApprovalNote: "Close this election.",
      ApprovedAt: timestamp,
    };
    const secondApproval = {
      Id: "approval-close-2",
      ProposalId: "proposal-close-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
      TrusteeUserAddress: "trustee-b",
      TrusteeDisplayName: "Bob Trustee",
      ApprovalNote: "Ready for tally release.",
      ApprovedAt: {
        seconds: timestamp.seconds + 30,
        nanos: timestamp.nanos,
      },
    };
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      GovernedProposals: [pendingCloseProposal],
      GovernedProposalApprovals: [firstApproval],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      GovernedProposalApprovals: [firstApproval, secondApproval],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Open, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Close}`,
      ),
    ).toHaveTextContent("1 of 3 approvals recorded");
    const initialGetElectionCallCount =
      electionsServiceMock.getElection.mock.calls.length;

    await act(async () => {
      useBlockchainStore.getState().setBlockHeight(3935);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThan(
        initialGetElectionCallCount,
      );
    });
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Close}`,
      ),
    ).toHaveTextContent("2 of 3 approvals recorded");
    expect(screen.getByText("Alice Trustee")).toBeInTheDocument();
    expect(screen.getByText("Bob Trustee")).toBeInTheDocument();
    expect(
      screen.getByText("Note: Ready for tally release."),
    ).toBeInTheDocument();
  });

  it("refreshes close-counting share progress when block height advances on the owner governed tab", async () => {
    vi.spyOn(window, "setInterval").mockImplementation(
      (() => 1 as unknown as ReturnType<typeof window.setInterval>) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 2,
        ClosedAt: timestamp,
        CloseArtifactId: "close-artifact",
      },
    );
    const executedCloseProposal = {
      Id: "proposal-close-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "trustee-b",
    };
    const closeSession = createFinalizationSession({
      Id: "close-counting-session-1",
      GovernedProposalId: "proposal-close-1",
      SessionPurpose:
        ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
      Status:
        ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
      RequiredShareCount: 2,
    });
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 2,
        },
      }),
      GovernedProposals: [executedCloseProposal],
      GovernedProposalApprovals: [
        {
          Id: "approval-close-1",
          ProposalId: "proposal-close-1",
          ElectionId: "election-1",
          ActionType: ElectionGovernedActionTypeProto.Close,
          LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
          TrusteeUserAddress: "trustee-a",
          TrusteeDisplayName: "Alice Trustee",
          ApprovalNote: "Close now.",
          ApprovedAt: timestamp,
        },
        {
          Id: "approval-close-2",
          ProposalId: "proposal-close-1",
          ElectionId: "election-1",
          ActionType: ElectionGovernedActionTypeProto.Close,
          LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
          TrusteeUserAddress: "trustee-b",
          TrusteeDisplayName: "Bob Trustee",
          ApprovalNote: "Threshold reached.",
          ApprovedAt: {
            seconds: timestamp.seconds + 20,
            nanos: timestamp.nanos,
          },
        },
      ],
      FinalizationSessions: [closeSession],
      FinalizationShares: [
        createFinalizationShare({
          FinalizationSessionId: "close-counting-session-1",
          TrusteeUserAddress: "trustee-a",
          TrusteeDisplayName: "Alice Trustee",
        }),
      ],
      FinalizationReleaseEvidenceRecords: [],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      FinalizationShares: [
        createFinalizationShare({
          FinalizationSessionId: "close-counting-session-1",
          TrusteeUserAddress: "trustee-a",
          TrusteeDisplayName: "Alice Trustee",
        }),
        createFinalizationShare({
          Id: "finalization-share-2",
          FinalizationSessionId: "close-counting-session-1",
          TrusteeUserAddress: "trustee-b",
          TrusteeDisplayName: "Bob Trustee",
          SubmittedAt: {
            seconds: timestamp.seconds + 60,
            nanos: timestamp.nanos,
          },
          SourceTransactionId: "transaction-3",
          SourceBlockHeight: 12,
          SourceBlockId: "block-3",
        }),
      ],
      FinalizationReleaseEvidenceRecords: [
        createFinalizationReleaseEvidence({
          FinalizationSessionId: "close-counting-session-1",
          SessionPurpose:
            ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
          AcceptedShareCount: 2,
        }),
      ],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Closed, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId("elections-governed-close-share-progress"),
    ).toHaveTextContent("1 accepted / 2 eligible trustees");
    const initialGetElectionCallCount =
      electionsServiceMock.getElection.mock.calls.length;

    await act(async () => {
      useBlockchainStore.getState().setBlockHeight(3936);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThan(
        initialGetElectionCallCount,
      );
    });
    const closeShareProgress = await screen.findByTestId(
      "elections-governed-close-share-progress",
    );
    expect(closeShareProgress).toHaveTextContent("2 accepted / 2 eligible trustees");
    expect(closeShareProgress).toHaveTextContent("Bob Trustee");
    expect(closeShareProgress).toHaveTextContent("Aggregate tally release completed");
  });

  it("refreshes finalize proposal approvals when block height advances on the owner tab", async () => {
    vi.spyOn(window, "setInterval").mockImplementation(
      (() => 1 as unknown as ReturnType<typeof window.setInterval>) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );

    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
        ClosedAt: timestamp,
        CloseArtifactId: "close-artifact",
        TallyReadyAt: {
          seconds: timestamp.seconds + 90,
          nanos: timestamp.nanos,
        },
      },
    );
    const pendingFinalizeProposal = {
      Id: "proposal-finalize-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Finalize,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Closed,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "",
    };
    const firstApproval = {
      Id: "approval-finalize-1",
      ProposalId: "proposal-finalize-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Finalize,
      LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Closed,
      TrusteeUserAddress: "trustee-a",
      TrusteeDisplayName: "Alice Trustee",
      ApprovalNote: "Ready to finalize.",
      ApprovedAt: timestamp,
    };
    const secondApproval = {
      Id: "approval-finalize-2",
      ProposalId: "proposal-finalize-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Finalize,
      LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Closed,
      TrusteeUserAddress: "trustee-b",
      TrusteeDisplayName: "Bob Trustee",
      ApprovalNote: "Looks correct.",
      ApprovedAt: {
        seconds: timestamp.seconds + 30,
        nanos: timestamp.nanos,
      },
    };
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      GovernedProposals: [pendingFinalizeProposal],
      GovernedProposalApprovals: [firstApproval],
    });
    const updatedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      GovernedProposalApprovals: [firstApproval, secondApproval],
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Closed, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(updatedElectionResponse)
      .mockResolvedValue(updatedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Finalize}`,
      ),
    ).toHaveTextContent("1 of 3 approvals recorded");
    const initialGetElectionCallCount =
      electionsServiceMock.getElection.mock.calls.length;

    await act(async () => {
      useBlockchainStore.getState().setBlockHeight(3937);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(electionsServiceMock.getElection.mock.calls.length).toBeGreaterThan(
        initialGetElectionCallCount,
      );
    });
    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Finalize}`,
      ),
    ).toHaveTextContent("2 of 3 approvals recorded");
    expect(screen.getByText("Alice Trustee")).toBeInTheDocument();
    expect(screen.getByText("Bob Trustee")).toBeInTheDocument();
    expect(screen.getByText("Note: Looks correct.")).toBeInTheDocument();
  });

  it("keeps close-counting progress hidden until close has actually started", async () => {
    const thresholdOpenElection = createElectionRecord(
      ElectionLifecycleStateProto.Open,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 2,
        OpenedAt: timestamp,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Open, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: thresholdOpenElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdOpenElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 2,
          },
        }),
        GovernedProposals: [],
        GovernedProposalApprovals: [],
        FinalizationSessions: [],
        FinalizationShares: [],
        FinalizationReleaseEvidenceRecords: [],
      }),
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");

    expect(
      await screen.findByTestId(
        `elections-governed-card-${ElectionGovernedActionTypeProto.Close}`,
      ),
    ).toHaveTextContent("Start Close");
    expect(
      screen.queryByTestId("elections-governed-close-share-progress"),
    ).not.toBeInTheDocument();
  });

  it("shows the close-counting share progress on the close card after close starts", async () => {
    const thresholdClosedElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 2,
        ClosedAt: timestamp,
        CloseArtifactId: "close-artifact",
      },
    );
    const executedCloseProposal = {
      Id: "proposal-close-1",
      ElectionId: "election-1",
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: "owner-public-key",
      CreatedAt: timestamp,
      ExecutionStatus:
        ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
      ExecutionFailureReason: "",
      LastExecutionTriggeredByPublicAddress: "trustee-b",
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Closed, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: thresholdClosedElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdClosedElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 2,
          },
        }),
        GovernedProposals: [executedCloseProposal],
        GovernedProposalApprovals: [
          {
            Id: "approval-close-1",
            ProposalId: "proposal-close-1",
            ElectionId: "election-1",
            ActionType: ElectionGovernedActionTypeProto.Close,
            LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
            TrusteeUserAddress: "trustee-a",
            TrusteeDisplayName: "Alice Trustee",
            ApprovalNote: "Close now.",
            ApprovedAt: timestamp,
          },
          {
            Id: "approval-close-2",
            ProposalId: "proposal-close-1",
            ElectionId: "election-1",
            ActionType: ElectionGovernedActionTypeProto.Close,
            LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
            TrusteeUserAddress: "trustee-b",
            TrusteeDisplayName: "Bob Trustee",
            ApprovalNote: "Threshold reached.",
            ApprovedAt: {
              seconds: timestamp.seconds + 20,
              nanos: timestamp.nanos,
            },
          },
        ],
        FinalizationSessions: [
          createFinalizationSession({
            Id: "close-counting-session-1",
            GovernedProposalId: "proposal-close-1",
            SessionPurpose:
              ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
            Status:
              ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
            RequiredShareCount: 2,
          }),
        ],
        FinalizationShares: [
          createFinalizationShare({
            FinalizationSessionId: "close-counting-session-1",
            TrusteeUserAddress: "trustee-a",
            TrusteeDisplayName: "Alice Trustee",
          }),
        ],
        FinalizationReleaseEvidenceRecords: [],
      }),
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    fireEvent.click(await screen.findByTestId("election-summary-election-1"));
    await openOwnerDetailTab("governed");

    const closeShareProgress = await screen.findByTestId(
      "elections-governed-close-share-progress",
    );
    expect(closeShareProgress).toHaveTextContent("Close-counting shares");
    expect(closeShareProgress).toHaveTextContent("1 accepted / 2 eligible trustees");
    expect(closeShareProgress).toHaveTextContent("Alice Trustee");
    expect(closeShareProgress).toHaveTextContent("Accepted");
    expect(closeShareProgress).toHaveTextContent("Bob Trustee");
    expect(closeShareProgress).toHaveTextContent("Pending share submission");
  });

  it("shows the weak-trustee warning and keeps trustee-only controls out of the owner workspace", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: thresholdElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 3,
          },
        }),
        TrusteeInvitations: [
          {
            Id: "invite-1",
            ElectionId: "election-1",
            TrusteeUserAddress: "trustee-a",
            TrusteeDisplayName: "Alice Trustee",
            InvitedByPublicAddress: "owner-public-key",
            LinkedMessageId: "message-1",
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
          {
            Id: "invite-2",
            ElectionId: "election-1",
            TrusteeUserAddress: "trustee-b",
            TrusteeDisplayName: "Bob Trustee",
            InvitedByPublicAddress: "owner-public-key",
            LinkedMessageId: "message-2",
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
          {
            Id: "invite-3",
            ElectionId: "election-1",
            TrusteeUserAddress: "trustee-c",
            TrusteeDisplayName: "Charlie Trustee",
            InvitedByPublicAddress: "owner-public-key",
            LinkedMessageId: "message-3",
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
        ],
        CeremonyProfiles: [
          {
            ProfileId: "dkg-prod-3of5",
            DisplayName: "Production 3 of 5",
            Description: "Production rollout profile",
            ProviderKey: "provider-a",
            ProfileVersion: "v1",
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            DevOnly: false,
            RegisteredAt: timestamp,
            LastUpdatedAt: timestamp,
          },
        ],
      }),
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse(),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("ceremony");
    expect(
      await screen.findByTestId("elections-ceremony-warning-card"),
    ).toHaveTextContent("Opening can still proceed when the ceremony is ready");
    expect(
      screen.queryByTestId("trustee-ceremony-export-button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Record share export")).not.toBeInTheDocument();
  });

  it("shows the bound FEAT-098 finalization session in the owner workspace", async () => {
    const thresholdClosedElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 2,
        ClosedAt: timestamp,
        CloseArtifactId: "close-artifact",
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Closed, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: thresholdClosedElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdClosedElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 2,
          },
        }),
        FinalizationSessions: [createFinalizationSession()],
        FinalizationShares: [createFinalizationShare()],
        FinalizationReleaseEvidenceRecords: [
          createFinalizationReleaseEvidence(),
        ],
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("finalization");
    const finalizationSection = await screen.findByTestId(
      "elections-finalization-section",
    );
    expect(finalizationSection).toHaveTextContent("Counting And Finalization");
    expect(finalizationSection.className).not.toContain("border-hush-bg-light");
    expect(finalizationSection).toHaveTextContent("Finalize");
    expect(
      screen.getByTestId("elections-finalization-session"),
    ).toHaveTextContent("close-artifact");
    expect(
      screen.getByTestId("elections-finalization-session"),
    ).toHaveTextContent("aggregate-tally-1");
    expect(
      screen.getByTestId("elections-finalization-session"),
    ).toHaveTextContent("2 accepted / 2 expected");
    expect(
      screen.getByTestId("elections-finalization-session"),
    ).toHaveTextContent("Trustee threshold satisfied");
    expect(
      screen.getByTestId("elections-finalization-session"),
    ).toHaveTextContent("Alice Trustee");
    expect(
      screen.getByTestId("elections-finalization-session"),
    ).toHaveTextContent("Release evidence recorded");
  });

  it("shows the blocked FEAT-098 reason when tally readiness is missing", async () => {
    const thresholdClosedElection = createElectionRecord(
      ElectionLifecycleStateProto.Closed,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 2,
        ClosedAt: timestamp,
        CloseArtifactId: "close-artifact",
        TallyReadyAt: undefined,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Closed, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: thresholdClosedElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType:
              EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy:
              EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdClosedElection.OutcomeRule,
            ApprovedClientApplications: [
              { ApplicationId: "hushsocial", Version: "1.0.0" },
            ],
            ProtocolOmegaVersion: "omega-v1.0.0",
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy:
              ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 2,
          },
        }),
        FinalizationSessions: [],
        FinalizationShares: [],
        FinalizationReleaseEvidenceRecords: [],
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("finalization");
    expect(
      await screen.findByTestId("elections-finalization-blocked"),
    ).toHaveTextContent(
      "Finalize remains unavailable until tally readiness is recorded.",
    );
  });

  it("requires explicit confirmation before restarting a ceremony version", async () => {
    const thresholdElection = createElectionRecord(
      ElectionLifecycleStateProto.Draft,
      {
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        ReviewWindowPolicy:
          ReviewWindowPolicyProto.GovernedReviewWindowReserved,
        RequiredApprovalCount: 3,
      },
    );

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    const initialElectionResponse = createElectionResponse({
      Election: thresholdElection,
      LatestDraftSnapshot: createDraftSnapshot({
        Policy: {
          ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
          BindingStatus: ElectionBindingStatusProto.Binding,
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
          DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
          ParticipationPrivacyMode:
            ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
          VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
          EligibilitySourceType:
            EligibilitySourceTypeProto.OrganizationImportedRoster,
          EligibilityMutationPolicy:
            EligibilityMutationPolicyProto.FrozenAtOpen,
          OutcomeRule: thresholdElection.OutcomeRule,
          ApprovedClientApplications: [
            { ApplicationId: "hushsocial", Version: "1.0.0" },
          ],
          ProtocolOmegaVersion: "omega-v1.0.0",
          ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
          ReviewWindowPolicy:
            ReviewWindowPolicyProto.GovernedReviewWindowReserved,
          RequiredApprovalCount: 3,
        },
      }),
      CeremonyProfiles: [
        {
          ProfileId: "dkg-prod-3of5",
          DisplayName: "Production 3 of 5",
          Description: "Production rollout profile",
          ProviderKey: "provider-a",
          ProfileVersion: "v1",
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          DevOnly: false,
          RegisteredAt: timestamp,
          LastUpdatedAt: timestamp,
        },
      ],
      CeremonyVersions: [
        {
          Id: "ceremony-version-1",
          ElectionId: "election-1",
          VersionNumber: 4,
          ProfileId: "dkg-prod-3of5",
          Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          BoundTrustees: [],
          StartedByPublicAddress: "owner-public-key",
          StartedAt: timestamp,
          SupersededReason: "",
          TallyPublicKeyFingerprint: "",
        },
      ],
      ActiveCeremonyTrusteeStates: [createCeremonyTrusteeState()],
    });
    const indexedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      CeremonyVersions: [
        {
          Id: "ceremony-version-2",
          ElectionId: "election-1",
          VersionNumber: 5,
          ProfileId: "dkg-prod-3of5",
          Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          BoundTrustees: [],
          StartedByPublicAddress: "owner-public-key",
          StartedAt: timestamp,
          SupersededReason: "",
          TallyPublicKeyFingerprint: "",
        },
      ],
      ActiveCeremonyTrusteeStates: [],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(indexedElectionResponse)
      .mockResolvedValue(indexedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        OwnerActions: [
          {
            ActionType:
              ElectionCeremonyActionTypeProto.CeremonyActionStartVersion,
            IsAvailable: false,
            IsCompleted: false,
            Reason: "An active version already exists.",
          },
          {
            ActionType:
              ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion,
            IsAvailable: true,
            IsCompleted: false,
            Reason: "Supersede the current progress and restart.",
          },
        ],
      }),
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />,
    );

    await openOwnerDetailTab("ceremony");
    expect(
      await screen.findByTestId("elections-ceremony-section"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("elections-ceremony-restart-button"));

    expect(
      screen.getByTestId("elections-ceremony-restart-reason"),
    ).toBeInTheDocument();
    expect(
      transactionServiceMock.createRestartElectionCeremonyTransaction,
    ).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("elections-ceremony-confirm-button"));

    await waitFor(() => {
      expect(
        transactionServiceMock.createRestartElectionCeremonyTransaction,
      ).toHaveBeenCalledWith(
        "election-1",
        "owner-public-key",
        "owner-encryption-key",
        "owner-encryption-private-key",
        "dkg-prod-3of5",
        "Supersede the current version and restart.",
        "owner-private-key",
      );
    });
  });
});

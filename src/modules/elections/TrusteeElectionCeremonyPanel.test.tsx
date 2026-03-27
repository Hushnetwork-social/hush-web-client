import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionCeremonyShareCustody,
  ElectionCeremonyTrusteeState,
  ElectionCommandResponse,
  ElectionRecordView,
  GetElectionCeremonyActionViewResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyShareCustodyStatusProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { TrusteeElectionCeremonyPanel } from './TrusteeElectionCeremonyPanel';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    completeElectionCeremonyTrustee: vi.fn(),
    getElection: vi.fn(),
    getElectionCeremonyActionView: vi.fn(),
    joinElectionCeremony: vi.fn(),
    publishElectionCeremonyTransportKey: vi.fn(),
    recordElectionCeremonySelfTestSuccess: vi.fn(),
    recordElectionCeremonyShareExport: vi.fn(),
    submitElectionCeremonyMaterial: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Draft,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
    OutcomeRule: {
      Kind: OutcomeRuleKindProto.PassFail,
      TemplateKey: 'pass_fail_yes_no',
      SeatCount: 1,
      BlankVoteCountsForTurnout: true,
      BlankVoteExcludedFromWinnerSelection: true,
      BlankVoteExcludedFromThresholdDenominator: true,
      TieResolutionRule: 'tie_unresolved',
      CalculationBasis: 'simple_majority_of_non_blank_votes',
    },
    ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
    ProtocolOmegaVersion: 'omega-v1.0.0',
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
    CurrentDraftRevision: 1,
    Options: [
      {
        OptionId: 'yes',
        DisplayLabel: 'Yes',
        ShortDescription: '',
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: 'no',
        DisplayLabel: 'No',
        ShortDescription: '',
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 3,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenArtifactId: '',
    CloseArtifactId: '',
    FinalizeArtifactId: '',
    ...overrides,
  };
}

function createElectionResponse(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [
      {
        Id: 'ceremony-version-1',
        ElectionId: 'election-1',
        VersionNumber: 4,
        ProfileId: 'prod-3of5-v1',
        Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
        TrusteeCount: 5,
        RequiredApprovalCount: 3,
        BoundTrustees: [
          {
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
          },
          {
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Bob Trustee',
          },
        ],
        StartedByPublicAddress: 'owner-public-key',
        StartedAt: timestamp,
        SupersededReason: '',
        TallyPublicKeyFingerprint: '',
      },
    ],
    CeremonyTranscriptEvents: [
      {
        Id: 'event-1',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 4,
        EventType: 0,
        ActorPublicAddress: 'owner-public-key',
        TrusteeUserAddress: '',
        TrusteeDisplayName: '',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateNotStarted,
        EventSummary: 'Owner started the ceremony version.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: timestamp,
        HasTrusteeState: false,
      },
    ],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

function createCeremonyTrusteeState(
  overrides?: Partial<ElectionCeremonyTrusteeState>
): ElectionCeremonyTrusteeState {
  return {
    Id: 'trustee-state-1',
    ElectionId: 'election-1',
    CeremonyVersionId: 'ceremony-version-1',
    TrusteeUserAddress: 'trustee-a',
    TrusteeDisplayName: 'Alice Trustee',
    State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
    TransportPublicKeyFingerprint: 'transport-key-fingerprint-v1',
    TransportPublicKeyPublishedAt: timestamp,
    JoinedAt: timestamp,
    ValidationFailureReason: '',
    ShareVersion: '',
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createShareCustody(
  overrides?: Partial<ElectionCeremonyShareCustody>
): ElectionCeremonyShareCustody {
  return {
    Id: 'share-custody-1',
    ElectionId: 'election-1',
    CeremonyVersionId: 'ceremony-version-1',
    TrusteeUserAddress: 'trustee-a',
    ShareVersion: 'share-v1',
    PasswordProtected: true,
    Status: ElectionCeremonyShareCustodyStatusProto.ShareCustodyNotExported,
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createActionViewResponse(
  overrides?: Partial<GetElectionCeremonyActionViewResponse>
): GetElectionCeremonyActionViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorRole: ElectionCeremonyActorRoleProto.CeremonyActorTrustee,
    ActorPublicAddress: 'trustee-a',
    ActiveCeremonyVersion: {
      Id: 'ceremony-version-1',
      ElectionId: 'election-1',
      VersionNumber: 4,
      ProfileId: 'prod-3of5-v1',
      Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
      TrusteeCount: 5,
      RequiredApprovalCount: 3,
      BoundTrustees: [
        {
          TrusteeUserAddress: 'trustee-a',
          TrusteeDisplayName: 'Alice Trustee',
        },
        {
          TrusteeUserAddress: 'trustee-b',
          TrusteeDisplayName: 'Bob Trustee',
        },
      ],
      StartedByPublicAddress: 'owner-public-key',
      StartedAt: timestamp,
      SupersededReason: '',
      TallyPublicKeyFingerprint: '',
    },
    OwnerActions: [],
    TrusteeActions: [
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
        IsAvailable: true,
        IsCompleted: false,
        Reason: 'Publish your transport key.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Publish the transport key first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Join the version first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Run the self-test first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Complete the ceremony first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'No encrypted backup is recorded yet.',
      },
    ],
    PendingIncomingMessageCount: 1,
    BlockedReasons: [],
    SelfTrusteeState: createCeremonyTrusteeState(),
    SelfShareCustody: createShareCustody(),
    ...overrides,
  };
}

function createCommandResponse(overrides?: Partial<ElectionCommandResponse>): ElectionCommandResponse {
  return {
    Success: true,
    ErrorCode: 0,
    ErrorMessage: '',
    ValidationErrors: [],
    Election: createElectionRecord(),
    CeremonyTranscriptEvents: [],
    ...overrides,
  };
}

describe('TrusteeElectionCeremonyPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.clearAllMocks();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(createActionViewResponse());
    electionsServiceMock.publishElectionCeremonyTransportKey.mockResolvedValue(createCommandResponse());
    electionsServiceMock.joinElectionCeremony.mockResolvedValue(createCommandResponse());
    electionsServiceMock.recordElectionCeremonySelfTestSuccess.mockResolvedValue(
      createCommandResponse()
    );
    electionsServiceMock.submitElectionCeremonyMaterial.mockResolvedValue(createCommandResponse());
    electionsServiceMock.completeElectionCeremonyTrustee.mockResolvedValue(createCommandResponse());
    electionsServiceMock.recordElectionCeremonyShareExport.mockResolvedValue(createCommandResponse());
  });

  it('renders the ordered trustee ceremony step flow', async () => {
    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-summary')).toHaveTextContent(
      'Governed Referendum'
    );
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Publish transport key');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Join version');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Run self-test');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Submit material');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Export share backup');
  });

  it('shows validation-failed recovery guidance', async () => {
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createActionViewResponse({
        TrusteeActions: [
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already published.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already joined.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
            IsAvailable: true,
            IsCompleted: false,
            Reason: 'Run the self-test again before resubmitting.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Fix the failed submission first.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Complete the ceremony first.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'No encrypted backup is recorded yet.',
          },
        ],
        SelfTrusteeState: createCeremonyTrusteeState({
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed,
          ValidationFailedAt: timestamp,
          ValidationFailureReason: 'Wrong version binding.',
        }),
      })
    );

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-validation-failed')).toHaveTextContent(
      'Wrong version binding.'
    );
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent(
      'Run the self-test again before resubmitting.'
    );
  });

  it('shows completion and records the share export action', async () => {
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createActionViewResponse({
        TrusteeActions: [
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already published.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already joined.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already completed.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already submitted.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
            IsAvailable: true,
            IsCompleted: false,
            Reason: 'Export the encrypted backup now.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Import is not needed right now.',
          },
        ],
        SelfTrusteeState: createCeremonyTrusteeState({
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted,
          CompletedAt: timestamp,
          ShareVersion: 'share-v1',
        }),
        SelfShareCustody: createShareCustody({
          ShareVersion: 'share-v1',
          Status: ElectionCeremonyShareCustodyStatusProto.ShareCustodyNotExported,
        }),
      })
    );

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-summary')).toHaveTextContent('Completed');

    fireEvent.click(screen.getByTestId('trustee-ceremony-export-button'));

    await waitFor(() => {
      expect(electionsServiceMock.recordElectionCeremonyShareExport).toHaveBeenCalledWith({
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        ActorPublicAddress: 'trustee-a',
        ShareVersion: 'share-v1',
      });
    });
  });
});

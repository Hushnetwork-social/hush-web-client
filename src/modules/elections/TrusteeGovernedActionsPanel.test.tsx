import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectionRecordView, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionGovernanceModeProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { useBlockchainStore } from '@/modules/blockchain/useBlockchainStore';
import { TrusteeGovernedActionsPanel } from './TrusteeGovernedActionsPanel';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
  },
  blockchainServiceMock: {
    submitTransaction: vi.fn(),
  },
  transactionServiceMock: {
    createApproveElectionGovernedProposalTransaction: vi.fn(),
    createSubmitElectionFinalizationShareTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => blockchainServiceMock.submitTransaction(...args),
}));

vi.mock('./transactionService', () => ({
  createApproveElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createApproveElectionGovernedProposalTransaction(...args),
  createSubmitElectionFinalizationShareTransaction: (...args: unknown[]) =>
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction(...args),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };
const laterTimestamp = { seconds: 1_711_410_600, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Open,
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
    Options: [],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 3,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: timestamp,
    OpenArtifactId: 'open-artifact',
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
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    FinalizationSessions: [],
    FinalizationShares: [],
    FinalizationReleaseEvidenceRecords: [],
    ResultArtifacts: [],
    ...overrides,
  };
}

function createCloseCountingSession() {
  return {
    Id: 'close-counting-session-1',
    ElectionId: 'election-1',
    GovernedProposalId: 'proposal-close',
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
    CloseArtifactId: 'close-artifact-1',
    AcceptedBallotSetHash: 'accepted-ballot-set-hash',
    FinalEncryptedTallyHash: 'encrypted-tally-hash',
    TargetTallyId: 'aggregate-tally-1',
    CeremonySnapshot: undefined,
    RequiredShareCount: 3,
    EligibleTrustees: [
      {
        TrusteeUserAddress: 'trustee-a',
        TrusteeDisplayName: 'Alice Trustee',
      },
    ],
    Status: ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
    CreatedAt: laterTimestamp,
    CreatedByPublicAddress: 'owner-public-key',
    CompletedAt: undefined,
    ReleaseEvidenceId: '',
    LatestTransactionId: 'transaction-1',
    LatestBlockHeight: 100,
    LatestBlockId: 'block-100',
  };
}

describe('TrusteeGovernedActionsPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    useBlockchainStore.getState().reset();
    vi.clearAllMocks();
  });

  it('keeps the current approval-required action expanded and older missed actions collapsed', async () => {
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        GovernedProposals: [
          {
            Id: 'proposal-close',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Close,
            LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
            ProposedByPublicAddress: 'owner-public-key',
            CreatedAt: laterTimestamp,
            ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
            ExecutionFailureReason: '',
            LastExecutionTriggeredByPublicAddress: '',
          },
          {
            Id: 'proposal-open',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Open,
            LifecycleStateAtCreation: ElectionLifecycleStateProto.Draft,
            ProposedByPublicAddress: 'owner-public-key',
            CreatedAt: timestamp,
            ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
            ExecutionFailureReason: '',
            LastExecutionTriggeredByPublicAddress: 'owner-public-key',
          },
        ],
      })
    );

    render(
      <TrusteeGovernedActionsPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByText('Trustee Governed Actions')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-governed-toggle-proposal-close')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByTestId('trustee-governed-section-proposal-close')).toHaveTextContent(
      'Approval required'
    );
    expect(screen.getByTestId('trustee-governed-action-proposal-close')).toHaveAttribute(
      'href',
      '/elections/election-1/trustee/proposal/proposal-close'
    );
    expect(screen.getByTestId('trustee-governed-toggle-proposal-open')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByTestId('trustee-governed-section-proposal-open')).toHaveTextContent(
      'Missed after execution'
    );
  });

  it('refreshes from approval-recorded to tally-share-required when close reaches threshold', async () => {
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          GovernedProposals: [
            {
              Id: 'proposal-close',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
              ProposedByPublicAddress: 'owner-public-key',
              CreatedAt: laterTimestamp,
              ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
              ExecutionFailureReason: '',
              LastExecutionTriggeredByPublicAddress: '',
            },
          ],
          GovernedProposalApprovals: [
            {
              Id: 'approval-1',
              ProposalId: 'proposal-close',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
              ApprovalNote: '',
              ApprovedAt: timestamp,
            },
          ],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: createElectionRecord({
            LifecycleState: ElectionLifecycleStateProto.Closed,
            ClosedAt: laterTimestamp,
            CloseArtifactId: 'close-artifact-1',
          }),
          GovernedProposals: [
            {
              Id: 'proposal-close',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
              ProposedByPublicAddress: 'owner-public-key',
              CreatedAt: laterTimestamp,
              ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
              ExecutionFailureReason: '',
              LastExecutionTriggeredByPublicAddress: 'owner-public-key',
            },
          ],
          GovernedProposalApprovals: [
            {
              Id: 'approval-1',
              ProposalId: 'proposal-close',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
              ApprovalNote: '',
              ApprovedAt: timestamp,
            },
          ],
          FinalizationSessions: [createCloseCountingSession()],
        })
      );

    render(
      <TrusteeGovernedActionsPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-governed-section-proposal-close')).toHaveTextContent(
      'Approval recorded'
    );

    await act(async () => {
      useBlockchainStore.getState().setBlockHeight(200);
    });

    expect(
      await screen.findByTestId('trustee-governed-section-proposal-close')
    ).toHaveTextContent('Tally share required');
    expect(screen.getByTestId('trustee-governed-toggle-proposal-close')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByTestId('trustee-governed-action-proposal-close')).toHaveAttribute(
      'href',
      '/elections/election-1/trustee/finalization'
    );
    expect(screen.getByTestId('trustee-governed-close-follow-up-proposal-close')).toHaveTextContent(
      '0 of 3'
    );
  });

  it('shows the trustee proof when a historical approved action is expanded', async () => {
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        GovernedProposals: [
          {
            Id: 'proposal-open',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Open,
            LifecycleStateAtCreation: ElectionLifecycleStateProto.Draft,
            ProposedByPublicAddress: 'owner-public-key',
            CreatedAt: timestamp,
            ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
            ExecutionFailureReason: '',
            LastExecutionTriggeredByPublicAddress: 'owner-public-key',
          },
        ],
        GovernedProposalApprovals: [
          {
            Id: 'approval-1',
            ProposalId: 'proposal-open',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Open,
            LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Draft,
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            ApprovalNote: 'Ready to open.',
            ApprovedAt: timestamp,
          },
        ],
      })
    );

    render(
      <TrusteeGovernedActionsPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-governed-section-proposal-open')).toHaveTextContent(
      'Approved and executed'
    );

    fireEvent.click(screen.getByTestId('trustee-governed-toggle-proposal-open'));

    await waitFor(() => {
      expect(screen.getByTestId('trustee-governed-toggle-proposal-open')).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });
    expect(screen.getByTestId('trustee-governed-section-proposal-open')).toHaveTextContent(
      'Approval recorded at'
    );
    expect(screen.getByTestId('trustee-governed-section-proposal-open')).toHaveTextContent(
      'Ready to open.'
    );
  });

  it('shows an empty state before the owner starts any governed action', async () => {
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());

    render(
      <TrusteeGovernedActionsPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-governed-empty-state')).toHaveTextContent(
      'No governed actions are recorded for this election yet.'
    );
  });

  it('shows recorded tally-share evidence after close-counting submission', async () => {
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createElectionRecord({
          LifecycleState: ElectionLifecycleStateProto.Closed,
          ClosedAt: laterTimestamp,
          CloseArtifactId: 'close-artifact-1',
        }),
        GovernedProposals: [
          {
            Id: 'proposal-close',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Close,
            LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
            ProposedByPublicAddress: 'owner-public-key',
            CreatedAt: laterTimestamp,
            ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
            ExecutionFailureReason: '',
            LastExecutionTriggeredByPublicAddress: 'owner-public-key',
          },
        ],
        GovernedProposalApprovals: [
          {
            Id: 'approval-1',
            ProposalId: 'proposal-close',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Close,
            LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            ApprovalNote: '',
            ApprovedAt: timestamp,
          },
        ],
        FinalizationSessions: [createCloseCountingSession()],
        FinalizationShares: [
          {
            Id: 'share-1',
            FinalizationSessionId: 'close-counting-session-1',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            TargetTallyId: 'aggregate-tally-1',
            Status: ElectionFinalizationShareStatusProto.FinalizationShareAccepted,
            ShareMaterial: 'debug-share-material',
            SubmittedAt: laterTimestamp,
            ReleasedAt: undefined,
            TransactionId: 'transaction-share-1',
            BlockHeight: 110,
            BlockId: 'block-110',
          },
        ],
      })
    );

    render(
      <TrusteeGovernedActionsPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-governed-section-proposal-close')).toHaveTextContent(
      'Tally share recorded'
    );

    fireEvent.click(screen.getByTestId('trustee-governed-toggle-proposal-close'));

    expect(await screen.findByTestId('trustee-governed-close-follow-up-proposal-close')).toHaveTextContent(
      'Accepted'
    );
    expect(screen.getByTestId('trustee-governed-close-follow-up-proposal-close')).toHaveTextContent(
      'Submitted at'
    );
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectionRecordView, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
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
import { TrusteeGovernedProposalPanel } from './TrusteeGovernedProposalPanel';
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
    RequiredApprovalCount: 2,
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
    GovernedProposals: [
      {
        Id: 'proposal-1',
        ElectionId: 'election-1',
        ActionType: ElectionGovernedActionTypeProto.Close,
        LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
        ProposedByPublicAddress: 'owner-public-key',
        CreatedAt: timestamp,
        ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
        ExecutionFailureReason: '',
        LastExecutionTriggeredByPublicAddress: '',
      },
    ],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

describe('TrusteeGovernedProposalPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.clearAllMocks();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    blockchainServiceMock.submitTransaction.mockResolvedValue({ successful: true, message: 'Accepted' });
    transactionServiceMock.createApproveElectionGovernedProposalTransaction.mockResolvedValue({
      signedTransaction: 'signed-approve-governed-proposal-transaction',
    });
  });

  it('loads the proposal detail and submits a trustee approval with the note', async () => {
    electionsServiceMock.getElection
      .mockResolvedValueOnce(createElectionResponse())
      .mockResolvedValue(
        createElectionResponse({
          GovernedProposalApprovals: [
            {
              Id: 'approval-1',
              ProposalId: 'proposal-1',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
              ApprovalNote: 'Ready to approve.',
              ApprovedAt: timestamp,
            },
          ],
        })
      );

    render(
      <TrusteeGovernedProposalPanel
        electionId="election-1"
        proposalId="proposal-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-a-encryption-key"
        actorEncryptionPrivateKey="trustee-a-encryption-private-key"
        actorSigningPrivateKey="trustee-a-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-proposal-summary')).toHaveTextContent(
      'Governed Referendum'
    );

    fireEvent.change(screen.getByTestId('trustee-approval-note'), {
      target: { value: 'Ready to approve.' },
    });
    fireEvent.click(screen.getByTestId('trustee-approve-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createApproveElectionGovernedProposalTransaction).toHaveBeenCalledWith(
        'election-1',
        'proposal-1',
        'trustee-a',
        'trustee-a-encryption-key',
        'trustee-a-encryption-private-key',
        'Ready to approve.',
        'trustee-a-private-key'
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-approve-governed-proposal-transaction'
    );
  });

  it('shows the FEAT-098 follow-up link for finalize proposals', async () => {
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        GovernedProposals: [
          {
            Id: 'proposal-finalize-1',
            ElectionId: 'election-1',
            ActionType: ElectionGovernedActionTypeProto.Finalize,
            LifecycleStateAtCreation: ElectionLifecycleStateProto.Closed,
            ProposedByPublicAddress: 'owner-public-key',
            CreatedAt: timestamp,
            ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
            ExecutionFailureReason: '',
            LastExecutionTriggeredByPublicAddress: '',
          },
        ],
      })
    );

    render(
      <TrusteeGovernedProposalPanel
        electionId="election-1"
        proposalId="proposal-finalize-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-a-encryption-key"
        actorEncryptionPrivateKey="trustee-a-encryption-private-key"
        actorSigningPrivateKey="trustee-a-private-key"
      />
    );

    const followUpLink = await screen.findByTestId('trustee-proposal-finalization-link');
    expect(followUpLink).toHaveAttribute(
      'href',
      '/elections/election-1/trustee/finalization'
    );
    expect(followUpLink).toHaveTextContent('Open finalization page');
  });
});

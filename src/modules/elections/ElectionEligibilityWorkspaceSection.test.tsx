import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionActorLinkMultiplicityPolicyProto,
  ElectionBindingStatusProto,
  ElectionCheckoffVisibilityPolicyProto,
  ElectionClassProto,
  ElectionContactCodeProviderReadinessProto,
  ElectionDisclosureModeProto,
  ElectionEligibilityActorRoleProto,
  ElectionGovernanceModeProto,
  ElectionIdentityLinkPolicyProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionVotingRightStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
  type GetElectionEligibilityViewResponse,
  type GetElectionResponse,
} from '@/lib/grpc';
import { ElectionEligibilityWorkspaceSection } from './ElectionEligibilityWorkspaceSection';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionEligibilityView: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: vi.fn(),
}));

vi.mock('./transactionService', async () => {
  const actual = await vi.importActual<typeof import('./transactionService')>('./transactionService');
  return {
    ...actual,
    createActivateElectionRosterEntryTransaction: vi.fn(),
    createImportElectionRosterTransaction: vi.fn(),
  };
});

const timestamp = { seconds: 1_774_120_000, nanos: 0 };

function createDetail(): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: {
      ElectionId: 'election-1',
      Title: 'Annual Elections 2026',
      ShortDescription: 'Association-wide vote',
      OwnerPublicAddress: 'owner-public-key',
      ExternalReferenceCode: 'ORG-2026-01',
      LifecycleState: ElectionLifecycleStateProto.Draft,
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: {
        Kind: OutcomeRuleKindProto.SingleWinner,
        TemplateKey: 'single_winner',
        SeatCount: 1,
        BlankVoteCountsForTurnout: true,
        BlankVoteExcludedFromWinnerSelection: true,
        BlankVoteExcludedFromThresholdDenominator: false,
        TieResolutionRule: 'tie_unresolved',
        CalculationBasis: 'highest_non_blank_votes',
      },
      ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
      ProtocolOmegaVersion: 'omega-v1.0.0',
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
      CurrentDraftRevision: 1,
      Options: [],
      AcknowledgedWarningCodes: [],
      CreatedAt: timestamp,
      LastUpdatedAt: timestamp,
      OpenArtifactId: '',
      CloseArtifactId: '',
      FinalizeArtifactId: '',
    },
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
  };
}

function createEligibilityView(): GetElectionEligibilityViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'owner-public-key',
    ActorRole: ElectionEligibilityActorRoleProto.EligibilityActorOwner,
    CanImportRoster: true,
    CanActivateRoster: false,
    CanReviewRestrictedRoster: true,
    CanClaimIdentity: false,
    UsesTemporaryVerificationCode: true,
    TemporaryVerificationCode: '1111',
    Summary: {
      RosteredCount: 2,
      LinkedCount: 1,
      ActiveCount: 2,
      ActiveAtOpenCount: 0,
      CurrentDenominatorCount: 2,
      CountedParticipationCount: 0,
      BlankCount: 0,
      DidNotVoteCount: 2,
      ActivationEventCount: 0,
    },
    RestrictedRosterEntries: [
      {
        ElectionId: 'election-1',
        OrganizationVoterId: '10001',
        ContactType: 0,
        ContactValueHint: 'Email ending @example.org',
        LinkStatus: 1,
        VotingRightStatus: ElectionVotingRightStatusProto.VotingRightActive,
        WasPresentAtOpen: false,
        WasActiveAtOpen: false,
        InCurrentDenominator: true,
        ParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
        CountsAsParticipation: false,
      },
    ],
    ActivationEvents: [],
    EligibilitySnapshots: [],
    LatestRosterImportEvidence: {
      RosterSourceFileHash: 'source-hash-abcdef',
      RosterCanonicalHash: 'canonical-hash-abcdef',
      RosterCanonicalizationVersion: 'hush_roster_canonicalization_v1',
      AcceptedRowCount: 2,
      RejectedRowCount: 0,
      DuplicateContactWarningCount: 1,
      HasBlockingErrors: false,
      ImportedAt: timestamp,
      ImportedByActor: 'owner-public-key',
    },
    EligibilityPolicyEvidence: {
      EligibilityPolicyId: 'organizational_eligibility_checkoff_v1',
      EligibilityPolicyVersion: 'draft',
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      IdentityLinkPolicy: ElectionIdentityLinkPolicyProto.ContactCodeV1,
      CheckoffVisibilityPolicy: ElectionCheckoffVisibilityPolicyProto.RestrictedOwnerAuditor,
      ActorLinkMultiplicityPolicy:
        ElectionActorLinkMultiplicityPolicyProto.MultipleRosterEntriesPerActorAllowed,
      ContactCodeProviderReadiness:
        ElectionContactCodeProviderReadinessProto.ContactCodeProviderDevOnly,
      HighAssuranceAvailable: false,
      OpenBlockers: ['Contact-code provider readiness is DevOnly.'],
    },
    Sp05Evidence: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      RosteredCount: 2,
      LinkedCount: 1,
      ActiveDenominatorCount: 2,
      CommitmentCount: 0,
      CountedParticipationCount: 0,
      DuplicateContactWarningCount: 1,
      RosterCanonicalHash: 'canonical-hash-abcdef',
      CommitmentTreeRoot: '',
      LatestEliResultCode: 'eligibility_dev_only_verification_blocked',
      Message: 'SP-05 eligibility evidence has readiness blockers.',
    },
  };
}

describe('ElectionEligibilityWorkspaceSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electionsServiceMock.getElectionEligibilityView.mockResolvedValue(createEligibilityView());
  });

  it('shows SP-05 import readiness and provider blockers for owner/admin users', async () => {
    render(
      <ElectionEligibilityWorkspaceSection
        electionId="election-1"
        detail={createDetail()}
        actorPublicAddress="owner-public-key"
        actorEncryptionPublicKey="owner-encryption-public-key"
        actorEncryptionPrivateKey="owner-encryption-private-key"
        actorSigningPrivateKey="owner-signing-private-key"
      />,
    );

    const readiness = await screen.findByTestId('eligibility-sp05-readiness');
    expect(readiness).toHaveTextContent('SP-05 readiness');
    expect(readiness).toHaveTextContent('2 accepted / 0 rejected');
    expect(readiness).toHaveTextContent('Warnings: 1');
    expect(readiness).toHaveTextContent('Multiple roster entries per actor');
    expect(readiness).toHaveTextContent('Dev-only provider');
    expect(readiness).toHaveTextContent('eligibility_dev_only_verification_blocked');
    expect(readiness).toHaveTextContent('Contact-code provider readiness is DevOnly.');
  });
});

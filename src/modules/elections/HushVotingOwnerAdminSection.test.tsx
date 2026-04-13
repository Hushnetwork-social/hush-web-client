import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ElectionClassProto,
  ElectionCeremonyVersionStatusProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeInvitationStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { OwnerAdminWorkspaceSummary } from './HushVotingOwnerAdminSection';
import {
  createDetail,
  createElectionRecord,
  createHubEntry,
  createSummary,
  timestamp,
} from './HushVotingWorkspaceTestUtils';

describe('OwnerAdminWorkspaceSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the collapsed readiness summary and expands into the detailed owner snapshot', () => {
    const ownerEntry = createHubEntry(
      'election-owner',
      ElectionLifecycleStateProto.Draft,
      'Trustee Threshold Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        Election: createSummary(
          'election-owner',
          ElectionLifecycleStateProto.Draft,
          'Trustee Threshold Election',
          'actor-address'
        ),
      }
    );
    ownerEntry.Election.GovernanceMode = ElectionGovernanceModeProto.TrusteeThreshold;

    const detail = createDetail(
      'election-owner',
      ElectionLifecycleStateProto.Draft,
      'Trustee Threshold Election',
      {
        Election: createElectionRecord(
          'election-owner',
          ElectionLifecycleStateProto.Draft,
          'Trustee Threshold Election',
          {
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 1,
          }
        ),
        TrusteeInvitations: [
          {
            Id: 'invite-1',
            ElectionId: 'election-owner',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-1',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 2,
            SentAt: timestamp,
          },
          {
            Id: 'invite-2',
            ElectionId: 'election-owner',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Bob Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-2',
            Status: ElectionTrusteeInvitationStatusProto.Pending,
            SentAtDraftRevision: 2,
            SentAt: timestamp,
          },
        ],
        CeremonyVersions: [
          {
            Id: 'ceremony-1',
            ElectionId: 'election-owner',
            VersionNumber: 1,
            ProfileId: 'prod-2of3-v1',
            TrusteeCount: 2,
            RequiredApprovalCount: 2,
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
            StartedAt: timestamp,
            StartedByPublicAddress: 'actor-address',
            TallyPublicKeyFingerprint: 'fingerprint-1',
          },
        ],
      }
    );

    render(<OwnerAdminWorkspaceSummary entry={ownerEntry} detail={detail} />);

    expect(screen.getByTestId('hush-voting-owner-admin-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Not ready:');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'open prerequisites, key ceremony'
    );

    fireEvent.click(screen.getByTestId('hush-voting-owner-admin-toggle'));

    expect(screen.getByTestId('hush-voting-owner-admin-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Ready-to-open snapshot');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Accepted trustees');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Key ceremony');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('1 accepted | 1 pending');
  });

  it('summarizes the owner state as ready when saved draft, roster, and ceremony are clear', () => {
    const ownerEntry = createHubEntry(
      'election-ready',
      ElectionLifecycleStateProto.Draft,
      'Ready Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
      }
    );
    ownerEntry.Election.GovernanceMode = ElectionGovernanceModeProto.TrusteeThreshold;

    const detail = createDetail(
      'election-ready',
      ElectionLifecycleStateProto.Draft,
      'Ready Election',
      {
        Election: createElectionRecord(
          'election-ready',
          ElectionLifecycleStateProto.Draft,
          'Ready Election',
          {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 1,
            Options: [
              {
                OptionId: 'candidate-a',
                DisplayLabel: 'Candidate A',
                ShortDescription: 'Option A',
                BallotOrder: 1,
                IsBlankOption: false,
              },
              {
                OptionId: 'candidate-b',
                DisplayLabel: 'Candidate B',
                ShortDescription: 'Option B',
                BallotOrder: 2,
                IsBlankOption: false,
              },
            ],
          }
        ),
        TrusteeInvitations: [
          {
            Id: 'invite-1',
            ElectionId: 'election-ready',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-1',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 2,
            SentAt: timestamp,
          },
        ],
        CeremonyVersions: [
          {
            Id: 'ceremony-ready',
            ElectionId: 'election-ready',
            VersionNumber: 1,
            ProfileId: 'prod-1of1-v1',
            TrusteeCount: 1,
            RequiredApprovalCount: 1,
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionReady,
            StartedAt: timestamp,
            StartedByPublicAddress: 'actor-address',
            TallyPublicKeyFingerprint: 'fingerprint-1',
          },
        ],
      }
    );

    render(<OwnerAdminWorkspaceSummary entry={ownerEntry} detail={detail} />);

    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Ready for open proposal.'
    );
    expect(screen.getByRole('link', { name: 'Owner Workspace' })).toHaveAttribute(
      'href',
      '/elections/owner?electionId=election-ready'
    );
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ElectionClassProto,
  ElectionCeremonyVersionStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeInvitationStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  ParticipationPrivacyModeProto,
  ProtocolPackageBindingStatusProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { OwnerAdminWorkspaceSummary } from './HushVotingOwnerAdminSection';
import {
  createDetail,
  createElectionRecord,
  createHubEntry,
  createProtocolPackageBinding,
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
        ProtocolPackageBinding: createProtocolPackageBinding({
          ElectionId: 'election-owner',
          PackageVersion: 'v0.9.0',
          Status: ProtocolPackageBindingStatusProto.Stale,
        }),
      }
    );

    render(<OwnerAdminWorkspaceSummary entry={ownerEntry} detail={detail} />);

    expect(screen.getByTestId('hush-voting-owner-admin-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Not ready:');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'open prerequisites, accepted trustees, key ceremony'
    );

    fireEvent.click(screen.getByTestId('hush-voting-owner-admin-toggle'));

    expect(screen.getByTestId('hush-voting-owner-admin-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Ready-to-open snapshot');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Accepted trustees');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Need at least 5 accepted trustee(s) to match the selected 3-of-5 profile before open can proceed.'
    );
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Key ceremony');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('1 accepted | 1 pending');
    expect(screen.getByTestId('owner-admin-protocol-package-readiness')).toHaveTextContent(
      'Stale package refs'
    );
    expect(screen.getByTestId('owner-admin-protocol-package-readiness')).toHaveTextContent('v0.9.0');
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
            RequiredApprovalCount: 3,
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
          {
            Id: 'invite-2',
            ElectionId: 'election-ready',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Bob Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-2',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 2,
            SentAt: timestamp,
          },
          {
            Id: 'invite-3',
            ElectionId: 'election-ready',
            TrusteeUserAddress: 'trustee-c',
            TrusteeDisplayName: 'Charlie Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-3',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 2,
            SentAt: timestamp,
          },
          {
            Id: 'invite-4',
            ElectionId: 'election-ready',
            TrusteeUserAddress: 'trustee-d',
            TrusteeDisplayName: 'Dana Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-4',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 2,
            SentAt: timestamp,
          },
          {
            Id: 'invite-5',
            ElectionId: 'election-ready',
            TrusteeUserAddress: 'trustee-e',
            TrusteeDisplayName: 'Evan Trustee',
            InvitedByPublicAddress: 'actor-address',
            LinkedMessageId: 'msg-5',
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
            ProfileId: 'dkg-prod-3of5',
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
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

  it('reframes the owner surface around trustee tally shares once the election is closed', () => {
    const ownerEntry = createHubEntry(
      'election-closed',
      ElectionLifecycleStateProto.Closed,
      'Closed Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        Election: createSummary(
          'election-closed',
          ElectionLifecycleStateProto.Closed,
          'Closed Election',
          'actor-address'
        ),
        ClosedProgressStatus:
          ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );
    ownerEntry.Election.GovernanceMode = ElectionGovernanceModeProto.TrusteeThreshold;

    render(
      <OwnerAdminWorkspaceSummary
        entry={ownerEntry}
        detail={createDetail('election-closed', ElectionLifecycleStateProto.Closed, 'Closed Election', {
          Election: createElectionRecord(
            'election-closed',
            ElectionLifecycleStateProto.Closed,
            'Closed Election',
            {
              GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
              ClosedProgressStatus:
                ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
            }
          ),
          ProtocolPackageBinding: createProtocolPackageBinding({
            ElectionId: 'election-closed',
            Status: ProtocolPackageBindingStatusProto.Sealed,
            HasSealedAt: true,
            SealedAt: timestamp,
          }),
        })}
      />
    );

    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Waiting for trustee tally shares.'
    );
    fireEvent.click(screen.getByTestId('hush-voting-owner-admin-toggle'));
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Close-to-unofficial-result snapshot'
    );
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'publish the unofficial result'
    );
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Pending finalization'
    );
    expect(screen.getByTestId('owner-admin-protocol-package-evidence')).toHaveTextContent(
      'Sealed at open'
    );
  });

  it('stays collapsed and explicit once the unofficial result is published', () => {
    const ownerEntry = createHubEntry(
      'election-unofficial',
      ElectionLifecycleStateProto.Closed,
      'Unofficial Result Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        Election: createSummary(
          'election-unofficial',
          ElectionLifecycleStateProto.Closed,
          'Unofficial Result Election',
          'actor-address'
        ),
        HasUnofficialResult: true,
        HasOfficialResult: false,
      }
    );

    render(
      <OwnerAdminWorkspaceSummary
        entry={ownerEntry}
        detail={createDetail(
          'election-unofficial',
          ElectionLifecycleStateProto.Closed,
          'Unofficial Result Election'
        )}
      />
    );

    expect(screen.getByTestId('hush-voting-owner-admin-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Unofficial result published.'
    );

    fireEvent.click(screen.getByTestId('hush-voting-owner-admin-toggle'));
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Admin-only protected custody path'
    );
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'owner-admin protected custody profile'
    );
  });
});

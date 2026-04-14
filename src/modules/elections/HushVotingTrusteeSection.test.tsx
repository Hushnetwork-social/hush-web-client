import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ElectionCeremonyVersionStatusProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
} from '@/lib/grpc';
import { TrusteeWorkspaceSummary } from './HushVotingTrusteeSection';
import { createDetail, createHubEntry, timestamp } from './HushVotingWorkspaceTestUtils';

describe('TrusteeWorkspaceSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('stays collapsed when ceremony work is complete and no trustee action is pending', () => {
    const entry = createHubEntry(
      'election-trustee-voter',
      ElectionLifecycleStateProto.Draft,
      'Trustee Voter Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: true,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        CanClaimIdentity: false,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    const detail = createDetail(
      'election-trustee-voter',
      ElectionLifecycleStateProto.Draft,
      'Trustee Voter Election',
      {
        CeremonyVersions: [
          {
            Id: 'ceremony-ready',
            ElectionId: 'election-trustee-voter',
            VersionNumber: 1,
            ProfileId: 'profile-1',
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionReady,
            StartedAt: timestamp,
            StartedByPublicAddress: 'owner-address',
            TallyPublicKeyFingerprint: 'fingerprint-1',
          },
        ],
      }
    );

    render(<TrusteeWorkspaceSummary entry={entry} detail={detail} />);

    expect(screen.getByTestId('hush-voting-trustee-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('hush-voting-section-trustee')).toHaveTextContent('Ceremony complete.');
    expect(screen.getByRole('link', { name: 'Ceremony workspace' })).toHaveAttribute(
      'href',
      '/elections/election-trustee-voter/trustee/ceremony'
    );
    expect(screen.getByTestId('trustee-share-workspace-action')).toHaveAttribute(
      'href',
      '/elections/election-trustee-voter/trustee/finalization'
    );
    expect(screen.getByTestId('trustee-share-workspace-action')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('opens by default when the trustee still has ceremony follow-up work', () => {
    const entry = createHubEntry(
      'election-trustee',
      ElectionLifecycleStateProto.Draft,
      'Trustee Ceremony Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: true,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason:
          'Continue the trustee ceremony. The election owner accepted your key ceremony participation.',
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    render(
      <TrusteeWorkspaceSummary
        entry={entry}
        detail={createDetail('election-trustee', ElectionLifecycleStateProto.Draft, 'Trustee Ceremony Election')}
      />
    );

    expect(screen.getByTestId('hush-voting-trustee-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('hush-voting-section-trustee')).toHaveTextContent('Ceremony follow-up required.');
  });

  it('shows the waiting close-threshold summary and disables the share workspace until the session exists', () => {
    const entry = createHubEntry(
      'election-trustee-close',
      ElectionLifecycleStateProto.Open,
      'Trustee Close Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: true,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    const detail = createDetail(
      'election-trustee-close',
      ElectionLifecycleStateProto.Open,
      'Trustee Close Election',
      {
        Election: {
          ...createDetail(
            'election-trustee-close',
            ElectionLifecycleStateProto.Open,
            'Trustee Close Election'
          ).Election,
          GovernanceMode: 1,
        },
        GovernedProposals: [
          {
            Id: 'proposal-close-1',
            ElectionId: 'election-trustee-close',
            ActionType: ElectionGovernedActionTypeProto.Close,
            LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
            ProposedByPublicAddress: 'owner-address',
            CreatedAt: timestamp,
            ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
            ExecutionFailureReason: '',
            LastExecutionTriggeredByPublicAddress: '',
          },
        ],
      }
    );

    render(<TrusteeWorkspaceSummary entry={entry} detail={detail} />);

    expect(screen.getByTestId('hush-voting-section-trustee')).toHaveTextContent(
      'Waiting for close threshold.'
    );
    expect(screen.getByTestId('trustee-share-workspace-action')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByTestId('hush-voting-section-trustee')).toHaveTextContent(
      'Waiting for close threshold'
    );
  });

  it('enables the share workspace once a close-counting session exists', () => {
    const entry = createHubEntry(
      'election-trustee-share',
      ElectionLifecycleStateProto.Closed,
      'Trustee Share Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: true,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionTrusteeReviewResult,
        SuggestedActionReason: 'Trustee-specific result review is ready.',
        HasUnofficialResult: true,
        HasOfficialResult: false,
      }
    );

    const detail = createDetail(
      'election-trustee-share',
      ElectionLifecycleStateProto.Closed,
      'Trustee Share Election',
      {
        FinalizationSessions: [
          {
            Id: 'session-close-1',
            ElectionId: 'election-trustee-share',
            GovernedProposalId: 'proposal-close-1',
            GovernanceMode: 1,
            SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
            CloseArtifactId: 'close-artifact-1',
            AcceptedBallotSetHash: 'accepted-ballot-set-hash',
            FinalEncryptedTallyHash: 'encrypted-tally-hash',
            TargetTallyId: 'aggregate-tally-1',
            CeremonySnapshot: undefined,
            RequiredShareCount: 3,
            EligibleTrustees: [],
            Status: ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
            CreatedAt: timestamp,
            CreatedByPublicAddress: 'owner-address',
            CompletedAt: undefined,
            ReleaseEvidenceId: '',
            LatestTransactionId: 'transaction-1',
            LatestBlockHeight: 100,
            LatestBlockId: 'block-100',
          },
        ],
      }
    );

    render(<TrusteeWorkspaceSummary entry={entry} detail={detail} />);

    expect(screen.getByTestId('trustee-share-workspace-action')).toHaveAttribute(
      'aria-disabled',
      'false'
    );
    expect(screen.getByTestId('hush-voting-section-trustee')).toHaveTextContent(
      'Close-counting share active.'
    );
  });
});

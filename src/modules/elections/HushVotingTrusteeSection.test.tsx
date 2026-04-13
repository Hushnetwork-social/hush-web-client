import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ElectionCeremonyVersionStatusProto,
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
    expect(screen.getByRole('link', { name: 'Share workspace' })).toHaveAttribute(
      'href',
      '/elections/election-trustee-voter/trustee/finalization'
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
});

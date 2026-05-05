import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { ArtifactsWorkspaceSummary } from './HushVotingArtifactsSection';
import {
  createDetail,
  createHubEntry,
  createReportArtifact,
  createReportPackage,
  createResultView,
  createVerificationPackageStatus,
} from './HushVotingWorkspaceTestUtils';

describe('ArtifactsWorkspaceSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps package access in a separate artifact section', () => {
    const entry = createHubEntry(
      'election-artifacts',
      ElectionLifecycleStateProto.Closed,
      'Artifacts Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        CanViewNamedParticipationRoster: true,
        CanViewReportPackage: true,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: false,
      }
    );

    render(
      <ArtifactsWorkspaceSummary
        entry={entry}
        detail={createDetail(
          'election-artifacts',
          ElectionLifecycleStateProto.Closed,
          'Artifacts Election'
        )}
        resultView={createResultView({
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          VisibleReportArtifacts: [createReportArtifact()],
        })}
        isLoadingResultView={false}
      />
    );

    expect(screen.getByTestId('hush-voting-section-artifacts')).toHaveTextContent(
      'Artifact and package availability'
    );
    expect(screen.getByTestId('hush-voting-artifacts-open-report-package')).toHaveAttribute(
      'href',
      '#hush-voting-report-package'
    );
  });

  it('shows verification package status inside the existing artifact surface for authorized actors', () => {
    const entry = createHubEntry(
      'election-verifier-package',
      ElectionLifecycleStateProto.Finalized,
      'Verifier Package Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanViewNamedParticipationRoster: true,
        CanViewReportPackage: true,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    render(
      <ArtifactsWorkspaceSummary
        entry={entry}
        detail={createDetail(
          'election-verifier-package',
          ElectionLifecycleStateProto.Finalized,
          'Verifier Package Election'
        )}
        resultView={createResultView({
          ActorPublicAddress: 'actor-address',
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          VisibleReportArtifacts: [createReportArtifact()],
          VerificationPackageStatus: createVerificationPackageStatus({
            ElectionId: 'election-verifier-package',
            ActorPublicAddress: 'actor-address',
          }),
        })}
        isLoadingResultView={false}
      />
    );

    fireEvent.click(screen.getByTestId('hush-voting-artifacts-toggle'));

    expect(screen.getByTestId('verification-package-status-section')).toHaveTextContent(
      'Independent election-record export'
    );
    expect(screen.getByRole('button', { name: 'Download public package' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download restricted package' })).toBeEnabled();
  });

  it('does not expose verification package refs when the result view marks them hidden', () => {
    const entry = createHubEntry(
      'election-voter-hidden',
      ElectionLifecycleStateProto.Finalized,
      'Voter Hidden Package Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    render(
      <ArtifactsWorkspaceSummary
        entry={entry}
        detail={createDetail(
          'election-voter-hidden',
          ElectionLifecycleStateProto.Finalized,
          'Voter Hidden Package Election'
        )}
        resultView={createResultView({
          ActorPublicAddress: 'voter-address',
          VerificationPackageStatus: createVerificationPackageStatus({
            ElectionId: 'election-voter-hidden',
            ActorPublicAddress: 'voter-address',
            IsVisible: false,
          }),
        })}
        isLoadingResultView={false}
      />
    );

    fireEvent.click(screen.getByTestId('hush-voting-artifacts-toggle'));

    expect(screen.queryByTestId('verification-package-status-section')).not.toBeInTheDocument();
    expect(screen.queryByText('Independent election-record export')).not.toBeInTheDocument();
  });
});

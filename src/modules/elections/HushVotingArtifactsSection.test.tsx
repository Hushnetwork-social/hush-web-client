import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { ArtifactsWorkspaceSummary } from './HushVotingArtifactsSection';
import {
  createDetail,
  createHubEntry,
  createReportArtifact,
  createReportPackage,
  createResultView,
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
});

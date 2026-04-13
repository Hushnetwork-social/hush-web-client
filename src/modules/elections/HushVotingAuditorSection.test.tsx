import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { AuditorWorkspaceSummary } from './HushVotingAuditorSection';
import {
  createDetail,
  createHubEntry,
  createReportArtifact,
  createReportPackage,
  createResultArtifact,
  createResultView,
} from './HushVotingWorkspaceTestUtils';

describe('AuditorWorkspaceSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the report package and official result actions for an auditor-only actor', async () => {
    const entry = createHubEntry(
      'election-auditor',
      ElectionLifecycleStateProto.Finalized,
      'Auditor Review Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: true,
        },
        CanViewNamedParticipationRoster: true,
        CanViewReportPackage: true,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    render(
      <AuditorWorkspaceSummary
        entry={entry}
        detail={createDetail('election-auditor', ElectionLifecycleStateProto.Finalized, 'Auditor Review Election')}
        resultView={createResultView({
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          OfficialResult: createResultArtifact(),
          VisibleReportArtifacts: [createReportArtifact()],
        })}
        isLoadingResultView={false}
      />
    );

    expect(await screen.findByTestId('hush-voting-section-auditor')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-open-report-package')).toHaveAttribute(
      'href',
      '#hush-voting-report-package'
    );
    expect(screen.getByTestId('hush-voting-open-auditor-result')).toHaveAttribute(
      'href',
      '#hush-voting-official-result'
    );
  });
});

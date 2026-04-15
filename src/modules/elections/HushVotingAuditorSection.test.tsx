import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ElectionClosedProgressStatusProto,
  ElectionLifecycleStateProto,
} from '@/lib/grpc';
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

  it('stays collapsed when unofficial or official results are already published', async () => {
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
    expect(screen.getByTestId('hush-voting-auditor-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('hush-voting-section-auditor')).toHaveTextContent(
      'Official result published.'
    );
  });

  it('shows a closed-progress callout while trustees are still unlocking the unofficial result', async () => {
    const entry = createHubEntry(
      'election-auditor-closed',
      ElectionLifecycleStateProto.Closed,
      'Auditor Waiting Election',
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
        ClosedProgressStatus:
          ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    render(
      <AuditorWorkspaceSummary
        entry={entry}
        detail={createDetail(
          'election-auditor-closed',
          ElectionLifecycleStateProto.Closed,
          'Auditor Waiting Election'
        )}
        resultView={createResultView({
          CanViewReportPackage: false,
        })}
        isLoadingResultView={false}
      />
    );

    expect(await screen.findByTestId('hush-voting-section-auditor')).toHaveTextContent(
      'Awaiting unofficial result preparation'
    );
    expect(screen.getByTestId('hush-voting-section-auditor')).toHaveTextContent(
      'auditor-visible evidence can be reviewed'
    );
    expect(screen.getByTestId('hush-voting-auditor-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

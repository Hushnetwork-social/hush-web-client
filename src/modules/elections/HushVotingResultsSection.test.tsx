import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
} from '@/lib/grpc';
import { ResultsWorkspaceSummary } from './HushVotingResultsSection';
import {
  createDetail,
  createHubEntry,
  createReportArtifact,
  createReportPackage,
  createResultArtifact,
  createResultView,
} from './HushVotingWorkspaceTestUtils';

describe('ResultsWorkspaceSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps voter-only workspaces focused on voter details when no artifact package is available', () => {
    const entry = createHubEntry(
      'election-no-results',
      ElectionLifecycleStateProto.Draft,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    render(
      <ResultsWorkspaceSummary
        entry={entry}
        detail={createDetail('election-no-results', ElectionLifecycleStateProto.Draft, 'Annual Elections 2026')}
        resultView={createResultView()}
        isLoadingResultView={false}
      />
    );

    expect(screen.getByTestId('hush-voting-section-results')).toHaveTextContent('Boundary Artifacts');
    expect(screen.queryByRole('button', { name: 'Result details' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('hush-voting-results-open-report-package')).not.toBeInTheDocument();
  });

  it('shows result and report-package actions when the workspace owns result review', () => {
    const entry = createHubEntry(
      'election-results',
      ElectionLifecycleStateProto.Finalized,
      'Results Election',
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
      <ResultsWorkspaceSummary
        entry={entry}
        detail={createDetail('election-results', ElectionLifecycleStateProto.Finalized, 'Results Election')}
        resultView={createResultView({
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          OfficialResult: createResultArtifact(),
          VisibleReportArtifacts: [createReportArtifact()],
        })}
        isLoadingResultView={false}
      />
    );

    expect(screen.getByTestId('hush-voting-results-open-report-package')).toHaveAttribute(
      'href',
      '#hush-voting-report-package'
    );
    expect(screen.getByTestId('hush-voting-results-open-result')).toHaveAttribute(
      'href',
      '#hush-voting-official-result'
    );
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { ResultsWorkspaceSummary } from './HushVotingResultsSection';
import {
  createDetail,
  createHubEntry,
  createResultArtifact,
  createResultView,
} from './HushVotingWorkspaceTestUtils';

describe('ResultsWorkspaceSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows published results directly for voter entries instead of keeping them inside voter details', () => {
    const entry = createHubEntry(
      'election-voter-results',
      ElectionLifecycleStateProto.Closed,
      'Voter Results Election',
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
        HasOfficialResult: false,
      }
    );

    render(
      <ResultsWorkspaceSummary
        entry={entry}
        detail={createDetail(
          'election-voter-results',
          ElectionLifecycleStateProto.Closed,
          'Voter Results Election'
        )}
        resultView={createResultView({
          UnofficialResult: createResultArtifact({
            ArtifactKind: 0,
            Title: 'Unofficial result',
          }),
        })}
        isLoadingResultView={false}
      />
    );

    expect(screen.getByTestId('hush-voting-section-results')).toHaveTextContent(
      'Published Results'
    );
    expect(screen.getByTestId('hush-voting-section-results')).toHaveTextContent(
      'Unofficial result published.'
    );
    expect(screen.getByTestId('hush-voting-results-open-result')).toHaveAttribute(
      'href',
      '#hush-voting-unofficial-result'
    );
  });

  it('keeps report-package access out of the results surface', () => {
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
        detail={createDetail(
          'election-results',
          ElectionLifecycleStateProto.Finalized,
          'Results Election'
        )}
        resultView={createResultView({
          CanViewReportPackage: true,
          OfficialResult: createResultArtifact(),
        })}
        isLoadingResultView={false}
      />
    );

    expect(screen.getByTestId('hush-voting-results-open-result')).toHaveAttribute(
      'href',
      '#hush-voting-official-result'
    );
    expect(screen.queryByTestId('hush-voting-results-open-report-package')).not.toBeInTheDocument();
  });
});

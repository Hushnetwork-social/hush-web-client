import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import {
  getElectionHubDisplayActionLabel,
  getElectionHubNarrative,
} from './contracts';
import { ElectionHubCard } from './ElectionHubCard';
import { createHubEntry } from './HushVotingWorkspaceTestUtils';

describe('ElectionHubCard', () => {
  it('renders finalized elections as compact rows in the hub', () => {
    const entry = createHubEntry(
      'election-finalized',
      ElectionLifecycleStateProto.Finalized,
      'Finalized Trustee Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: true,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        CanViewReportPackage: true,
        HasOfficialResult: true,
      }
    );
    const onSelect = vi.fn();

    render(
      <ElectionHubCard entry={entry} isSelected={false} onSelect={onSelect} />
    );

    const card = screen.getByTestId('election-hub-card-election-finalized');
    expect(card).toHaveAttribute('data-layout', 'compact-finalized');
    expect(screen.getByText('Official result available')).toBeInTheDocument();
    expect(screen.queryByText(getElectionHubNarrative(entry))).not.toBeInTheDocument();
    expect(
      screen.queryByText(getElectionHubDisplayActionLabel(entry))
    ).not.toBeInTheDocument();

    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith('election-finalized');
  });

  it('keeps non-finalized elections on the full card layout', () => {
    const entry = createHubEntry(
      'election-open',
      ElectionLifecycleStateProto.Open,
      'Open Election'
    );

    render(
      <ElectionHubCard entry={entry} isSelected={false} onSelect={vi.fn()} />
    );

    expect(screen.getByTestId('election-hub-card-election-open')).toHaveAttribute(
      'data-layout',
      'full'
    );
    expect(screen.getByText(getElectionHubNarrative(entry))).toBeInTheDocument();
    expect(
      screen.getByText(getElectionHubDisplayActionLabel(entry))
    ).toBeInTheDocument();
  });
});

import { FileWarning } from 'lucide-react';
import type { VoterVoidStatusPanelProps } from './VoidElectionTypes';
import { VoidValue } from './VoidValue';

export function VoterVoidStatusPanel({
  voteRightConsumed,
  hasKnownVoteRightStatus,
}: VoterVoidStatusPanelProps) {
  return (
    <div className="mt-4 rounded-3xl bg-red-500/10 p-5 text-red-50 shadow-sm shadow-black/10" data-testid="voter-void-status-panel">
      <div className="flex items-start gap-3">
        <FileWarning className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-red-100/80">
            VOID status
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">This election is VOID</h3>
          <p className="mt-2 text-sm leading-7 text-red-100/85">
            No counted or final inclusion claim is available for this election. Your own vote-right
            status can still be shown where the system already has safe voter-owned evidence.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <VoidValue
          label="Vote right consumed"
          value={hasKnownVoteRightStatus ? (voteRightConsumed ? 'Yes' : 'No') : 'No consumed vote-right status available'}
          accentClass={hasKnownVoteRightStatus && voteRightConsumed ? 'text-amber-100' : undefined}
        />
        <VoidValue
          label="Receipt/final inclusion"
          value="Unavailable after VOID"
          accentClass="text-red-100"
        />
      </div>
    </div>
  );
}

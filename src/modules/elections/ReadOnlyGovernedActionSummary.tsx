"use client";

import type { GetElectionResponse } from '@/lib/grpc';
import {
  formatTimestamp,
  getGovernedActionLabel,
  getGovernedActionViewStates,
  getGovernedActionStatusClass,
  getGovernedActionStatusLabel,
  getGovernedProposalExecutionStatusLabel,
} from './contracts';

type ReadOnlyGovernedActionSummaryProps = {
  detail: GetElectionResponse | null;
};

export function ReadOnlyGovernedActionSummary({ detail }: ReadOnlyGovernedActionSummaryProps) {
  const governedStates = getGovernedActionViewStates(detail);

  return (
    <section
      className="rounded-3xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10"
      data-testid="read-only-governed-action-summary"
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
          Read-only governed actions
        </div>
        <h3 className="text-xl font-semibold text-hush-text-primary">Governed action review</h3>
        <p className="text-sm text-hush-text-accent">
          This summary mirrors trustee action state without exposing any approval controls.
        </p>
      </div>

      {governedStates.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4 text-sm text-hush-text-accent">
          No governed-action workflow is active for this election.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {governedStates.map((state) => (
            <article
              key={state.actionType}
              className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-hush-text-primary">
                    {getGovernedActionLabel(state.actionType)}
                  </div>
                  <p className="mt-2 text-sm text-hush-text-accent">{state.reason}</p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${getGovernedActionStatusClass(state.status)}`}
                >
                  {getGovernedActionStatusLabel(state.status)}
                </span>
              </div>

              {state.proposal ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-element/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Proposal
                    </div>
                    <div className="mt-2 font-mono text-xs text-hush-text-primary">
                      {state.proposal.Id}
                    </div>
                  </div>
                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-element/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Created
                    </div>
                    <div className="mt-2 text-sm text-hush-text-primary">
                      {formatTimestamp(state.proposal.CreatedAt)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-element/80 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Execution
                    </div>
                    <div className="mt-2 text-sm text-hush-text-primary">
                      {getGovernedProposalExecutionStatusLabel(state.proposal.ExecutionStatus)}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

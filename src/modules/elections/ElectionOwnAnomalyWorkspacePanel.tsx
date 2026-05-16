"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, FileWarning, Loader2 } from 'lucide-react';
import { ElectionAnomalyPanel } from './ElectionAnomalyPanel';
import { getLifecycleLabel } from './contracts';
import { sectionClass } from './HushVotingWorkspaceShared';
import { useElectionsStore } from './useElectionsStore';

type ElectionOwnAnomalyWorkspacePanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

export function ElectionOwnAnomalyWorkspacePanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: ElectionOwnAnomalyWorkspacePanelProps) {
  const {
    isLoadingDetail,
    loadElection,
    reset,
    selectedElection,
  } = useElectionsStore();

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const election =
    selectedElection?.Election?.ElectionId === electionId ? selectedElection.Election : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        <header className={sectionClass}>
          <Link
            href={`/elections/${electionId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-hush-text-accent transition-colors hover:text-hush-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to election</span>
          </Link>
          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                <FileWarning className="h-4 w-4" />
                <span>Anomaly reporting</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-hush-text-primary">
                {election?.Title || 'My anomaly thread'}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-hush-text-accent">
                This is the submitter thread for the current account. It shows the
                original report, authority messages, and any bounded clarification response for
                this account only.
              </p>
            </div>
            <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Lifecycle
              </div>
              <div className="mt-2 text-lg font-semibold text-hush-text-primary">
                {election ? getLifecycleLabel(election.LifecycleState) : 'Loading'}
              </div>
            </div>
          </div>
        </header>

        {isLoadingDetail && !election ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Loading election details...</span>
          </div>
        ) : null}

        <ElectionAnomalyPanel
          electionId={electionId}
          actorPublicAddress={actorPublicAddress}
          actorEncryptionPublicKey={actorEncryptionPublicKey}
          actorEncryptionPrivateKey={actorEncryptionPrivateKey}
          actorSigningPrivateKey={actorSigningPrivateKey}
          ownerPublicAddress={election?.OwnerPublicAddress ?? ''}
          surface="account"
          canReadOwnThread
          canCreateThread={Boolean(election?.OwnerPublicAddress)}
          unavailableTitle="Election context is required"
          unavailableDescription="This account can review an existing own anomaly thread here. Creating a new anomaly requires the election context to load and a current election role."
          lifecycleState={election?.LifecycleState}
          anomalySubmissionWindowClosesAt={election?.AnomalySubmissionWindowClosesAt}
          hasAnomalySubmissionWindowClosesAt={election?.HasAnomalySubmissionWindowClosesAt}
        />
      </div>
    </div>
  );
}

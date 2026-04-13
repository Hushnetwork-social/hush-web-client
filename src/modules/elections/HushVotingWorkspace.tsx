"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import type { GetElectionResultViewResponse } from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { ClosedProgressBanner } from './ClosedProgressBanner';
import { ElectionAccessBoundaryNotice } from './ElectionAccessBoundaryNotice';
import { ElectionHubList } from './ElectionHubList';
import { ElectionWorkspaceHeader } from './ElectionWorkspaceHeader';
import { AuditorWorkspaceSummary } from './HushVotingAuditorSection';
import { OwnerAdminWorkspaceSummary } from './HushVotingOwnerAdminSection';
import { PendingTrusteeInvitationSummary } from './HushVotingPendingTrusteeInvitationSection';
import { ResultsWorkspaceSummary } from './HushVotingResultsSection';
import { TrusteeWorkspaceSummary } from './HushVotingTrusteeSection';
import { VoterWorkspaceSummary } from './HushVotingVoterSection';
import { getElectionWorkspaceSectionOrder } from './contracts';
import {
  getPendingSelfTrusteeInvitation,
  sectionClass,
} from './HushVotingWorkspaceShared';
import { useElectionsStore } from './useElectionsStore';

type HushVotingWorkspaceProps = {
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
  initialElectionId?: string;
};

async function loadElectionResultViewSafely(
  electionId: string,
  actorPublicAddress: string
): Promise<GetElectionResultViewResponse | null> {
  try {
    return await electionsService.getElectionResultView({
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
    });
  } catch {
    return null;
  }
}

export function HushVotingWorkspace({
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
  initialElectionId,
}: HushVotingWorkspaceProps) {
  const router = useRouter();
  const [resultView, setResultView] = useState<GetElectionResultViewResponse | null>(null);
  const [isLoadingResultView, setIsLoadingResultView] = useState(false);
  const {
    acceptTrusteeInvitation,
    clearGrantCandidateSearch,
    feedback,
    error,
    hubEntries,
    hubView,
    isLoadingDetail,
    isLoadingHub,
    isSubmitting,
    loadElectionHub,
    rejectTrusteeInvitation,
    reset,
    selectedElection,
    selectedElectionId,
    selectedHubEntry,
    selectHubElection,
  } = useElectionsStore();

  useEffect(() => {
    void loadElectionHub(actorPublicAddress);
  }, [actorPublicAddress, loadElectionHub]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!selectedElectionId) {
      return;
    }

    clearGrantCandidateSearch();
  }, [clearGrantCandidateSearch, selectedElectionId]);

  const requestedEntry = useMemo(
    () =>
      initialElectionId
        ? hubEntries.find((entry) => entry.Election.ElectionId === initialElectionId) ?? null
        : null,
    [hubEntries, initialElectionId]
  );

  useEffect(() => {
    if (!initialElectionId || !requestedEntry || selectedElectionId === initialElectionId) {
      return;
    }

    void selectHubElection(actorPublicAddress, initialElectionId);
  }, [
    actorPublicAddress,
    initialElectionId,
    requestedEntry,
    selectedElectionId,
    selectHubElection,
  ]);

  const activeEntry = useMemo(() => {
    if (initialElectionId) {
      return requestedEntry;
    }

    if (selectedHubEntry) {
      return selectedHubEntry;
    }

    return (
      hubEntries.find((entry) => entry.Election.ElectionId === selectedElectionId) ??
      hubEntries[0] ??
      null
    );
  }, [hubEntries, initialElectionId, requestedEntry, selectedElectionId, selectedHubEntry]);

  const activeDetail = useMemo(
    () =>
      activeEntry && selectedElection?.Election?.ElectionId === activeEntry.Election.ElectionId
        ? selectedElection
        : null,
    [activeEntry, selectedElection]
  );
  const pendingSelfTrusteeInvitation = useMemo(
    () => getPendingSelfTrusteeInvitation(activeDetail, actorPublicAddress),
    [activeDetail, actorPublicAddress]
  );
  const hasPendingInvitationSurface = Boolean(pendingSelfTrusteeInvitation);

  const requestedEntryMissing = Boolean(initialElectionId && !isLoadingHub && hubView && !requestedEntry);
  const sectionOrder = getElectionWorkspaceSectionOrder(activeEntry);
  const hasVisibleSections = sectionOrder.length > 0;
  const isDetailRoute = Boolean(initialElectionId);
  const isWaitingForPendingInvitationDetail =
    isDetailRoute &&
    !hasVisibleSections &&
    !hasPendingInvitationSurface &&
    !activeDetail &&
    isLoadingDetail;

  useEffect(() => {
    if (!isDetailRoute || !activeEntry) {
      setResultView(null);
      setIsLoadingResultView(false);
      return;
    }

    const shouldLoadResultView =
      activeEntry.CanViewParticipantResults ||
      activeEntry.CanViewReportPackage ||
      activeEntry.HasUnofficialResult ||
      activeEntry.HasOfficialResult;

    if (!shouldLoadResultView) {
      setResultView(null);
      setIsLoadingResultView(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingResultView(true);

    void loadElectionResultViewSafely(activeEntry.Election.ElectionId, actorPublicAddress).then(
      (response) => {
        if (isCancelled) {
          return;
        }

        setResultView(response?.Success ? response : null);
        setIsLoadingResultView(false);
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [activeEntry, actorPublicAddress, isDetailRoute]);

  const handleSelectElection = (electionId: string) => {
    if (electionId !== initialElectionId) {
      router.push(`/elections/${electionId}`);
    }
  };

  const handleAcceptPendingTrusteeInvitation = async () => {
    if (!pendingSelfTrusteeInvitation) {
      return;
    }

    const accepted = await acceptTrusteeInvitation(
      {
        ElectionId: pendingSelfTrusteeInvitation.ElectionId,
        InvitationId: pendingSelfTrusteeInvitation.Id,
        ActorPublicAddress: actorPublicAddress,
      },
      actorEncryptionPublicKey,
      actorEncryptionPrivateKey,
      actorSigningPrivateKey
    );

    if (!accepted) {
      return;
    }

    await loadElectionHub(actorPublicAddress);
    useElectionsStore.setState({
      feedback: {
        tone: 'success',
        message: 'Trustee invitation accepted.',
        details: [],
      },
    });
  };

  const handleRejectPendingTrusteeInvitation = async () => {
    if (!pendingSelfTrusteeInvitation) {
      return;
    }

    const rejected = await rejectTrusteeInvitation(
      {
        ElectionId: pendingSelfTrusteeInvitation.ElectionId,
        InvitationId: pendingSelfTrusteeInvitation.Id,
        ActorPublicAddress: actorPublicAddress,
      },
      actorEncryptionPublicKey,
      actorEncryptionPrivateKey,
      actorSigningPrivateKey
    );

    if (!rejected) {
      return;
    }

    await loadElectionHub(actorPublicAddress);
    useElectionsStore.setState({
      feedback: {
        tone: 'success',
        message: 'Trustee invitation rejected.',
        details: [],
      },
    });
    router.push('/elections');
  };

  const emptyStateReason =
    error ||
    hubView?.EmptyStateReason ||
    'This account does not currently hold any election role.';

  if (!isDetailRoute) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
        <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-hush-text-accent">
              Protocol Omega
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-hush-text-primary">HushVoting! Hub</h1>
            <p className="mt-2 max-w-4xl text-sm text-hush-text-accent">
              Open a linked election card to continue into its dedicated HushVoting! detail view.
            </p>
          </div>

          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.tone === 'success'
                  ? 'border-green-500/40 bg-green-500/10 text-green-100'
                  : 'border-red-500/40 bg-red-500/10 text-red-100'
              }`}
              role="status"
            >
              <div className="flex items-center gap-2 font-medium">
                {feedback.tone === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{feedback.message}</span>
              </div>
              {feedback.details.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {feedback.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {hubEntries.length === 0 && isLoadingHub ? (
            <div className={`${sectionClass} flex items-center gap-3`}>
              <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
              <span className="text-sm text-hush-text-accent">Loading actor-scoped election hub...</span>
            </div>
          ) : hubEntries.length === 0 ? (
            <ElectionAccessBoundaryNotice
              title="No linked election surfaces available"
              message={emptyStateReason}
              details={[
                'Use Search Election from the left menu to find an election before claim-linking your organization voter identifier.',
                'Use Create Election from the left menu to start a new owner draft.',
                'After the eligibility claim succeeds, the election will appear in this hub.',
              ]}
              primaryHref={null}
              primaryLabel={null}
            />
          ) : (
            <div className="pt-2 md:pt-3">
              <ElectionHubList
                entries={hubEntries}
                selectedElectionId={null}
                onSelect={handleSelectElection}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-green-500/40 bg-green-500/10 text-green-100'
                : 'border-red-500/40 bg-red-500/10 text-red-100'
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-medium">
              {feedback.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{feedback.message}</span>
            </div>
            {feedback.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {requestedEntryMissing ? (
          <ElectionAccessBoundaryNotice
            title="Requested election is not available here"
            message={`The route for election ${initialElectionId} does not resolve to a visible workspace for this account.`}
            details={[
              'Return to HushVoting! Hub to choose another linked election.',
              'This route only opens elections that the current actor can access.',
            ]}
          />
        ) : !activeEntry ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Preparing election workspace...</span>
          </div>
        ) : (
          <>
            <ElectionWorkspaceHeader entry={activeEntry} />
            <ClosedProgressBanner entry={activeEntry} />

            {hasPendingInvitationSurface && pendingSelfTrusteeInvitation ? (
              <PendingTrusteeInvitationSummary
                electionTitle={activeEntry.Election.Title || activeEntry.Election.ElectionId}
                invitation={pendingSelfTrusteeInvitation}
                isSubmitting={isSubmitting}
                onAccept={() => void handleAcceptPendingTrusteeInvitation()}
                onReject={() => void handleRejectPendingTrusteeInvitation()}
              />
            ) : null}

            {!hasVisibleSections && !hasPendingInvitationSurface && !isWaitingForPendingInvitationDetail ? (
              <ElectionAccessBoundaryNotice
                title="No workspace surface is available"
                message={
                  activeEntry.SuggestedActionReason ||
                  'This actor does not currently have an owner, trustee, voter, auditor, or result-review surface for the selected election.'
                }
                primaryLabel="Back to HushVoting! Hub"
              />
            ) : null}

            {isLoadingDetail && !activeDetail ? (
              <div className={`${sectionClass} flex items-center gap-3`}>
                <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
                <span className="text-sm text-hush-text-accent">
                  Loading detailed context for {activeEntry.Election.Title || activeEntry.Election.ElectionId}...
                </span>
              </div>
            ) : null}

            {sectionOrder.includes('voter') ? (
              <VoterWorkspaceSummary
                entry={activeEntry}
                actorPublicAddress={actorPublicAddress}
                resultView={resultView}
              />
            ) : null}

            {sectionOrder.includes('owner-admin') ? (
              <OwnerAdminWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
              />
            ) : null}

            {sectionOrder.includes('trustee') ? (
              <TrusteeWorkspaceSummary entry={activeEntry} detail={activeDetail} />
            ) : null}

            {sectionOrder.includes('auditor') ? (
              <AuditorWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
                resultView={resultView}
                isLoadingResultView={isLoadingResultView}
              />
            ) : null}

            {sectionOrder.includes('results') ? (
              <ResultsWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
                resultView={resultView}
                isLoadingResultView={isLoadingResultView}
              />
            ) : null}

            {!sectionOrder.includes('results') && activeEntry.HasOfficialResult ? (
              <section className={sectionClass}>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-green-500/10 p-3 text-green-100">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      Official result exists
                    </div>
                    <p className="mt-2 text-sm text-hush-text-accent">
                      The election record already carries an official result, but this actor does
                      not currently have a result-review surface for it.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

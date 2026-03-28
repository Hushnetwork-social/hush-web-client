"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  MoveDown,
  MoveUp,
  Plus,
  RefreshCcw,
  Save,
  ShieldAlert,
  Square,
} from 'lucide-react';
import {
  ElectionBindingStatusProto,
  type ElectionDraftInput,
  ElectionGovernedActionTypeProto,
  ElectionGovernanceModeProto,
  type ResolveElectionTrusteeInvitationRequest,
  ElectionTrusteeInvitationStatusProto,
  ElectionWarningCodeProto,
  OutcomeRuleKindProto,
} from '@/lib/grpc';
import {
  BINDING_OPTIONS,
  GOVERNANCE_OPTIONS,
  OUTCOME_RULE_OPTIONS,
  WARNING_CHOICES,
  applyGovernanceModeDefaults,
  canCloseElection,
  canFinalizeElection,
  canOpenElection,
  createDefaultElectionDraft,
  createDraftFromElectionDetail,
  createElectionOption,
  createOutcomeRuleForKind,
  formatArtifactValue,
  formatTimestamp,
  getBindingLabel,
  getDisclosureModeLabel,
  getDraftOpenValidationErrors,
  getDraftRevisionLabel,
  getDraftSaveValidationErrors,
  type GovernedActionViewState,
  getElectionClassLabel,
  getGovernedActionLabel,
  getGovernedActionViewStates,
  getGovernedProposalExecutionStatusLabel,
  getEligibilityMutationLabel,
  getEligibilitySourceLabel,
  getGovernanceLabel,
  getLifecycleLabel,
  getOutcomeRuleLabel,
  getParticipationPrivacyLabel,
  getReportingPolicyLabel,
  getRequiredOpenWarningCodes,
  getReviewWindowPolicyLabel,
  getSummaryBadge,
  getUnsupportedDraftValueMessages,
  getVoteUpdatePolicyLabel,
  getWarningTitle,
  isDraftEditable,
  normalizeElectionDraft,
  renumberElectionOptions,
} from './contracts';
import { ElectionCeremonyWorkspaceSection } from './ElectionCeremonyWorkspaceSection';
import { ElectionEligibilityWorkspaceSection } from './ElectionEligibilityWorkspaceSection';
import { ElectionFinalizationWorkspaceSection } from './ElectionFinalizationWorkspaceSection';
import { useElectionsStore } from './useElectionsStore';

type ElectionsWorkspaceProps = {
  ownerPublicAddress: string;
  ownerEncryptionPublicKey?: string;
  ownerEncryptionPrivateKey?: string;
  ownerSigningPrivateKey: string;
};

type FixedPolicyItem = {
  label: string;
  value: string;
  note: string;
};

const sectionClass =
  'rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10';

function getInvitationStatusLabel(status: ElectionTrusteeInvitationStatusProto): string {
  switch (status) {
    case ElectionTrusteeInvitationStatusProto.Pending:
      return 'Pending';
    case ElectionTrusteeInvitationStatusProto.Accepted:
      return 'Accepted';
    case ElectionTrusteeInvitationStatusProto.Rejected:
      return 'Rejected';
    case ElectionTrusteeInvitationStatusProto.Revoked:
      return 'Revoked';
    default:
      return 'Unknown';
  }
}

function getGovernedActionStatusLabel(status: GovernedActionViewState['status']): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'pending':
      return 'Pending';
    case 'execution_failed':
      return 'Execution failed';
    case 'completed':
      return 'Completed';
    case 'finalize_not_tally_ready':
      return 'Awaiting tally readiness';
    case 'unavailable':
    default:
      return 'Unavailable';
  }
}

function getGovernedActionStatusClass(status: GovernedActionViewState['status']): string {
  switch (status) {
    case 'available':
      return 'border-green-500/40 bg-green-500/10 text-green-100';
    case 'pending':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
    case 'execution_failed':
      return 'border-red-500/40 bg-red-500/10 text-red-100';
    case 'completed':
      return 'border-hush-purple/40 bg-hush-purple/10 text-hush-purple';
    case 'finalize_not_tally_ready':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-100';
    case 'unavailable':
    default:
      return 'border-hush-bg-light bg-hush-bg-dark text-hush-text-accent';
  }
}

function toggleWarningCode(
  draft: ElectionDraftInput,
  warningCode: ElectionWarningCodeProto,
  checked: boolean
): ElectionDraftInput {
  const nextCodes = new Set(draft.AcknowledgedWarningCodes);
  if (checked) {
    nextCodes.add(warningCode);
  } else {
    nextCodes.delete(warningCode);
  }

  return {
    ...draft,
    AcknowledgedWarningCodes: Array.from(nextCodes).sort((left, right) => left - right),
  };
}

export function ElectionsWorkspace({
  ownerPublicAddress,
  ownerEncryptionPublicKey,
  ownerEncryptionPrivateKey,
  ownerSigningPrivateKey,
}: ElectionsWorkspaceProps) {
  const {
    beginNewElection,
    ceremonyActionView,
    clearFeedback,
    closeElection,
    createDraft,
    elections,
    error,
    feedback,
    finalizeElection,
    inviteTrustee,
    isLoadingCeremonyActionView,
    isLoadingDetail,
    isLoadingList,
    isSubmitting,
    loadCeremonyActionView,
    loadElection,
    loadOpenReadiness,
    loadOwnerDashboard,
    openElection,
    openReadiness,
    reset,
    revokeInvitation,
    selectedElection,
    selectedElectionId,
    setOwnerPublicAddress,
    startElectionCeremony,
    startGovernedProposal,
    restartElectionCeremony,
    retryGovernedProposalExecution,
    updateDraft,
  } = useElectionsStore();

  const [draft, setDraft] = useState<ElectionDraftInput>(() => createDefaultElectionDraft());
  const [snapshotReason, setSnapshotReason] = useState('Initial draft');
  const [trusteeUserAddress, setTrusteeUserAddress] = useState('');
  const [trusteeDisplayName, setTrusteeDisplayName] = useState('');

  const election = selectedElection?.Election;
  const latestDraftSnapshot = selectedElection?.LatestDraftSnapshot;
  const trusteeInvitations = useMemo(
    () => selectedElection?.TrusteeInvitations ?? [],
    [selectedElection?.TrusteeInvitations]
  );
  const warningAcknowledgements = useMemo(
    () => selectedElection?.WarningAcknowledgements ?? [],
    [selectedElection?.WarningAcknowledgements]
  );
  const boundaryArtifacts = useMemo(
    () => selectedElection?.BoundaryArtifacts ?? [],
    [selectedElection?.BoundaryArtifacts]
  );
  const governedActionStates = useMemo(
    () => getGovernedActionViewStates(selectedElection ?? null),
    [selectedElection]
  );
  const finalizeActionState = useMemo(
    () =>
      governedActionStates.find(
        (state) => state.actionType === ElectionGovernedActionTypeProto.Finalize
      ) ?? null,
    [governedActionStates]
  );

  const acceptedTrusteeCount = useMemo(
    () =>
      trusteeInvitations.filter(
        (invitation) => invitation.Status === ElectionTrusteeInvitationStatusProto.Accepted
      ).length,
    [trusteeInvitations]
  );
  const pendingTrusteeCount = useMemo(
    () =>
      trusteeInvitations.filter(
        (invitation) => invitation.Status === ElectionTrusteeInvitationStatusProto.Pending
      ).length,
    [trusteeInvitations]
  );

  const unsupportedMessages = useMemo(() => getUnsupportedDraftValueMessages(draft), [draft]);
  const saveValidationErrors = useMemo(() => getDraftSaveValidationErrors(draft), [draft]);
  const openValidationErrors = useMemo(() => getDraftOpenValidationErrors(draft), [draft]);
  const requiredWarningCodes = useMemo(
    () => getRequiredOpenWarningCodes(draft, acceptedTrusteeCount),
    [acceptedTrusteeCount, draft]
  );
  const requiredWarningCodeKey = requiredWarningCodes.join(',');

  const fixedPolicyItems = useMemo<FixedPolicyItem[]>(
    () => [
      {
        label: 'Election class',
        value: getElectionClassLabel(draft.ElectionClass),
        note: 'Only organizational remote voting is executable in FEAT-094.',
      },
      {
        label: 'Disclosure mode',
        value: getDisclosureModeLabel(draft.DisclosureMode),
        note: 'Final results only is the only supported disclosure mode in this phase.',
      },
      {
        label: 'Participation privacy',
        value: getParticipationPrivacyLabel(draft.ParticipationPrivacyMode),
        note: 'Phase-one privacy keeps checkoff public while ballot choice stays private.',
      },
      {
        label: 'Vote update policy',
        value: getVoteUpdatePolicyLabel(draft.VoteUpdatePolicy),
        note: 'Single submission only is the only executable vote-update rule in FEAT-094.',
      },
      {
        label: 'Eligibility source',
        value: getEligibilitySourceLabel(draft.EligibilitySourceType),
        note: 'The owner-facing flow records the roster source now and defers enforcement to FEAT-095.',
      },
      {
        label: 'Eligibility mutation',
        value: getEligibilityMutationLabel(draft.EligibilityMutationPolicy),
        note: 'Roster state freezes at open in FEAT-094.',
      },
      {
        label: 'Reporting policy',
        value: getReportingPolicyLabel(draft.ReportingPolicy),
        note: 'The default phase-one reporting package is frozen into the election record.',
      },
      {
        label: 'Review window',
        value: getReviewWindowPolicyLabel(draft.ReviewWindowPolicy),
        note:
          draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold
            ? 'Trustee-threshold drafts reserve the governed review-window path for FEAT-096.'
            : 'Admin-only elections must stay on the no-review-window path in FEAT-094.',
      },
    ],
    [draft]
  );

  const draftRevisionLabel = getDraftRevisionLabel(latestDraftSnapshot, election);
  const saveButtonLabel = selectedElectionId ? 'Update Draft' : 'Create Draft';

  const canEditDraft = isDraftEditable(election);
  const supportsDirectOpen =
    election?.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold;
  const canOpenSelectedElection =
    supportsDirectOpen &&
    canOpenElection(election) &&
    unsupportedMessages.length === 0 &&
    saveValidationErrors.length === 0 &&
    openValidationErrors.length === 0;
  const canCloseSelectedElection = canCloseElection(election);
  const canFinalizeSelectedElection = canFinalizeElection(election);

  useEffect(() => {
    setOwnerPublicAddress(ownerPublicAddress);
    void loadOwnerDashboard(ownerPublicAddress);
  }, [loadOwnerDashboard, ownerPublicAddress, setOwnerPublicAddress]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!selectedElectionId) {
      setDraft(createDefaultElectionDraft());
      setSnapshotReason('Initial draft');
      return;
    }

    setDraft(createDraftFromElectionDetail(selectedElection ?? null));
    setSnapshotReason('Owner draft update');
  }, [selectedElection, selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId || !election || !canOpenSelectedElection) {
      return;
    }

    void loadOpenReadiness(requiredWarningCodes);
  }, [
    canOpenSelectedElection,
    election,
    loadOpenReadiness,
    requiredWarningCodeKey,
    requiredWarningCodes,
    selectedElectionId,
  ]);

  useEffect(() => {
    if (
      !selectedElectionId ||
      !election ||
      election.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold
    ) {
      return;
    }

    void loadCeremonyActionView(ownerPublicAddress, selectedElectionId);
  }, [
    election,
    loadCeremonyActionView,
    ownerPublicAddress,
    selectedElectionId,
  ]);

  const handleNewDraft = () => {
    beginNewElection();
    clearFeedback();
    setDraft(createDefaultElectionDraft());
    setSnapshotReason('Initial draft');
    setTrusteeUserAddress('');
    setTrusteeDisplayName('');
  };

  const handleSaveDraft = async () => {
    const normalizedDraft = normalizeElectionDraft(draft);
    setDraft(normalizedDraft);

    const reason = snapshotReason.trim();
    if (!reason) {
      return;
    }

    if (selectedElectionId) {
      await updateDraft(
        normalizedDraft,
        reason,
        ownerEncryptionPublicKey ?? '',
        ownerEncryptionPrivateKey ?? '',
        ownerSigningPrivateKey
      );
      return;
    }

    await createDraft(
      normalizedDraft,
      reason,
      ownerEncryptionPublicKey ?? '',
      ownerSigningPrivateKey,
    );
  };

  const handleGovernanceChange = (governanceMode: ElectionGovernanceModeProto) => {
    setDraft((current) => applyGovernanceModeDefaults(current, governanceMode));
  };

  const handleOutcomeRuleChange = (kind: OutcomeRuleKindProto) => {
    setDraft((current) => ({
      ...current,
      OutcomeRule: createOutcomeRuleForKind(kind),
    }));
  };

  const handleMoveOption = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.OwnerOptions.length) {
        return current;
      }

      const nextOptions = [...current.OwnerOptions];
      const [movedOption] = nextOptions.splice(index, 1);
      nextOptions.splice(targetIndex, 0, movedOption);

      return {
        ...current,
        OwnerOptions: renumberElectionOptions(nextOptions),
      };
    });
  };

  const handleRemoveOption = (index: number) => {
    setDraft((current) => {
      if (current.OwnerOptions.length <= 2) {
        return current;
      }

      const nextOptions = current.OwnerOptions.filter((_, optionIndex) => optionIndex !== index);
      return {
        ...current,
        OwnerOptions: renumberElectionOptions(nextOptions),
      };
    });
  };

  const handleInviteTrustee = async () => {
    if (!selectedElectionId || !trusteeUserAddress.trim() || !trusteeDisplayName.trim()) {
      return;
    }

    const didInvite = await inviteTrustee({
      ElectionId: selectedElectionId,
      ActorPublicAddress: ownerPublicAddress,
      TrusteeUserAddress: trusteeUserAddress.trim(),
      TrusteeDisplayName: trusteeDisplayName.trim(),
    }, ownerEncryptionPublicKey ?? '', ownerEncryptionPrivateKey ?? '', ownerSigningPrivateKey);

    if (didInvite) {
      setTrusteeUserAddress('');
      setTrusteeDisplayName('');
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!selectedElectionId) {
      return;
    }

    const request: ResolveElectionTrusteeInvitationRequest = {
      ElectionId: selectedElectionId,
      InvitationId: invitationId,
      ActorPublicAddress: ownerPublicAddress,
    };

    await revokeInvitation(
      request,
      ownerEncryptionPublicKey ?? '',
      ownerEncryptionPrivateKey ?? '',
      ownerSigningPrivateKey
    );
  };

  const handleOpenElection = async () => {
    if (!canOpenSelectedElection) {
      return;
    }

    const readiness = openReadiness ?? (await loadOpenReadiness(requiredWarningCodes));
    if (!readiness?.IsReadyToOpen) {
      return;
    }

    await openElection(
      requiredWarningCodes,
      ownerEncryptionPublicKey ?? '',
      ownerEncryptionPrivateKey ?? '',
      ownerSigningPrivateKey
    );
  };

  const handleCloseElection = async () => {
    await closeElection(
      ownerEncryptionPublicKey ?? '',
      ownerEncryptionPrivateKey ?? '',
      ownerSigningPrivateKey
    );
  };

  const handleFinalizeElection = async () => {
    await finalizeElection(
      ownerEncryptionPublicKey ?? '',
      ownerEncryptionPrivateKey ?? '',
      ownerSigningPrivateKey
    );
  };

  const handleEligibilityContextChanged = async () => {
    if (!selectedElectionId) {
      return;
    }

    await loadElection(selectedElectionId);
    if (election) {
      await loadOpenReadiness(requiredWarningCodes);
    }
  };

  const handleStartGovernedProposal = async (actionType: ElectionGovernedActionTypeProto) => {
    if (
      actionType === ElectionGovernedActionTypeProto.Open &&
      (saveValidationErrors.length > 0 || openValidationErrors.length > 0)
    ) {
      return;
    }

    await startGovernedProposal(
      actionType,
      ownerEncryptionPublicKey ?? '',
      ownerEncryptionPrivateKey ?? '',
      ownerSigningPrivateKey
    );
  };

  const handleRetryGovernedProposal = async (proposalId: string) => {
    await retryGovernedProposalExecution(
      proposalId,
      ownerEncryptionPublicKey ?? '',
      ownerEncryptionPrivateKey ?? '',
      ownerSigningPrivateKey
    );
  };

  const handleStartCeremony = async (profileId: string) => {
    if (!selectedElectionId) {
      return false;
    }

    return startElectionCeremony({
      ElectionId: selectedElectionId,
      ActorPublicAddress: ownerPublicAddress,
      ProfileId: profileId,
    }, ownerEncryptionPublicKey ?? '', ownerEncryptionPrivateKey ?? '', ownerSigningPrivateKey);
  };

  const handleRestartCeremony = async (profileId: string, restartReason: string) => {
    if (!selectedElectionId) {
      return false;
    }

    return restartElectionCeremony({
      ElectionId: selectedElectionId,
      ActorPublicAddress: ownerPublicAddress,
      ProfileId: profileId,
      RestartReason: restartReason,
    }, ownerEncryptionPublicKey ?? '', ownerEncryptionPrivateKey ?? '', ownerSigningPrivateKey);
  };

  return (
    <div className="min-h-screen bg-hush-bg-dark text-hush-text-primary">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/account"
              className="mb-3 inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to account</span>
            </Link>
            <h1 className="text-2xl font-semibold">Election Lifecycle Workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
              Create, edit, and progress FEAT-094 owner elections while keeping the frozen-policy
              boundary, warning acknowledgements, and trustee-threshold limitations explicit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewDraft}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
          >
            <Plus className="h-4 w-4" />
            <span>New Draft</span>
          </button>
        </div>

        {feedback && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
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
            {feedback.details.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={`${sectionClass} h-fit`} data-testid="elections-sidebar">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Owner Elections
                </h2>
                <p className="mt-1 text-xs text-hush-text-accent">
                  {isLoadingList ? 'Refreshing dashboard...' : `${elections.length} tracked election(s)`}
                </p>
              </div>
              {isLoadingList && <Loader2 className="h-4 w-4 animate-spin text-hush-purple" />}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleNewDraft}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedElectionId
                    ? 'border-hush-bg-light bg-hush-bg-dark hover:border-hush-purple/50'
                    : 'border-hush-purple bg-hush-purple/10'
                }`}
              >
                <div className="text-sm font-medium">Unsaved draft</div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  Start a new election configuration from FEAT-094 defaults.
                </div>
              </button>

              {elections.map((summary) => (
                <button
                  key={summary.ElectionId}
                  type="button"
                  onClick={() => void loadElection(summary.ElectionId)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedElectionId === summary.ElectionId
                      ? 'border-hush-purple bg-hush-purple/10'
                      : 'border-hush-bg-light bg-hush-bg-dark hover:border-hush-purple/50'
                  }`}
                  data-testid={`election-summary-${summary.ElectionId}`}
                >
                  <div className="text-sm font-medium">{summary.Title || 'Untitled election'}</div>
                  <div className="mt-1 text-xs text-hush-text-accent">
                    {getSummaryBadge(summary)}
                  </div>
                  <div className="mt-2 text-xs text-hush-text-accent">
                    Updated {formatTimestamp(summary.LastUpdatedAt)}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="space-y-6" data-testid="elections-workspace">
            <section className={sectionClass}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-hush-purple/10 px-3 py-1 text-xs font-medium text-hush-purple">
                      {getLifecycleLabel(election?.LifecycleState)}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {draftRevisionLabel}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {getBindingLabel(draft.BindingStatus)}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {getGovernanceLabel(draft.GovernanceMode)}
                    </span>
                    <span className="rounded-full bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
                      {getOutcomeRuleLabel(draft.OutcomeRule.Kind)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">
                    {draft.Title.trim() || 'Untitled election draft'}
                  </h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    Owner address: <span className="font-mono text-xs">{ownerPublicAddress}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {draft.BindingStatus === ElectionBindingStatusProto.NonBinding && (
                    <div
                      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                      data-testid="elections-binding-advisory"
                    >
                      Non-binding elections still freeze the same policy and lifecycle data, but the
                      result is advisory.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {selectedElectionId && !canEditDraft && (
              <section
                className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sky-100"
                data-testid="elections-read-only-banner"
              >
                Draft editing is frozen after open. FEAT-094 keeps this surface read-only while
                lifecycle state, warning evidence, and boundary artifacts remain visible.
              </section>
            )}

            {unsupportedMessages.length > 0 && (
              <section
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-100"
                data-testid="elections-unsupported-panel"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Unsupported FEAT-094 values detected</span>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {unsupportedMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className={sectionClass}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Election Metadata</h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    The title, reference code, and ordered options freeze at open.
                  </p>
                </div>
                {isLoadingDetail && <Loader2 className="h-4 w-4 animate-spin text-hush-purple" />}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Title
                  </span>
                  <input
                    type="text"
                    value={draft.Title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        Title: event.target.value,
                      }))
                    }
                    disabled={!canEditDraft || isSubmitting}
                    className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                    data-testid="elections-title-input"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    External Reference Code
                  </span>
                  <input
                    type="text"
                    value={draft.ExternalReferenceCode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ExternalReferenceCode: event.target.value,
                      }))
                    }
                    disabled={!canEditDraft || isSubmitting}
                    className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Short Description
                  </span>
                  <textarea
                    value={draft.ShortDescription}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ShortDescription: event.target.value,
                      }))
                    }
                    disabled={!canEditDraft || isSubmitting}
                    className="min-h-28 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Snapshot Reason
                  </span>
                  <input
                    type="text"
                    value={snapshotReason}
                    onChange={(event) => setSnapshotReason(event.target.value)}
                    disabled={!canEditDraft || isSubmitting}
                    className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={
                    !snapshotReason.trim() ||
                    saveValidationErrors.length > 0 ||
                    !canEditDraft ||
                    isSubmitting
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                  data-testid="elections-save-button"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{saveButtonLabel}</span>
                </button>
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="text-lg font-semibold">Frozen-Policy Setup</h2>
              <p className="mt-1 text-sm text-hush-text-accent">
                Only FEAT-094-supported v1 values are selectable for the executable path.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Binding status
                  </span>
                  <select
                    value={draft.BindingStatus}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        BindingStatus: Number(event.target.value) as ElectionBindingStatusProto,
                      }))
                    }
                    disabled={!canEditDraft || isSubmitting}
                    className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {BINDING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Governance mode
                  </span>
                  <select
                    value={draft.GovernanceMode}
                    onChange={(event) =>
                      handleGovernanceChange(
                        Number(event.target.value) as ElectionGovernanceModeProto
                      )
                    }
                    disabled={!canEditDraft || isSubmitting}
                    className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {GOVERNANCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Outcome rule
                  </span>
                  <select
                    value={draft.OutcomeRule.Kind}
                    onChange={(event) =>
                      handleOutcomeRuleChange(Number(event.target.value) as OutcomeRuleKindProto)
                    }
                    disabled={!canEditDraft || isSubmitting}
                    className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {OUTCOME_RULE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {fixedPolicyItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      {item.label}
                    </div>
                    <div className="mt-2 text-sm font-medium">{item.value}</div>
                    <div className="mt-2 text-xs text-hush-text-accent">{item.note}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={sectionClass}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Ordered Options</h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    FEAT-094 requires at least two non-blank options before open.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      OwnerOptions: renumberElectionOptions([
                        ...current.OwnerOptions,
                        createElectionOption(current.OwnerOptions.length + 1),
                      ]),
                    }))
                  }
                  disabled={!canEditDraft || isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add option</span>
                </button>
              </div>

              <div className="space-y-4">
                {draft.OwnerOptions.map((option, index) => (
                  <div
                    key={option.OptionId}
                    className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                          <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Ballot Order
                            </div>
                            <div className="mt-2 text-sm font-medium">{option.BallotOrder}</div>
                          </div>

                          <label className="text-sm">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                              Display Label
                            </span>
                            <input
                              type="text"
                              value={option.DisplayLabel}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  OwnerOptions: current.OwnerOptions.map((currentOption, optionIndex) =>
                                    optionIndex === index
                                      ? {
                                          ...currentOption,
                                          DisplayLabel: event.target.value,
                                        }
                                      : currentOption
                                  ),
                                }))
                              }
                              disabled={!canEditDraft || isSubmitting}
                              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                              data-testid={`elections-option-label-${index}`}
                            />
                          </label>
                        </div>

                        <label className="block text-sm">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                            Short Description
                          </span>
                          <input
                            type="text"
                            value={option.ShortDescription}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                OwnerOptions: current.OwnerOptions.map((currentOption, optionIndex) =>
                                  optionIndex === index
                                    ? {
                                        ...currentOption,
                                        ShortDescription: event.target.value,
                                      }
                                    : currentOption
                                ),
                              }))
                            }
                            disabled={!canEditDraft || isSubmitting}
                            className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                            data-testid={`elections-option-description-${index}`}
                          />
                        </label>

                        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-xs text-hush-text-accent">
                          Stable option id: <span className="font-mono">{option.OptionId}</span>
                        </div>
                      </div>

                      <div className="flex flex-row gap-2 lg:flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveOption(index, -1)}
                          disabled={!canEditDraft || isSubmitting || index === 0}
                          className="inline-flex items-center justify-center rounded-xl border border-hush-bg-light p-2 transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Move ${option.DisplayLabel || `option ${index + 1}`} up`}
                        >
                          <MoveUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOption(index, 1)}
                          disabled={
                            !canEditDraft ||
                            isSubmitting ||
                            index === draft.OwnerOptions.length - 1
                          }
                          className="inline-flex items-center justify-center rounded-xl border border-hush-bg-light p-2 transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Move ${option.DisplayLabel || `option ${index + 1}`} down`}
                        >
                          <MoveDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          disabled={!canEditDraft || isSubmitting || draft.OwnerOptions.length <= 2}
                          className="inline-flex items-center justify-center rounded-xl border border-hush-bg-light p-2 transition-colors hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Remove ${option.DisplayLabel || `option ${index + 1}`}`}
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold && (
              <section className={sectionClass}>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Trustee Draft Setup</h2>
                    <p className="mt-1 text-sm text-hush-text-accent">
                      Trustee invitations and approval-count metadata are configured here; the
                      governed `open`, `close`, and `finalize` actions are handled below through the
                      FEAT-096 proposal workflow.
                    </p>
                  </div>
                  <div
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
                    data-testid="elections-trustee-blocked-panel"
                  >
                    FEAT-096 is active for trustee-threshold elections. Critical lifecycle changes
                    now move through proposal approval instead of direct buttons.
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Required Approval Count
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={draft.RequiredApprovalCount ?? 1}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          RequiredApprovalCount: Math.max(1, Number(event.target.value) || 1),
                        }))
                      }
                      disabled={!canEditDraft || isSubmitting}
                      className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </label>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Accepted trustees
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{acceptedTrusteeCount}</div>
                    <div className="mt-1 text-xs text-hush-text-accent">
                      Pending invitations: {pendingTrusteeCount}
                    </div>
                  </div>

                  <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Review window policy
                    </div>
                    <div className="mt-2 text-sm font-medium">
                      {getReviewWindowPolicyLabel(draft.ReviewWindowPolicy)}
                    </div>
                    <div className="mt-2 text-xs text-hush-text-accent">
                      Reserved now so FEAT-096 can inherit the frozen policy boundary later.
                    </div>
                  </div>
                </div>

                {selectedElectionId ? (
                  <>
                    <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <label className="text-sm">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                          Trustee User Address
                        </span>
                        <input
                          type="text"
                          value={trusteeUserAddress}
                          onChange={(event) => setTrusteeUserAddress(event.target.value)}
                          disabled={!canEditDraft || isSubmitting}
                          data-testid="elections-trustee-user-address-input"
                          className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                          Trustee Display Name
                        </span>
                        <input
                          type="text"
                          value={trusteeDisplayName}
                          onChange={(event) => setTrusteeDisplayName(event.target.value)}
                          disabled={!canEditDraft || isSubmitting}
                          data-testid="elections-trustee-display-name-input"
                          className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => void handleInviteTrustee()}
                          disabled={
                            !canEditDraft ||
                            isSubmitting ||
                            !trusteeUserAddress.trim() ||
                            !trusteeDisplayName.trim()
                          }
                          data-testid="elections-invite-trustee-button"
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-hush-bg-light px-4 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          <span>Invite trustee</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {trusteeInvitations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                          No trustee invitations recorded yet.
                        </div>
                      ) : (
                        trusteeInvitations.map((invitation) => (
                          <div
                            key={invitation.Id}
                            className="flex flex-col gap-3 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <div className="text-sm font-medium">
                                {invitation.TrusteeDisplayName} ({invitation.TrusteeUserAddress})
                              </div>
                              <div className="mt-1 text-xs text-hush-text-accent">
                                {getInvitationStatusLabel(invitation.Status)} • Sent at draft revision{' '}
                                {invitation.SentAtDraftRevision}
                              </div>
                            </div>
                            {invitation.Status === ElectionTrusteeInvitationStatusProto.Pending &&
                              canEditDraft && (
                                <button
                                  type="button"
                                  onClick={() => void handleRevokeInvitation(invitation.Id)}
                                  disabled={isSubmitting}
                                  className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Square className="h-4 w-4" />
                                  )}
                                  <span>Revoke</span>
                                </button>
                              )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                    Save the draft first to create trustee invitations.
                  </div>
                )}
              </section>
            )}

            <section className={sectionClass}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Validation and Warning Acknowledgement</h2>
                <p className="mt-1 text-sm text-hush-text-accent">
                  Draft-save checks and pre-open checks are shown separately so the owner can keep
                  editing without guessing what still blocks open.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div
                  className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  data-testid="elections-validation-panel"
                >
                  <div className="text-sm font-semibold">Draft save checks</div>
                  {saveValidationErrors.length === 0 ? (
                    <div className="mt-3 text-sm text-green-200">Draft save validations are clear.</div>
                  ) : (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                      {saveValidationErrors.map((validationError) => (
                        <li key={validationError}>{validationError}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-sm font-semibold">Open checklist</div>
                  {openValidationErrors.length === 0 ? (
                    <div className="mt-3 text-sm text-green-200">
                      Local open-preparation checks are clear.
                    </div>
                  ) : (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-100">
                      {openValidationErrors.map((validationError) => (
                        <li key={validationError}>{validationError}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-sm font-semibold">Required warning choices before open</div>
                  {WARNING_CHOICES.map((warningChoice) => {
                    const checked = draft.AcknowledgedWarningCodes.includes(warningChoice.code);
                    return (
                      <label
                        key={warningChoice.code}
                        className="flex gap-3 rounded-xl border border-hush-bg-light px-3 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setDraft((current) =>
                              toggleWarningCode(current, warningChoice.code, event.target.checked)
                            )
                          }
                          disabled={!canEditDraft || isSubmitting}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium">{warningChoice.title}</span>
                          <span className="mt-1 block text-xs text-hush-text-accent">
                            {warningChoice.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Server open readiness</div>
                      <div className="mt-1 text-xs text-hush-text-accent">
                        This uses the current saved draft revision and the selected warning
                        acknowledgements.
                      </div>
                    </div>
                    {selectedElectionId && canOpenSelectedElection && (
                      <button
                        type="button"
                        onClick={() => void loadOpenReadiness(requiredWarningCodes)}
                        className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-3 py-2 text-sm transition-colors hover:border-hush-purple"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        <span>Refresh</span>
                      </button>
                    )}
                  </div>

                  {selectedElectionId && openReadiness ? (
                    <div className="mt-4 space-y-3" data-testid="elections-open-readiness">
                      <div
                        className={`rounded-xl border px-3 py-3 text-sm ${
                          openReadiness.IsReadyToOpen
                            ? 'border-green-500/40 bg-green-500/10 text-green-100'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                        }`}
                      >
                        {openReadiness.IsReadyToOpen ? 'Ready to open.' : 'Not ready to open yet.'}
                      </div>

                      <div className="text-xs text-hush-text-accent">
                        Required warning codes:{' '}
                        {openReadiness.RequiredWarningCodes.length > 0
                          ? openReadiness.RequiredWarningCodes
                              .map((warningCode) => getWarningTitle(warningCode))
                              .join(', ')
                          : 'None'}
                      </div>

                      {openReadiness.MissingWarningAcknowledgements.length > 0 && (
                        <div className="text-xs text-hush-text-accent">
                          Missing acknowledgements:{' '}
                          {openReadiness.MissingWarningAcknowledgements
                            .map((warningCode) => getWarningTitle(warningCode))
                            .join(', ')}
                        </div>
                      )}

                      {openReadiness.ValidationErrors.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
                          {openReadiness.ValidationErrors.map((validationError) => (
                            <li key={validationError}>{validationError}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-hush-text-accent">
                      {selectedElectionId
                        ? 'Save a valid admin-only draft to evaluate server open readiness.'
                        : 'Create the draft first to fetch server open readiness.'}
                    </div>
                  )}

                  <div
                    className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-xs text-hush-text-accent"
                    data-testid="elections-warning-evidence"
                  >
                    Persisted warning evidence on the selected election:{' '}
                    {warningAcknowledgements.length > 0
                      ? warningAcknowledgements
                          .map((acknowledgement) => getWarningTitle(acknowledgement.WarningCode))
                          .join(', ')
                      : 'No warning acknowledgements have been read back yet.'}
                  </div>
                </div>
              </div>
            </section>

            {selectedElectionId && (
              <ElectionEligibilityWorkspaceSection
                electionId={selectedElectionId}
                detail={selectedElection}
                actorPublicAddress={ownerPublicAddress}
                actorEncryptionPublicKey={ownerEncryptionPublicKey ?? ''}
                actorEncryptionPrivateKey={ownerEncryptionPrivateKey ?? ''}
                actorSigningPrivateKey={ownerSigningPrivateKey}
                onContextChanged={handleEligibilityContextChanged}
              />
            )}

            {election?.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold && (
              <ElectionCeremonyWorkspaceSection
                detail={selectedElection}
                actionView={ceremonyActionView}
                ownerPublicAddress={ownerPublicAddress}
                isSubmitting={isSubmitting}
                isLoadingCeremonyActionView={isLoadingCeremonyActionView}
                onStart={handleStartCeremony}
                onRestart={handleRestartCeremony}
              />
            )}

            {election?.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold && (
              <ElectionFinalizationWorkspaceSection
                detail={selectedElection}
                finalizeActionState={finalizeActionState}
              />
            )}

            {election?.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold && (
              <section className={sectionClass} data-testid="elections-governed-actions">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Governed Actions</h2>
                    <p className="mt-1 text-sm text-hush-text-accent">
                      FEAT-096 keeps critical `open`, `close`, and `finalize` transitions inside
                      the current workspace while making pending, failed, and unavailable states
                      explicit.
                    </p>
                  </div>
                  <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
                    Trustee-threshold elections use proposal approval instead of direct lifecycle
                    buttons.
                  </div>
                </div>

                {!selectedElectionId ? (
                  <div className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent">
                    Save the trustee-threshold draft first to start governed actions.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-3">
                    {governedActionStates.map((state) => {
                      const openWorkflowBlocked =
                        state.actionType === ElectionGovernedActionTypeProto.Open &&
                        (saveValidationErrors.length > 0 || openValidationErrors.length > 0);
                      const resolvedReason = openWorkflowBlocked
                        ? 'Resolve the draft-save and open-checklist issues below before starting the governed open request.'
                        : state.reason;

                      return (
                        <article
                          key={state.actionType}
                          className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                          data-testid={`elections-governed-card-${state.actionType}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {getGovernedActionLabel(state.actionType)} proposal
                              </div>
                              <div className="mt-1 text-xs text-hush-text-accent">
                                {state.requiredApprovalCount !== null
                                  ? `${state.approvalCount} of ${state.requiredApprovalCount} approvals recorded`
                                  : 'Approval threshold not yet recorded'}
                              </div>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${getGovernedActionStatusClass(state.status)}`}
                            >
                              {getGovernedActionStatusLabel(state.status)}
                            </span>
                          </div>

                          <p className="mt-4 text-sm text-hush-text-accent">{resolvedReason}</p>

                          {state.proposal && (
                            <div className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-xs text-hush-text-accent">
                              <div>
                                Proposal id:{' '}
                                <span className="font-mono text-hush-text-primary">{state.proposal.Id}</span>
                              </div>
                              <div className="mt-1">
                                Created: {formatTimestamp(state.proposal.CreatedAt)}
                              </div>
                              <div className="mt-1">
                                Execution state:{' '}
                                {getGovernedProposalExecutionStatusLabel(state.proposal.ExecutionStatus)}
                              </div>
                            </div>
                          )}

                          {state.approvals.length > 0 && (
                            <div className="mt-4 rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                                Recorded approvals
                              </div>
                              <div className="mt-3 space-y-2">
                                {state.approvals.map((approval) => (
                                  <div
                                    key={approval.Id}
                                    className="rounded-xl border border-hush-bg-light/60 px-3 py-2 text-xs text-hush-text-accent"
                                  >
                                    <div className="font-medium text-hush-text-primary">
                                      {approval.TrusteeDisplayName || approval.TrusteeUserAddress}
                                    </div>
                                    <div className="mt-1">
                                      Approved at {formatTimestamp(approval.ApprovedAt)}
                                    </div>
                                    {approval.ApprovalNote ? (
                                      <div className="mt-1 text-hush-text-primary">
                                        Note: {approval.ApprovalNote}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {state.status === 'available' && (
                              <button
                                type="button"
                                onClick={() => void handleStartGovernedProposal(state.actionType)}
                                disabled={isSubmitting || openWorkflowBlocked}
                                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                                data-testid={`elections-governed-start-${state.actionType}`}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Lock className="h-4 w-4" />
                                )}
                                <span>Start {state.label}</span>
                              </button>
                            )}

                            {state.status === 'execution_failed' && state.proposal && (
                              <button
                                type="button"
                                onClick={() => void handleRetryGovernedProposal(state.proposal!.Id)}
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-100 transition-colors hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid={`elections-governed-retry-${state.actionType}`}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-4 w-4" />
                                )}
                                <span>Retry execution</span>
                              </button>
                            )}

                            {state.proposal && (
                              <Link
                                href={`/account/elections/trustee/${state.proposal.ElectionId}/proposal/${state.proposal.Id}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple"
                              >
                                <span>Open trustee approval page</span>
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <section className={sectionClass}>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Lifecycle Controls and Frozen Policy View</h2>
                  <p className="mt-1 text-sm text-hush-text-accent">
                    FEAT-094 keeps lifecycle state, timestamps, warning evidence, and policy freeze
                    visible to the owner.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canOpenSelectedElection && (
                    <button
                      type="button"
                      onClick={() => void handleOpenElection()}
                      disabled={isSubmitting || !openReadiness?.IsReadyToOpen}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                      data-testid="elections-open-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>Open election</span>
                    </button>
                  )}

                  {canCloseSelectedElection && (
                    <button
                      type="button"
                      onClick={() => void handleCloseElection()}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
                      data-testid="elections-close-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span>Close election</span>
                    </button>
                  )}

                  {canFinalizeSelectedElection && (
                    <button
                      type="button"
                      onClick={() => void handleFinalizeElection()}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
                      data-testid="elections-finalize-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>Finalize election</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Lifecycle state
                  </div>
                  <div className="mt-2 text-sm font-medium">{getLifecycleLabel(election?.LifecycleState)}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Created at
                  </div>
                  <div className="mt-2 text-sm font-medium">{formatTimestamp(election?.CreatedAt)}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Opened at
                  </div>
                  <div className="mt-2 text-sm font-medium">{formatTimestamp(election?.OpenedAt)}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Closed / finalized
                  </div>
                  <div className="mt-2 text-sm font-medium">
                    {formatTimestamp(election?.FinalizedAt !== undefined ? election.FinalizedAt : election?.ClosedAt)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div
                  className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4"
                  data-testid="elections-frozen-policy"
                >
                  <div className="text-sm font-semibold">Frozen policy snapshot</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Binding
                      </div>
                      <div className="mt-1 text-sm">{getBindingLabel(draft.BindingStatus)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Governance
                      </div>
                      <div className="mt-1 text-sm">{getGovernanceLabel(draft.GovernanceMode)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Outcome rule
                      </div>
                      <div className="mt-1 text-sm">{getOutcomeRuleLabel(draft.OutcomeRule.Kind)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Review window
                      </div>
                      <div className="mt-1 text-sm">
                        {getReviewWindowPolicyLabel(draft.ReviewWindowPolicy)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Protocol Omega version
                      </div>
                      <div className="mt-1 text-sm">{draft.ProtocolOmegaVersion}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Warning evidence
                      </div>
                      <div className="mt-1 text-sm">
                        {warningAcknowledgements.length > 0
                          ? warningAcknowledgements.length
                          : draft.AcknowledgedWarningCodes.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-sm font-semibold">Boundary artifacts</div>
                  {boundaryArtifacts.length === 0 ? (
                    <div className="mt-3 text-sm text-hush-text-accent">
                      No lifecycle boundary artifacts have been recorded yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {boundaryArtifacts.map((artifact) => (
                        <div key={artifact.Id} className="rounded-xl border border-hush-bg-light px-3 py-3">
                          <div className="text-sm font-medium">
                            {getLifecycleLabel(artifact.LifecycleState)} artifact
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            Recorded {formatTimestamp(artifact.RecordedAt)} • Source draft revision{' '}
                            {artifact.SourceDraftRevision}
                          </div>
                          <div className="mt-2 text-xs text-hush-text-accent">
                            Frozen roster hash: {formatArtifactValue(artifact.FrozenEligibleVoterSetHash)}
                          </div>
                          <div className="mt-1 text-xs text-hush-text-accent">
                            Final tally hash: {formatArtifactValue(artifact.FinalEncryptedTallyHash)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

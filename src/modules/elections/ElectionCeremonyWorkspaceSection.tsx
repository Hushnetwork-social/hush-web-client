"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react';
import type {
  ElectionCeremonyTrusteeState,
  GetElectionCeremonyActionViewResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyVersionStatusProto,
  ElectionTrusteeCeremonyStateProto,
  ElectionTrusteeInvitationStatusProto,
} from '@/lib/grpc';
import {
  formatArtifactValue,
  formatTimestamp,
  getActiveCeremonyTrusteeStates,
  getActiveCeremonyVersion,
  getAllowedCeremonyProfiles,
  getCeremonyActionViewStates,
  getCeremonyVersionStatusLabel,
} from './contracts';
import { CeremonyTranscriptPanel } from './CeremonyTranscriptPanel';

type ElectionCeremonyWorkspaceSectionProps = {
  detail: GetElectionResponse | null;
  actionView: GetElectionCeremonyActionViewResponse | null;
  ownerPublicAddress: string;
  isSubmitting: boolean;
  isLoadingCeremonyActionView: boolean;
  pendingSaveAlignmentMessage?: string | null;
  onStart: (profileId: string) => Promise<boolean>;
  onRestart: (profileId: string, restartReason: string) => Promise<boolean>;
  onCompleteTrustee: (
    trusteeUserAddress: string,
    shareVersion: string,
    tallyPublicKeyFingerprint: string | null
  ) => Promise<boolean>;
  onRecordValidationFailure: (
    trusteeUserAddress: string,
    validationFailureReason: string,
    evidenceReference: string
  ) => Promise<boolean>;
};

type ModalMode = 'start' | 'restart' | null;
type OwnerValidationModalState = {
  mode: 'complete' | 'fail';
  trustee: ElectionCeremonyTrusteeState;
} | null;

type TrusteeProgressView = {
  label: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
};

function hasApprovalMetadata(state: ElectionCeremonyTrusteeState): boolean {
  return Boolean(state.ShareVersion?.trim());
}

function toTimestampMillis(
  timestamp:
    | { seconds?: number | string | bigint; nanos?: number }
    | null
    | undefined
): number {
  if (!timestamp) {
    return 0;
  }

  const seconds =
    typeof timestamp.seconds === 'bigint'
      ? Number(timestamp.seconds)
      : Number(timestamp.seconds ?? 0);
  const nanos = Number(timestamp.nanos ?? 0);
  return seconds * 1000 + Math.floor(nanos / 1_000_000);
}

function getTrusteeLastEventMillis(state: ElectionCeremonyTrusteeState): number {
  return toTimestampMillis(
    state.CompletedAt ??
      state.ValidationFailedAt ??
      state.MaterialSubmittedAt ??
      state.SelfTestSucceededAt ??
      state.JoinedAt ??
      state.TransportPublicKeyPublishedAt ??
      state.LastUpdatedAt
  );
}

function getTrusteeProgressView(state: ElectionCeremonyTrusteeState): TrusteeProgressView {
  if (state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted) {
    return {
      label: 'Step 5 ready: Export share backup',
      detail: 'Owner validation completed. The trustee can record the encrypted backup export now.',
      tone: 'success',
    };
  }

  if (state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted) {
    if (!hasApprovalMetadata(state)) {
      return {
        label: 'Resubmission required',
        detail: 'Older package format. Request resubmission.',
        tone: 'danger',
      };
    }

    return {
      label: 'Ready for owner approval',
      detail: 'Trustee-local steps are complete.',
      tone: 'warning',
    };
  }

  if (state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed) {
    return {
      label: 'Return to Step 3: Run self-test',
      detail: state.ValidationFailureReason || 'Owner validation sent this trustee back for another self-test cycle.',
      tone: 'danger',
    };
  }

  if (state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateRemoved) {
    return {
      label: 'Removed from active version',
      detail: 'This trustee no longer participates in the active ceremony version.',
      tone: 'neutral',
    };
  }

  if (state.SelfTestSucceededAt) {
    return {
      label: 'Step 4 ready: Submit ceremony package',
      detail: 'Self-test succeeded. Ceremony package submission is the next trustee-local step.',
      tone: 'success',
    };
  }

  if (state.JoinedAt) {
    return {
      label: 'Step 3 ready: Run self-test',
      detail: 'The trustee joined the active version. Self-test is the next step.',
      tone: 'neutral',
    };
  }

  if (state.TransportPublicKeyPublishedAt) {
    return {
      label: 'Step 2 ready: Join version',
      detail: 'The transport key is recorded. Joining the active version is next.',
      tone: 'neutral',
    };
  }

  return {
    label: 'Step 1 ready: Publish transport key',
    detail: 'No trustee-local ceremony progress has been recorded yet.',
    tone: 'neutral',
  };
}

function getTrusteeProgressToneClass(tone: TrusteeProgressView['tone']): string {
  switch (tone) {
    case 'success':
      return 'text-green-100';
    case 'warning':
      return 'text-amber-100';
    case 'danger':
      return 'text-red-100';
    case 'neutral':
    default:
      return 'text-hush-text-primary';
  }
}

function buildPreparedOwnerTallyFingerprint(
  activeVersion: GetElectionResponse['CeremonyVersions'][number] | null
): string {
  if (!activeVersion) {
    return '';
  }

  const recordedFingerprint = activeVersion.TallyPublicKeyFingerprint?.trim();
  if (recordedFingerprint) {
    return recordedFingerprint;
  }

  return `tally-kc-${String(activeVersion.VersionNumber).padStart(3, '0')}-${activeVersion.Id.slice(0, 12)}`;
}

export function ElectionCeremonyWorkspaceSection({
  detail,
  actionView,
  ownerPublicAddress,
  isSubmitting,
  isLoadingCeremonyActionView,
  pendingSaveAlignmentMessage = null,
  onStart,
  onRestart,
  onCompleteTrustee,
  onRecordValidationFailure,
}: ElectionCeremonyWorkspaceSectionProps) {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [restartReason, setRestartReason] = useState('Supersede the current version and restart.');
  const [validationModal, setValidationModal] = useState<OwnerValidationModalState>(null);
  const [validationFailureReason, setValidationFailureReason] = useState(
    'Deterministic ceremony validation failed. Run the self-test again and resubmit.'
  );
  const [validationEvidenceReference, setValidationEvidenceReference] = useState('');

  const allowedProfiles = useMemo(() => getAllowedCeremonyProfiles(detail), [detail]);
  const activeVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const trusteeStates = useMemo(() => getActiveCeremonyTrusteeStates(detail), [detail]);
  const ownerActions = useMemo(() => getCeremonyActionViewStates(actionView, 'owner'), [actionView]);
  const acceptedTrustees = useMemo(
    () =>
      (detail?.TrusteeInvitations ?? []).filter(
        (invitation) => invitation.Status === ElectionTrusteeInvitationStatusProto.Accepted
      ),
    [detail?.TrusteeInvitations]
  );
  const submittedTrustees = useMemo(
    () =>
      trusteeStates.filter(
        (state) => state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted
      ),
    [trusteeStates]
  );
  const reviewableSubmittedTrusteeCount = useMemo(
    () => submittedTrustees.filter((state) => hasApprovalMetadata(state)).length,
    [submittedTrustees]
  );
  const legacySubmittedTrusteeCount = submittedTrustees.length - reviewableSubmittedTrusteeCount;
  const queuedSubmittedTrustees = useMemo(
    () => [...submittedTrustees].sort((left, right) => getTrusteeLastEventMillis(left) - getTrusteeLastEventMillis(right)),
    [submittedTrustees]
  );
  const nextTrusteeForOwnerAction = useMemo(
    () => queuedSubmittedTrustees.find((state) => hasApprovalMetadata(state)) ?? queuedSubmittedTrustees[0] ?? null,
    [queuedSubmittedTrustees]
  );
  const isNextOwnerApprovalReady = nextTrusteeForOwnerAction ? hasApprovalMetadata(nextTrusteeForOwnerAction) : false;
  const completedTrusteeCount = useMemo(
    () =>
      trusteeStates.filter(
        (state) => state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted
      ).length,
    [trusteeStates]
  );
  const validationFailedTrusteeCount = useMemo(
    () =>
      trusteeStates.filter(
        (state) => state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed
      ).length,
    [trusteeStates]
  );
  const needsResubmissionTrusteeCount = legacySubmittedTrusteeCount + validationFailedTrusteeCount;
  const preparedOwnerTallyFingerprint = useMemo(
    () => buildPreparedOwnerTallyFingerprint(activeVersion),
    [activeVersion]
  );

  useEffect(() => {
    if (activeVersion?.ProfileId) {
      setSelectedProfileId(activeVersion.ProfileId);
      return;
    }

    if (!selectedProfileId && allowedProfiles.length > 0) {
      setSelectedProfileId(allowedProfiles[0].ProfileId);
    }
  }, [activeVersion?.ProfileId, allowedProfiles, selectedProfileId]);

  const startAction = ownerActions.find(
    (action) => action.actionType === ElectionCeremonyActionTypeProto.CeremonyActionStartVersion
  );
  const restartAction = ownerActions.find(
    (action) => action.actionType === ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion
  );
  const effectiveBlockedReasons = pendingSaveAlignmentMessage ? [] : actionView?.BlockedReasons ?? [];
  const effectiveStartReason =
    pendingSaveAlignmentMessage && startAction?.status !== 'available'
      ? pendingSaveAlignmentMessage
      : startAction?.reason;
  const effectiveRestartReason =
    pendingSaveAlignmentMessage && !activeVersion
      ? 'No active ceremony version exists yet.'
      : pendingSaveAlignmentMessage && restartAction?.status !== 'available'
        ? pendingSaveAlignmentMessage
      : restartAction?.reason;

  const isCeremonyReady =
    activeVersion?.Status === ElectionCeremonyVersionStatusProto.CeremonyVersionReady;
  const isAwaitingOwnerValidation = !isCeremonyReady && submittedTrustees.length > 0;
  const currentTrusteeCount = activeVersion?.TrusteeCount ?? acceptedTrustees.length;
  const showsFragilityWarning =
    !!detail?.Election?.RequiredApprovalCount &&
    currentTrusteeCount > 0 &&
    detail.Election.RequiredApprovalCount === currentTrusteeCount;

  const handleConfirm = async () => {
    if (!selectedProfileId) {
      return;
    }

    const didSucceed =
      modalMode === 'restart'
        ? await onRestart(selectedProfileId, restartReason.trim())
        : await onStart(selectedProfileId);

    if (didSucceed) {
      setModalMode(null);
    }
  };

  const openValidationFailureModal = (trusteeState: ElectionCeremonyTrusteeState) => {
    setValidationFailureReason(
      `${
        trusteeState.TrusteeDisplayName || trusteeState.TrusteeUserAddress
      } failed deterministic ceremony validation. Run the self-test again and resubmit.`
    );
    setValidationEvidenceReference('');
    setValidationModal({
      mode: 'fail',
      trustee: trusteeState,
    });
  };

  const selectedValidationNeedsTallyFingerprint =
    validationModal?.mode === 'complete' &&
    activeVersion?.Status === ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress &&
    completedTrusteeCount + 1 >= (activeVersion?.RequiredApprovalCount ?? Number.MAX_SAFE_INTEGER);

  const handleConfirmValidation = async () => {
    if (!validationModal) {
      return;
    }

    let didSucceed = false;
    if (validationModal.mode === 'complete') {
      const shareVersion = validationModal.trustee.ShareVersion?.trim() || '';
      if (!shareVersion) {
        return;
      }

      didSucceed = await onCompleteTrustee(
        validationModal.trustee.TrusteeUserAddress,
        shareVersion,
        selectedValidationNeedsTallyFingerprint ? preparedOwnerTallyFingerprint : null
      );
    } else {
      if (!validationFailureReason.trim()) {
        return;
      }

      didSucceed = await onRecordValidationFailure(
        validationModal.trustee.TrusteeUserAddress,
        validationFailureReason.trim(),
        validationEvidenceReference.trim()
      );
    }

    if (didSucceed) {
      setValidationModal(null);
      setValidationFailureReason('Deterministic ceremony validation failed. Run the self-test again and resubmit.');
      setValidationEvidenceReference('');
    }
  };

  return (
    <section
      className="rounded-2xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10"
      data-testid="elections-ceremony-section"
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Key Ceremony</h2>
          <p className="mt-1 max-w-3xl text-sm text-hush-text-accent">
            Establish the trustee share set before this election can open. The owner coordinates the
            draft workflow, but private shares stay with trustees.
          </p>
        </div>
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-xs text-hush-text-accent">
          Owner actor: <span className="font-mono text-hush-text-primary">{ownerPublicAddress}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Ceremony readiness
            </div>
            <div className="mt-3 flex items-center gap-3">
              {isCeremonyReady ? (
                <CheckCircle2 className="h-5 w-5 text-green-300" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-300" />
              )}
              <div>
                <div className="text-sm font-medium text-hush-text-primary">
                  {isCeremonyReady
                    ? 'A successful ceremony version is ready.'
                    : isAwaitingOwnerValidation
                      ? 'Submitted trustee packages are waiting for owner validation.'
                      : 'The election remains blocked in draft until the ceremony completes.'}
                </div>
                <div className="mt-1 text-sm text-hush-text-accent">
                  {activeVersion
                    ? isAwaitingOwnerValidation
                      ? legacySubmittedTrusteeCount > 0
                        ? `${reviewableSubmittedTrusteeCount} package(s) are reviewable and ${legacySubmittedTrusteeCount} older package(s) need resubmission in version ${activeVersion.VersionNumber}.`
                        : `${submittedTrustees.length} trustee package(s) are ready for owner validation in version ${activeVersion.VersionNumber}.`
                      : `Current version ${getCeremonyVersionStatusLabel(activeVersion.Status)} with ${trusteeStates.length} trustee state records.`
                    : 'Start the first version to create the active trustee share set.'}
                </div>
              </div>
            </div>

            {effectiveBlockedReasons.length ? (
              <ul className="mt-4 space-y-2 text-sm text-hush-text-accent">
                {effectiveBlockedReasons.map((reason) => (
                  <li
                    key={reason}
                    className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-3 py-2"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
            <label className="block text-sm" htmlFor="elections-ceremony-profile-select">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Ceremony profile
              </span>
            </label>
            <select
              id="elections-ceremony-profile-select"
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value)}
              disabled={isSubmitting || isLoadingCeremonyActionView || allowedProfiles.length === 0}
              className="mt-2 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:text-hush-text-accent"
              data-testid="elections-ceremony-profile-select"
            >
              {allowedProfiles.length === 0 ? (
                <option value="">No allowed profiles</option>
              ) : null}
              {allowedProfiles.map((profile) => (
                <option key={profile.ProfileId} value={profile.ProfileId}>
                  {profile.DisplayName}
                </option>
              ))}
            </select>
            {selectedProfileId ? (
              <p className="mt-2 text-sm text-hush-text-accent">
                {allowedProfiles.find((profile) => profile.ProfileId === selectedProfileId)?.Description
                  ?? 'Allowed by the current deployment.'}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModalMode('start')}
                disabled={
                  isSubmitting ||
                  isLoadingCeremonyActionView ||
                  !!pendingSaveAlignmentMessage ||
                  !selectedProfileId ||
                  startAction?.status !== 'available'
                }
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                data-testid="elections-ceremony-start-button"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>Start ceremony</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('restart')}
                disabled={
                  isSubmitting ||
                  isLoadingCeremonyActionView ||
                  !!pendingSaveAlignmentMessage ||
                  !selectedProfileId ||
                  restartAction?.status !== 'available'
                }
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 px-4 py-2 text-sm text-amber-100 transition-colors hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="elections-ceremony-restart-button"
              >
                <RefreshCcw className="h-4 w-4" />
                <span>Restart version</span>
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                startAction
                  ? { ...startAction, reason: effectiveStartReason ?? startAction.reason }
                  : null,
                restartAction
                  ? { ...restartAction, reason: effectiveRestartReason ?? restartAction.reason }
                  : null,
              ]
                .filter(Boolean)
                .map((action) => (
                <div
                  key={action!.actionType}
                  className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-3 py-3 text-sm"
                >
                  <div className="font-medium text-hush-text-primary">{action!.label}</div>
                  <div className="mt-1 text-hush-text-accent">{action!.reason}</div>
                </div>
              ))}
            </div>
          </div>

          {showsFragilityWarning ? (
            <div
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
              data-testid="elections-ceremony-warning-card"
            >
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                <span>Weak trustee configuration</span>
              </div>
              <p className="mt-2">
                Threshold equals the current active trustee count. Opening can still proceed when
                the ceremony is ready, but resilience is weak if one trustee becomes unavailable.
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Current version
                </div>
                <div className="mt-2 text-lg font-semibold text-hush-text-primary">
                  {activeVersion
                    ? `KC-${String(activeVersion.VersionNumber).padStart(3, '0')}`
                    : 'No active version'}
                </div>
                <div className="mt-1 text-sm text-hush-text-accent">
                  {activeVersion
                    ? `${activeVersion.ProfileId} • ${getCeremonyVersionStatusLabel(activeVersion.Status)}`
                    : 'Start the first version to bind the roster and profile.'}
                </div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-element/60 px-3 py-2 text-xs text-hush-text-accent">
                Fingerprint: {formatArtifactValue(activeVersion?.TallyPublicKeyFingerprint)}
              </div>
            </div>

            {activeVersion ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Trustees
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">{activeVersion.TrusteeCount}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Threshold
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {activeVersion.RequiredApprovalCount} of {activeVersion.TrusteeCount}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Started
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {formatTimestamp(activeVersion.StartedAt)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
            {submittedTrustees.length > 0 || validationFailedTrusteeCount > 0 ? (
              <div
                className="mb-4 rounded-2xl bg-[#18203a] px-4 py-4 shadow-inner shadow-black/10"
                data-testid="elections-ceremony-owner-validation-queue"
              >
                <div className="text-sm font-semibold text-hush-text-primary">Owner validation queue</div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-[#151c33] px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Ready for approval
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">{reviewableSubmittedTrusteeCount}</div>
                    </div>
                    <div className="rounded-xl bg-[#151c33] px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Approved toward threshold
                      </div>
                    <div className="mt-2 text-sm text-hush-text-primary">
                      {completedTrusteeCount} of {activeVersion?.RequiredApprovalCount ?? 0}
                    </div>
                    </div>
                  <div className="rounded-xl bg-[#151c33] px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Needs resubmission
                    </div>
                    <div className="mt-2 text-sm text-hush-text-primary">{needsResubmissionTrusteeCount}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-hush-text-accent">
                  {reviewableSubmittedTrusteeCount > 0
                    ? needsResubmissionTrusteeCount > 0
                      ? `${reviewableSubmittedTrusteeCount} trustee package(s) are ready for approval now. ${needsResubmissionTrusteeCount} trustee(s) still need to rerun self-test and resubmit. Owner approval is recorded one trustee at a time until ${activeVersion?.RequiredApprovalCount ?? 0} approved share(s) are recorded. Approving one ready trustee does not change the returned trustees.`
                      : `Approve the available trustee shares one trustee at a time until ${activeVersion?.RequiredApprovalCount ?? 0} approved share(s) are recorded.`
                    : 'No trustee is ready for approval yet. Returned trustees must rerun self-test and resubmit before owner approval can continue.'}
                </div>

                {legacySubmittedTrusteeCount > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {legacySubmittedTrusteeCount} submitted package(s) are still using the older format. Step 5 is not the blocker for those trustees. Use <span className="font-medium">Request resubmission</span> so they can rerun self-test and submit an approvable package.
                  </div>
                ) : null}

                {nextTrusteeForOwnerAction ? (
                  <div className="mt-4 rounded-2xl bg-[#151c33] px-4 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                          Next trustee ready for approval
                        </div>
                        <div className="mt-2 text-base font-semibold text-hush-text-primary">
                          Approve {nextTrusteeForOwnerAction.TrusteeDisplayName || nextTrusteeForOwnerAction.TrusteeUserAddress}
                        </div>
                        <div className="mt-1 text-sm text-hush-text-accent">
                          {isNextOwnerApprovalReady
                            ? `Approving this trustee records 1 approved share toward the ${activeVersion?.RequiredApprovalCount ?? 0}-share threshold. The other returned trustees stay returned until they rerun self-test and resubmit.`
                            : 'This submission is missing approval metadata from an older ceremony package format. Step 5 is not the blocker. Request resubmission so the trustee can rerun self-test and submit an approvable package.'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isNextOwnerApprovalReady ? (
                          <button
                            type="button"
                            onClick={() =>
                              setValidationModal({
                                mode: 'complete',
                                trustee: nextTrusteeForOwnerAction,
                              })
                            }
                            disabled={isSubmitting}
                            className="rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                            data-testid="elections-ceremony-approve-next"
                          >
                            Approve trustee share
                          </button>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
                            No trustee ready for approval
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openValidationFailureModal(nextTrusteeForOwnerAction)}
                          disabled={isSubmitting}
                          className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm text-amber-100 transition-colors hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="elections-ceremony-return-next"
                        >
                          Request resubmission
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="text-sm font-semibold">Trustee progress</div>
            {trusteeStates.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">
                    <tr>
                      <th className="pb-2 pr-4">Trustee</th>
                      <th className="pb-2 pr-4">Progress</th>
                      <th className="pb-2 pr-4">Last event</th>
                      <th className="pb-2 text-right">Owner action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hush-bg-light/60">
                    {trusteeStates.map((state) => {
                      const progress = getTrusteeProgressView(state);
                      const canApproveTrustee =
                        state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted &&
                        hasApprovalMetadata(state);
                      const canRequestResubmission =
                        state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted;
                      return (
                        <tr key={state.Id}>
                          <td className="py-3 pr-4 text-hush-text-primary">
                            {state.TrusteeDisplayName || state.TrusteeUserAddress}
                          </td>
                          <td className="py-3 pr-4">
                            <div className={`font-medium ${getTrusteeProgressToneClass(progress.tone)}`}>
                              {progress.label}
                            </div>
                            <div className="mt-1 text-xs text-hush-text-accent">{progress.detail}</div>
                          </td>
                          <td className="py-3 pr-4 text-hush-text-accent">
                            {formatTimestamp(
                              state.CompletedAt
                                ?? state.ValidationFailedAt
                                ?? state.MaterialSubmittedAt
                                ?? state.SelfTestSucceededAt
                                ?? state.JoinedAt
                                ?? state.TransportPublicKeyPublishedAt
                                ?? state.LastUpdatedAt
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {canApproveTrustee || canRequestResubmission ? (
                              <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                {canApproveTrustee ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setValidationModal({
                                        mode: 'complete',
                                        trustee: state,
                                      })
                                    }
                                    disabled={isSubmitting}
                                    className="rounded-xl bg-hush-purple px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                                    data-testid={`elections-ceremony-complete-${state.TrusteeUserAddress}`}
                                  >
                                    Approve share
                                  </button>
                                ) : (
                                  <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
                                    Not ready for approval
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openValidationFailureModal(state)}
                                  disabled={isSubmitting}
                                  className="rounded-xl border border-amber-500/40 px-3 py-2 text-xs text-amber-100 transition-colors hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  data-testid={`elections-ceremony-return-${state.TrusteeUserAddress}`}
                                >
                                  Request resubmission
                                </button>
                              </div>
                            ) : state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted ? (
                              <span className="inline-flex rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-100">
                                Validated
                              </span>
                            ) : state.State === ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed ? (
                              <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-100">
                                Returned
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-hush-bg-element/70 px-3 py-1 text-xs text-hush-text-accent">
                                Waiting
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-hush-bg-light px-3 py-4 text-sm text-hush-text-accent">
                No trustee progress has been recorded for the active version yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <CeremonyTranscriptPanel detail={detail} defaultExpandLatestActiveGroup={false} />
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-hush-bg-light bg-hush-bg-element p-6 shadow-2xl shadow-black/30">
            <div className="text-xl font-semibold text-hush-text-primary">
              {modalMode === 'restart' ? 'Restart ceremony version' : 'Start key ceremony version'}
            </div>
            <p className="mt-2 text-sm text-hush-text-accent">
              {modalMode === 'restart'
                ? 'Restarting supersedes the current version and removes its progress from the active path.'
                : 'Starting creates a new draft ceremony version for the selected trustee roster and profile.'}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Profile
                </div>
                <div className="mt-2 text-sm text-hush-text-primary">{selectedProfileId}</div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Threshold
                </div>
                <div className="mt-2 text-sm text-hush-text-primary">
                  {detail?.Election?.RequiredApprovalCount ?? '-'} of {currentTrusteeCount || '-'}
                </div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Accepted trustees
                </div>
                <div className="mt-2 text-sm text-hush-text-primary">{acceptedTrustees.length}</div>
              </div>
            </div>

            {modalMode === 'restart' ? (
              <label className="mt-5 block text-sm" htmlFor="elections-ceremony-restart-reason">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Restart reason
                </span>
                <textarea
                  id="elections-ceremony-restart-reason"
                  value={restartReason}
                  onChange={(event) => setRestartReason(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 outline-none transition-colors focus:border-hush-purple"
                  data-testid="elections-ceremony-restart-reason"
                />
              </label>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-xl border border-hush-bg-light px-4 py-2 text-sm text-hush-text-accent transition-colors hover:border-hush-purple"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={
                  isSubmitting ||
                  !selectedProfileId ||
                  (modalMode === 'restart' && restartReason.trim().length === 0)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                data-testid="elections-ceremony-confirm-button"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{modalMode === 'restart' ? 'Restart version' : 'Start version'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {validationModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-hush-bg-light bg-hush-bg-element p-6 shadow-2xl shadow-black/30">
            <div className="text-xl font-semibold text-hush-text-primary">
              {validationModal.mode === 'complete'
                ? 'Approve trustee share'
                : 'Request trustee resubmission'}
            </div>
            <p className="mt-2 text-sm text-hush-text-accent">
              {validationModal.mode === 'complete'
                ? `Review the recorded metadata, then approve this single trustee share. This records exactly one approved share toward the ${activeVersion?.RequiredApprovalCount ?? 0}-share threshold. Returned trustees stay returned until they resubmit.`
                : 'This records a validation failure or missing-package-metadata return and sends the trustee back to the self-test step.'}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Trustee
                </div>
                <div className="mt-2 text-sm text-hush-text-primary">
                  {validationModal.trustee.TrusteeDisplayName || validationModal.trustee.TrusteeUserAddress}
                </div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Share version
                </div>
                <div className="mt-2 text-sm text-hush-text-primary">
                  {validationModal.trustee.ShareVersion || 'Not recorded'}
                </div>
              </div>
              <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Ceremony outcome
                </div>
                <div className="mt-2 text-sm text-hush-text-primary">
                  {selectedValidationNeedsTallyFingerprint
                    ? 'This validation reaches readiness'
                    : validationModal.mode === 'complete'
                      ? 'Progresses toward readiness'
                      : 'Returns trustee to self-test'}
                </div>
              </div>
            </div>

            {validationModal.mode === 'complete' ? (
              <div className="mt-5 rounded-xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-4 text-sm text-hush-text-accent">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Prepared tally fingerprint
                </div>
                <div className="mt-2 font-mono text-xs text-hush-text-primary">
                  {selectedValidationNeedsTallyFingerprint
                    ? preparedOwnerTallyFingerprint
                    : 'Not required for this validation step'}
                </div>
                <div className="mt-2">
                  {selectedValidationNeedsTallyFingerprint
                    ? 'This approval crosses the trustee threshold, so the ceremony version will be marked ready with the prepared tally fingerprint.'
                    : 'The ceremony remains in progress after this validation until enough trustees are completed.'}
                </div>
              </div>
            ) : (
              <>
                <label className="mt-5 block text-sm" htmlFor="elections-ceremony-validation-failure-reason">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Validation failure reason
                  </span>
                  <textarea
                    id="elections-ceremony-validation-failure-reason"
                    value={validationFailureReason}
                    onChange={(event) => setValidationFailureReason(event.target.value)}
                    className="mt-2 min-h-24 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 outline-none transition-colors focus:border-hush-purple"
                    data-testid="elections-ceremony-validation-failure-reason"
                  />
                </label>

                <label className="mt-4 block text-sm" htmlFor="elections-ceremony-validation-evidence-reference">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Evidence reference
                  </span>
                  <input
                    id="elections-ceremony-validation-evidence-reference"
                    value={validationEvidenceReference}
                    onChange={(event) => setValidationEvidenceReference(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 outline-none transition-colors focus:border-hush-purple"
                    placeholder="Optional evidence or review reference"
                    data-testid="elections-ceremony-validation-evidence-reference"
                  />
                </label>
              </>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setValidationModal(null)}
                className="rounded-xl border border-hush-bg-light px-4 py-2 text-sm text-hush-text-accent transition-colors hover:border-hush-purple"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmValidation()}
                disabled={
                  isSubmitting ||
                  (validationModal.mode === 'complete' && !validationModal.trustee.ShareVersion?.trim()) ||
                  (validationModal.mode === 'fail' && validationFailureReason.trim().length === 0)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                data-testid="elections-ceremony-validation-confirm-button"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>
                  {validationModal.mode === 'complete'
                    ? 'Approve trustee share'
                    : 'Request resubmission'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

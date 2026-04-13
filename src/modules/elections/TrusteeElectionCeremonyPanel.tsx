"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { ElectionCeremonyActionTypeProto, ElectionTrusteeCeremonyStateProto } from '@/lib/grpc';
import {
  DEFAULT_PROTOCOL_OMEGA_VERSION,
  type CeremonyActionViewState,
  formatTimestamp,
  getActiveCeremonyVersion,
  getCeremonyActionViewStates,
  getCeremonyShareCustodyStatusLabel,
  getTrusteeCeremonyStateLabel,
} from './contracts';
import { CeremonyTranscriptPanel } from './CeremonyTranscriptPanel';
import { useElectionsStore } from './useElectionsStore';

type TrusteeElectionCeremonyPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

type PreparedPackage = {
  transportPublicKeyFingerprint: string;
  messageType: string;
  payloadVersion: string;
  payloadFingerprint: string;
  encryptedPayload: string;
  shareVersion: string;
};

const sectionClass = 'rounded-3xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10';
const insetSurfaceClass = 'rounded-[24px] bg-[#18203a] p-4 shadow-inner shadow-black/10';
const valueWellClass = 'rounded-2xl bg-[#151c33] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]';
const primaryButtonClass = 'mt-4 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent';
const CEREMONY_REFRESH_INTERVAL_MS = 5_000;
const stepSequence = [
  ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
  ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
  ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
  ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
  ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
] as const;

function token(value: string | number | null | undefined): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 10);
}

function getPreparedPackage(
  actorPublicAddress: string,
  electionId: string,
  protocolVersion: string,
  profileId: string,
  versionId: string,
  versionNumber: number,
): PreparedPackage {
  const suffix = [`kc${String(versionNumber).padStart(3, '0')}`, token(profileId), token(actorPublicAddress), token(versionId)].filter(Boolean).join('-');
  return {
    transportPublicKeyFingerprint: `transport-${suffix}`,
    messageType: 'dkg-share-package',
    payloadVersion: protocolVersion,
    payloadFingerprint: `package-${suffix}`,
    encryptedPayload: JSON.stringify({ packageKind: 'trustee-ceremony-package', electionId, ceremonyVersionId: versionId, protocolVersion, profileId, trusteeUserAddress: actorPublicAddress, versionNumber }),
    shareVersion: `share-${suffix}`,
  };
}

function getFocusedAction(actions: CeremonyActionViewState[]): CeremonyActionViewState | null {
  return actions.find((action) => action.status === 'available')
    ?? actions.slice().reverse().find((action) => action.status === 'completed')
    ?? actions.find((action) => action.status === 'blocked')
    ?? actions.at(-1)
    ?? null;
}

function getGuidedActionsFromView(view: ReturnType<typeof useElectionsStore.getState>['ceremonyActionView']) {
  const trusteeActions = getCeremonyActionViewStates(view, 'trustee');
  return stepSequence.flatMap((type) => trusteeActions.find((action) => action.actionType === type) ?? []);
}

function getStatusPillClass(status: CeremonyActionViewState['status']): string {
  if (status === 'completed') return 'bg-green-500/10 text-green-100 ring-green-500/35';
  if (status === 'available') return 'bg-hush-purple/10 text-hush-purple ring-hush-purple/35';
  return 'bg-hush-bg-dark/80 text-hush-text-accent ring-white/10';
}

export function TrusteeElectionCeremonyPanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: TrusteeElectionCeremonyPanelProps) {
  const {
    ceremonyActionView,
    error,
    feedback,
    isLoadingCeremonyActionView,
    isLoadingDetail,
    isSubmitting,
    joinElectionCeremony,
    loadCeremonyActionView,
    loadElection,
    publishElectionCeremonyTransportKey,
    recordElectionCeremonySelfTestSuccess,
    recordElectionCeremonyShareExport,
    reset,
    selectedElection,
    submitElectionCeremonyMaterial,
  } = useElectionsStore();
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  useEffect(() => { void loadElection(electionId); void loadCeremonyActionView(actorPublicAddress, electionId); }, [actorPublicAddress, electionId, loadCeremonyActionView, loadElection]);
  useEffect(() => () => reset(), [reset]);
  useEffect(() => {
    let refreshInFlight = false;

    const refreshCeremonyContext = async () => {
      if (refreshInFlight) {
        return;
      }

      refreshInFlight = true;
      try {
        await Promise.all([
          loadElection(electionId, { silent: true }),
          loadCeremonyActionView(actorPublicAddress, electionId, { silent: true }),
        ]);
      } finally {
        refreshInFlight = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshCeremonyContext();
    }, CEREMONY_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [actorPublicAddress, electionId, loadCeremonyActionView, loadElection]);

  const election = selectedElection?.Election;
  const activeVersion = useMemo(() => getActiveCeremonyVersion(selectedElection), [selectedElection]);
  const trusteeActions = useMemo(() => getCeremonyActionViewStates(ceremonyActionView, 'trustee'), [ceremonyActionView]);
  const selfState = ceremonyActionView?.SelfTrusteeState;
  const shareCustody = ceremonyActionView?.SelfShareCustody;
  const importAction = trusteeActions.find((action) => action.actionType === ElectionCeremonyActionTypeProto.CeremonyActionImportShare);
  const protocolVersion = election?.ProtocolOmegaVersion?.trim() || DEFAULT_PROTOCOL_OMEGA_VERSION;
  const preparedPackage = useMemo(() => activeVersion ? getPreparedPackage(actorPublicAddress, electionId, protocolVersion, activeVersion.ProfileId, activeVersion.Id, activeVersion.VersionNumber) : null, [activeVersion, actorPublicAddress, electionId, protocolVersion]);
  const isSubmittedWithoutApprovalMetadata =
    selfState?.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted
    && !selfState.ShareVersion?.trim();
  const guidedActions = useMemo(
    () =>
      stepSequence
        .flatMap((type) => trusteeActions.find((action) => action.actionType === type) ?? [])
        .map((action) => {
          if (!isSubmittedWithoutApprovalMetadata) {
            return action;
          }

          if (action.actionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial && action.status === 'completed') {
            return {
              ...action,
              reason: 'Submitted using the older package format. Wait for the owner to request resubmission before you submit the updated package.',
            };
          }

          if (action.actionType === ElectionCeremonyActionTypeProto.CeremonyActionExportShare) {
            return {
              ...action,
              reason: 'Step 5 is downstream. The owner must request resubmission first, then you will rerun self-test and submit an updated package.',
            };
          }

          return action;
        }),
    [isSubmittedWithoutApprovalMetadata, trusteeActions]
  );
  const focusedAction = useMemo(() => getFocusedAction(guidedActions), [guidedActions]);
  const nextAvailableAction = useMemo(
    () => guidedActions.find((action) => action.status === 'available') ?? null,
    [guidedActions]
  );
  const isAwaitingOwnerValidation =
    selfState?.State === ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted
    && !nextAvailableAction;
  const currentWorkspaceLabel = isAwaitingOwnerValidation ? 'Current status' : 'Current step';
  const currentWorkspaceTitle = isAwaitingOwnerValidation
    ? isSubmittedWithoutApprovalMetadata
      ? 'Awaiting owner resubmission request'
      : 'Awaiting owner validation'
    : focusedAction?.label || 'No active ceremony task';
  const currentWorkspaceReason = isAwaitingOwnerValidation
    ? isSubmittedWithoutApprovalMetadata
      ? 'Your ceremony package was submitted with the older format, so the owner cannot approve it yet.'
      : 'Your ceremony package has already been submitted successfully. There is no trustee-local action available right now.'
    : focusedAction?.reason || 'This ceremony does not expose any trustee actions yet.';
  const currentWorkspaceGuidance = isAwaitingOwnerValidation
    ? isSubmittedWithoutApprovalMetadata
      ? 'Step 5 is not the missing action. Wait for the owner to request resubmission. After that, this page will unlock the self-test and submit steps so you can send an updated package.'
      : 'Step 5 stays blocked until the owner validator marks your trustee record complete. When that happens, this page will refresh and unlock share export automatically.'
    : 'The continue action runs each trustee-local step in order until the flow reaches an external wait, such as owner validation.';
  const currentWorkspacePill = isAwaitingOwnerValidation
    ? 'bg-amber-500/10 text-amber-100 ring-amber-500/35'
    : focusedAction
      ? getStatusPillClass(focusedAction.status)
      : '';
  const currentWorkspaceStatusLabel = isAwaitingOwnerValidation
    ? 'waiting'
    : focusedAction?.status ?? null;

  const onContinue = async () => {
    if (!activeVersion || !preparedPackage || isAutoAdvancing) {
      return;
    }

    setIsAutoAdvancing(true);

    try {
      for (let index = 0; index < stepSequence.length; index += 1) {
        const liveActions = getGuidedActionsFromView(useElectionsStore.getState().ceremonyActionView);
        const availableAction = liveActions.find((action) => action.status === 'available');

        if (!availableAction) {
          break;
        }

        let didAdvance = false;

        if (availableAction.actionType === ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey) {
          didAdvance = await publishElectionCeremonyTransportKey(
            {
              ElectionId: electionId,
              CeremonyVersionId: activeVersion.Id,
              ActorPublicAddress: actorPublicAddress,
              TransportPublicKeyFingerprint: preparedPackage.transportPublicKeyFingerprint,
            },
            actorEncryptionPublicKey,
            actorEncryptionPrivateKey,
            actorSigningPrivateKey
          );
        } else if (availableAction.actionType === ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion) {
          didAdvance = await joinElectionCeremony(
            {
              ElectionId: electionId,
              CeremonyVersionId: activeVersion.Id,
              ActorPublicAddress: actorPublicAddress,
            },
            actorEncryptionPublicKey,
            actorEncryptionPrivateKey,
            actorSigningPrivateKey
          );
        } else if (availableAction.actionType === ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest) {
          didAdvance = await recordElectionCeremonySelfTestSuccess(
            {
              ElectionId: electionId,
              CeremonyVersionId: activeVersion.Id,
              ActorPublicAddress: actorPublicAddress,
            },
            actorEncryptionPublicKey,
            actorEncryptionPrivateKey,
            actorSigningPrivateKey
          );
        } else if (availableAction.actionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial) {
          didAdvance = await submitElectionCeremonyMaterial(
            {
              ElectionId: electionId,
              CeremonyVersionId: activeVersion.Id,
              ActorPublicAddress: actorPublicAddress,
              RecipientTrusteeUserAddress: null,
              MessageType: preparedPackage.messageType,
              PayloadVersion: preparedPackage.payloadVersion,
              EncryptedPayload: preparedPackage.encryptedPayload,
              PayloadFingerprint: preparedPackage.payloadFingerprint,
              ShareVersion: preparedPackage.shareVersion,
            },
            actorEncryptionPublicKey,
            actorEncryptionPrivateKey,
            actorSigningPrivateKey
          );
        } else if (availableAction.actionType === ElectionCeremonyActionTypeProto.CeremonyActionExportShare) {
          didAdvance = await recordElectionCeremonyShareExport(
            {
              ElectionId: electionId,
              CeremonyVersionId: activeVersion.Id,
              ActorPublicAddress: actorPublicAddress,
              ShareVersion:
                useElectionsStore.getState().ceremonyActionView?.SelfTrusteeState?.ShareVersion ||
                useElectionsStore.getState().ceremonyActionView?.SelfShareCustody?.ShareVersion ||
                preparedPackage.shareVersion,
            },
            actorEncryptionPublicKey,
            actorEncryptionPrivateKey,
            actorSigningPrivateKey
          );
        }

        if (!didAdvance) {
          break;
        }
      }
    } finally {
      setIsAutoAdvancing(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-hush-bg-dark text-hush-text-primary">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col p-4 md:p-6">
        <div className="mb-6">
          <Link href={`/elections/${electionId}`} className="mb-3 inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to election</span>
          </Link>
          <h1 className="text-2xl font-semibold">Trustee Key Ceremony</h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Follow the ceremony in order. The trustee surface now prepares the required package metadata for you and keeps completion under the owner validation path.
          </p>
        </div>

        {feedback ? (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-100' : 'border-red-500/40 bg-red-500/10 text-red-100'}`} role="status">
            <div className="flex items-center gap-2 font-medium">
              {feedback.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{feedback.message}</span>
            </div>
            {feedback.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

        {(isLoadingDetail || isLoadingCeremonyActionView) && !selectedElection ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Loading ceremony context...</span>
          </div>
        ) : !election ? (
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-sm font-medium text-red-100">
              <AlertCircle className="h-4 w-4" />
              <span>Ceremony context not found for this election.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className={sectionClass} data-testid="trustee-ceremony-summary">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Election</div>
                  <h2 className="mt-2 text-xl font-semibold">{election.Title}</h2>
                  <div className="mt-2 text-sm text-hush-text-accent">Active version: {activeVersion ? `KC-${String(activeVersion.VersionNumber).padStart(3, '0')}` : 'No active version'}</div>
                </div>
                <div className="rounded-xl bg-[#151c33] px-3 py-2 text-xs text-hush-text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_10px_20px_rgba(0,0,0,0.12)]">
                  Incoming ceremony messages: {ceremonyActionView?.PendingIncomingMessageCount ?? 0}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Profile</div>
                  <div className="mt-2 text-sm">{activeVersion?.ProfileId || 'Not started'}</div>
                </div>
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Threshold</div>
                  <div className="mt-2 text-sm">{activeVersion ? `${activeVersion.RequiredApprovalCount} of ${activeVersion.TrusteeCount}` : 'Not recorded'}</div>
                </div>
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Your state</div>
                  <div className="mt-2 text-sm">{selfState ? getTrusteeCeremonyStateLabel(selfState.State) : 'Waiting'}</div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Authority boundary</span>
                </div>
                <p className="mt-2">This workflow records one trustee share for the tally-release path only. It is not a general ballot inspection or decryption control.</p>
              </div>

              {selfState?.State === ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed ? (
                <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100" data-testid="trustee-ceremony-validation-failed">
                  Last validation failure: {selfState.ValidationFailureReason || 'Rejected by the ceremony validator.'}
                </div>
              ) : null}
            </section>

            <section className={sectionClass} data-testid="trustee-ceremony-steps">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Your progress</h2>
                <p className="mt-1 text-sm text-hush-text-accent">
                  One task stays in focus at a time. The next available step becomes the active workspace automatically after each successful action.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className={insetSurfaceClass} data-testid="trustee-ceremony-step-list">
                  <div className="space-y-3">
                    {guidedActions.map((action, index) => (
                      <div
                        key={action.actionType}
                        className={`rounded-2xl px-4 py-3 shadow-sm shadow-black/10 ${action.actionType === focusedAction?.actionType ? 'bg-[#263155] ring-1 ring-inset ring-hush-purple/35' : action.status === 'completed' ? 'bg-[#1c2945]' : 'bg-[#1f2848]'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Step {index + 1}</div>
                            <div className="mt-1 text-sm font-medium text-hush-text-primary">{action.label}</div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset ${getStatusPillClass(action.status)}`}>{action.status}</span>
                        </div>
                        <div className="mt-2 text-sm text-hush-text-accent">{action.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4" data-testid="trustee-ceremony-step-workspace">
                  <div className={insetSurfaceClass} data-testid="trustee-ceremony-current-step">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">{currentWorkspaceLabel}</div>
                        <div className="mt-2 text-lg font-semibold">{currentWorkspaceTitle}</div>
                        <p className="mt-2 text-sm text-hush-text-accent">
                          {currentWorkspaceReason}
                        </p>
                        <p className="mt-2 text-sm text-hush-text-accent">
                          {currentWorkspaceGuidance}
                        </p>
                      </div>
                      {currentWorkspaceStatusLabel ? (
                        <span className={`w-fit rounded-full px-3 py-1 text-xs ring-1 ring-inset ${currentWorkspacePill}`}>
                          {currentWorkspaceStatusLabel}
                        </span>
                      ) : null}
                    </div>
                    {isAwaitingOwnerValidation ? (
                      <div
                        className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                        data-testid="trustee-ceremony-awaiting-owner-validation"
                      >
                        {isSubmittedWithoutApprovalMetadata
                          ? 'All trustee-local ceremony steps are complete for this submission cycle, but this older package cannot be approved. Wait for the owner to request resubmission; Step 5 will stay blocked until you resubmit the updated package and it is approved.'
                          : 'All trustee-local ceremony steps are complete for this submission cycle. Keep this workspace open or come back later; export will unlock only after owner validation finishes.'}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onContinue()}
                        disabled={isSubmitting || isAutoAdvancing || !nextAvailableAction || !activeVersion || !preparedPackage}
                        className={primaryButtonClass}
                        data-testid="trustee-ceremony-continue-button"
                      >
                        {isSubmitting || isAutoAdvancing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        <span>Continue ceremony</span>
                      </button>
                    )}
                  </div>

                  {isAwaitingOwnerValidation ? (
                    <div className={insetSurfaceClass}>
                      <div className="text-sm font-semibold">
                        {isSubmittedWithoutApprovalMetadata ? 'Resubmission boundary' : 'Owner validation boundary'}
                      </div>
                      <p className="mt-2 text-sm text-hush-text-accent">
                        {isSubmittedWithoutApprovalMetadata
                          ? 'Your transport key, join, self-test, and package submission are already recorded for this version, but this older submission format is missing approval metadata. The owner must request resubmission before you can send the updated package.'
                          : 'Your transport key, join, self-test, and package submission are already recorded for this version. The owner validator now decides whether your trustee record completes or returns for another self-test cycle.'}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Material submitted at</div>
                          <div className="mt-2 text-sm">{formatTimestamp(selfState?.MaterialSubmittedAt)}</div>
                        </div>
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Next unlock</div>
                          <div className="mt-2 text-sm">
                            {isSubmittedWithoutApprovalMetadata
                              ? 'Owner resubmission request'
                              : 'Step 5: Export share backup'}
                          </div>
                        </div>
                      </div>
                      {isSubmittedWithoutApprovalMetadata ? (
                        <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          Step 5 stays blocked, but it is not the missing action. Wait for the owner to return this package, then rerun self-test and submit the updated package format.
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-hush-text-accent">
                          Once the owner marks this trustee record complete, the page will refresh into the export boundary automatically.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {focusedAction?.actionType === ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey ? (
                    <div className={insetSurfaceClass}>
                      <div className="text-sm font-semibold">Step 1: Publish transport key</div>
                      <p className="mt-2 text-sm text-hush-text-accent">This fingerprint is prepared for your trustee identity and the active ceremony version. The normal trustee surface does not expose a raw key field anymore.</p>
                      <div className={`${valueWellClass} mt-4`}>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Prepared fingerprint</div>
                        <div className="mt-2 break-all text-sm">{preparedPackage?.transportPublicKeyFingerprint || 'Not available'}</div>
                      </div>
                      <div className="mt-4 text-sm text-hush-text-accent">Use the continue action above to publish and then advance automatically into the next trustee-local step.</div>
                    </div>
                  ) : null}

                  {focusedAction?.actionType === ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion ? (
                    <div className={insetSurfaceClass}>
                      <div className="text-sm font-semibold">Step 2: Join version</div>
                      <p className="mt-2 text-sm text-hush-text-accent">Joining binds your published transport key to the active ceremony version so the later validation steps can proceed.</p>
                      <div className={`${valueWellClass} mt-4`}>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Active profile</div>
                        <div className="mt-2 text-sm">{activeVersion?.ProfileId || 'No active version'}</div>
                      </div>
                      <div className="mt-4 text-sm text-hush-text-accent">The continue action joins this trustee to the active version and proceeds into the self-test without another click.</div>
                    </div>
                  ) : null}

                  {focusedAction?.actionType === ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest ? (
                    <div className={insetSurfaceClass}>
                      <div className="text-sm font-semibold">Step 3: Run self-test</div>
                      <p className="mt-2 text-sm text-hush-text-accent">Run the mandatory self-test before any ceremony package can be submitted. If validation failed earlier, this step resets your submission cycle.</p>
                      <div className={`${valueWellClass} mt-4`}>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Last successful self-test</div>
                        <div className="mt-2 text-sm">{selfState?.SelfTestSucceededAt ? formatTimestamp(selfState.SelfTestSucceededAt) : 'Not recorded'}</div>
                      </div>
                      <div className="mt-4 text-sm text-hush-text-accent">The continue action records the self-test and moves straight into package submission if nothing else is blocking.</div>
                    </div>
                  ) : null}

                  {focusedAction?.actionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial ? (
                    <div className={insetSurfaceClass}>
                      <div className="text-sm font-semibold">Step 4: Submit ceremony package</div>
                      <p className="mt-2 text-sm text-hush-text-accent">The client prepares the bound package metadata for this trustee and version. Raw recipient and payload fields are intentionally hidden from the normal ceremony flow.</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Sender</div>
                          <div className="mt-2 break-all text-sm">{actorPublicAddress}</div>
                        </div>
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Routing</div>
                          <div className="mt-2 text-sm">System-managed ceremony envelope</div>
                        </div>
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Message type</div>
                          <div className="mt-2 text-sm">{preparedPackage?.messageType || 'dkg-share-package'}</div>
                        </div>
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Protocol version</div>
                          <div className="mt-2 text-sm">{preparedPackage?.payloadVersion || protocolVersion}</div>
                        </div>
                        <div className={`${valueWellClass} md:col-span-2`}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Package fingerprint</div>
                          <div className="mt-2 break-all text-sm">{preparedPackage?.payloadFingerprint || 'Not available'}</div>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-hush-text-accent">When this step is active, continue submits the prepared package automatically.</div>
                      <div className="mt-4 rounded-2xl bg-[#151c33] px-4 py-3 text-sm text-hush-text-accent">After submission, the owner validation path determines whether your trustee state is accepted or sent back for another self-test cycle.</div>
                    </div>
                  ) : null}

                  {focusedAction?.actionType === ElectionCeremonyActionTypeProto.CeremonyActionExportShare ? (
                    <div className={insetSurfaceClass}>
                      <div className="text-sm font-semibold">Step 5: Export share backup</div>
                      <p className="mt-2 text-sm text-hush-text-accent">Export stays blocked until the ceremony validator marks your trustee record complete. Once the backup is recorded, the same page will expose the import boundary state.</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Share custody</div>
                          <div className="mt-2 text-sm">{shareCustody ? getCeremonyShareCustodyStatusLabel(shareCustody.Status) : 'No share custody record yet'}</div>
                        </div>
                        <div className={valueWellClass}>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Share version</div>
                          <div className="mt-2 text-sm">{selfState?.ShareVersion || shareCustody?.ShareVersion || preparedPackage?.shareVersion || 'Not recorded'}</div>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-hush-text-accent">Import guidance: {importAction?.reason || 'Import stays unavailable until an exact backup exists.'}</div>
                      <div className="mt-4 text-sm text-hush-text-accent">If export is available, continue records the backup export as the last trustee-local step.</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <CeremonyTranscriptPanel detail={selectedElection} />
          </div>
        )}
      </div>
    </div>
  );
}

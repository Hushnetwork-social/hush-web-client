"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCcw, ShieldAlert } from 'lucide-react';
import type { GetElectionCeremonyActionViewResponse, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyVersionStatusProto,
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
  getTrusteeCeremonyStateLabel,
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
};

type ModalMode = 'start' | 'restart' | null;

export function ElectionCeremonyWorkspaceSection({
  detail,
  actionView,
  ownerPublicAddress,
  isSubmitting,
  isLoadingCeremonyActionView,
  pendingSaveAlignmentMessage = null,
  onStart,
  onRestart,
}: ElectionCeremonyWorkspaceSectionProps) {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [restartReason, setRestartReason] = useState('Supersede the current version and restart.');

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
                    : 'The election remains blocked in draft until the ceremony completes.'}
                </div>
                <div className="mt-1 text-sm text-hush-text-accent">
                  {activeVersion
                    ? `Current version ${getCeremonyVersionStatusLabel(activeVersion.Status)} with ${trusteeStates.length} trustee state records.`
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
            <div className="text-sm font-semibold">Trustee progress</div>
            {trusteeStates.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">
                    <tr>
                      <th className="pb-2 pr-4">Trustee</th>
                      <th className="pb-2 pr-4">State</th>
                      <th className="pb-2 pr-4">Last event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hush-bg-light/60">
                    {trusteeStates.map((state) => (
                      <tr key={state.Id}>
                        <td className="py-3 pr-4 text-hush-text-primary">
                          {state.TrusteeDisplayName || state.TrusteeUserAddress}
                        </td>
                        <td className="py-3 pr-4 text-hush-text-accent">
                          {getTrusteeCeremonyStateLabel(state.State)}
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
                      </tr>
                    ))}
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
        <CeremonyTranscriptPanel detail={detail} />
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
    </section>
  );
}

"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { ElectionTrusteeCeremonyStateProto } from '@/lib/grpc';
import {
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

const sectionClass =
  'rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10';

export function TrusteeElectionCeremonyPanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: TrusteeElectionCeremonyPanelProps) {
  const {
    ceremonyActionView,
    completeElectionCeremonyTrustee,
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

  const [transportPublicKeyFingerprint, setTransportPublicKeyFingerprint] = useState(
    'transport-key-fingerprint-v1'
  );
  const [messageType, setMessageType] = useState('dkg_contribution');
  const [payloadVersion, setPayloadVersion] = useState('v1');
  const [encryptedPayload, setEncryptedPayload] = useState('encrypted-package');
  const [payloadFingerprint, setPayloadFingerprint] = useState('payload-fingerprint-v1');
  const [shareVersion, setShareVersion] = useState('share-v1');
  const [tallyPublicKeyFingerprint, setTallyPublicKeyFingerprint] = useState(
    'tally-public-key-fingerprint-v1'
  );

  useEffect(() => {
    void loadElection(electionId);
    void loadCeremonyActionView(actorPublicAddress, electionId);
  }, [actorPublicAddress, electionId, loadCeremonyActionView, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const election = selectedElection?.Election;
  const activeVersion = useMemo(() => getActiveCeremonyVersion(selectedElection), [selectedElection]);
  const trusteeActions = useMemo(
    () => getCeremonyActionViewStates(ceremonyActionView, 'trustee'),
    [ceremonyActionView]
  );
  const selfState = ceremonyActionView?.SelfTrusteeState;
  const shareCustody = ceremonyActionView?.SelfShareCustody;
  const recipientOptions = useMemo(() => activeVersion?.BoundTrustees ?? [], [activeVersion]);
  const defaultRecipientTrusteeUserAddress = recipientOptions[0]?.TrusteeUserAddress ?? actorPublicAddress;
  const [recipientTrusteeUserAddress, setRecipientTrusteeUserAddress] = useState(
    defaultRecipientTrusteeUserAddress
  );

  useEffect(() => {
    if (recipientOptions.length > 0) {
      setRecipientTrusteeUserAddress((current) =>
        current && recipientOptions.some((candidate) => candidate.TrusteeUserAddress === current)
          ? current
          : recipientOptions[0].TrusteeUserAddress
      );
    }
  }, [recipientOptions]);

  const publishAction = trusteeActions[0];
  const joinAction = trusteeActions[1];
  const selfTestAction = trusteeActions[2];
  const submitAction = trusteeActions[3];
  const exportAction = trusteeActions[4];
  const importAction = trusteeActions[5];

  const handlePublish = async () => {
    if (!activeVersion) {
      return;
    }

    await publishElectionCeremonyTransportKey({
      ElectionId: electionId,
      CeremonyVersionId: activeVersion.Id,
      ActorPublicAddress: actorPublicAddress,
      TransportPublicKeyFingerprint: transportPublicKeyFingerprint,
    }, actorEncryptionPublicKey, actorEncryptionPrivateKey, actorSigningPrivateKey);
  };

  const handleJoin = async () => {
    if (!activeVersion) {
      return;
    }

    await joinElectionCeremony({
      ElectionId: electionId,
      CeremonyVersionId: activeVersion.Id,
      ActorPublicAddress: actorPublicAddress,
    }, actorEncryptionPublicKey, actorEncryptionPrivateKey, actorSigningPrivateKey);
  };

  const handleSelfTest = async () => {
    if (!activeVersion) {
      return;
    }

    await recordElectionCeremonySelfTestSuccess({
      ElectionId: electionId,
      CeremonyVersionId: activeVersion.Id,
      ActorPublicAddress: actorPublicAddress,
    }, actorEncryptionPublicKey, actorEncryptionPrivateKey, actorSigningPrivateKey);
  };

  const handleSubmit = async () => {
    if (!activeVersion) {
      return;
    }

    const didSubmit = await submitElectionCeremonyMaterial({
      ElectionId: electionId,
      CeremonyVersionId: activeVersion.Id,
      ActorPublicAddress: actorPublicAddress,
      RecipientTrusteeUserAddress: recipientTrusteeUserAddress,
      MessageType: messageType.trim(),
      PayloadVersion: payloadVersion.trim(),
      EncryptedPayload: encryptedPayload.trim(),
      PayloadFingerprint: payloadFingerprint.trim(),
    }, actorEncryptionPublicKey, actorEncryptionPrivateKey, actorSigningPrivateKey);

    if (!didSubmit) {
      return;
    }

    await completeElectionCeremonyTrustee({
      ElectionId: electionId,
      CeremonyVersionId: activeVersion.Id,
      ActorPublicAddress: actorPublicAddress,
      TrusteeUserAddress: actorPublicAddress,
      ShareVersion: shareVersion.trim(),
      TallyPublicKeyFingerprint: tallyPublicKeyFingerprint.trim(),
    }, actorEncryptionPublicKey, actorEncryptionPrivateKey, actorSigningPrivateKey);
  };

  const handleExport = async () => {
    if (!activeVersion) {
      return;
    }

    await recordElectionCeremonyShareExport({
      ElectionId: electionId,
      CeremonyVersionId: activeVersion.Id,
      ActorPublicAddress: actorPublicAddress,
      ShareVersion: selfState?.ShareVersion || shareCustody?.ShareVersion || shareVersion.trim(),
    }, actorEncryptionPublicKey, actorEncryptionPrivateKey, actorSigningPrivateKey);
  };

  return (
    <div className="min-h-screen bg-hush-bg-dark text-hush-text-primary">
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="mb-6">
          <Link
            href="/elections"
            className="mb-3 inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to elections</span>
          </Link>
          <h1 className="text-2xl font-semibold">Trustee Key Ceremony</h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Complete the ordered ceremony steps to become an active trustee for this election.
            Completing the ceremony does not grant general ballot decryption authority.
          </p>
        </div>

        {feedback ? (
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
            {feedback.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

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
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Election
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">{election.Title}</h2>
                  <div className="mt-2 text-sm text-hush-text-accent">
                    Active version:{' '}
                    {activeVersion
                      ? `KC-${String(activeVersion.VersionNumber).padStart(3, '0')}`
                      : 'No active version'}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-xs text-hush-text-accent">
                  Incoming ceremony messages: {ceremonyActionView?.PendingIncomingMessageCount ?? 0}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Profile
                  </div>
                  <div className="mt-2 text-sm">{activeVersion?.ProfileId || 'Not started'}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Threshold
                  </div>
                  <div className="mt-2 text-sm">
                    {activeVersion
                      ? `${activeVersion.RequiredApprovalCount} of ${activeVersion.TrusteeCount}`
                      : 'Not recorded'}
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Your state
                  </div>
                  <div className="mt-2 text-sm">
                    {selfState ? getTrusteeCeremonyStateLabel(selfState.State) : 'Waiting'}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Authority boundary</span>
                </div>
                <p className="mt-2">
                  This workflow records one trustee share for the tally-release path only. It is
                  not a general ballot inspection or decryption control.
                </p>
              </div>

              {selfState?.State === ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed ? (
                <div
                  className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100"
                  data-testid="trustee-ceremony-validation-failed"
                >
                  Last validation failure: {selfState.ValidationFailureReason || 'Rejected by the ceremony validator.'}
                </div>
              ) : null}
            </section>

            <section className={sectionClass} data-testid="trustee-ceremony-steps">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Your progress</h2>
                <p className="mt-1 text-sm text-hush-text-accent">
                  Complete the steps in order. Mobile and desktop share the same task boundary.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="space-y-3">
                    {[publishAction, joinAction, selfTestAction, submitAction, exportAction]
                      .filter(Boolean)
                      .map((action, index) => (
                        <div
                          key={action!.actionType}
                          className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                                Step {index + 1}
                              </div>
                              <div className="mt-1 text-sm font-medium text-hush-text-primary">
                                {action!.label}
                              </div>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${
                                action!.status === 'completed'
                                  ? 'border-green-500/40 bg-green-500/10 text-green-100'
                                  : action!.status === 'available'
                                    ? 'border-hush-purple/40 bg-hush-purple/10 text-hush-purple'
                                    : 'border-hush-bg-light bg-hush-bg-dark text-hush-text-accent'
                              }`}
                            >
                              {action!.status}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-hush-text-accent">{action!.reason}</div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-sm font-semibold">Step 1: Publish transport key</div>
                    <input
                      value={transportPublicKeyFingerprint}
                      onChange={(event) => setTransportPublicKeyFingerprint(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                      placeholder="Transport key fingerprint"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={isSubmitting || !activeVersion || publishAction?.status !== 'available'}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span>Publish transport key</span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-sm font-semibold">Step 2: Join and self-test</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleJoin()}
                        disabled={isSubmitting || !activeVersion || joinAction?.status !== 'available'}
                        className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:text-hush-text-accent"
                      >
                        <span>Join version</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSelfTest()}
                        disabled={isSubmitting || !activeVersion || selfTestAction?.status !== 'available'}
                        className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:text-hush-text-accent"
                      >
                        <span>Run self-test</span>
                      </button>
                    </div>
                    <div className="mt-3 text-sm text-hush-text-accent">
                      Last successful self-test:{' '}
                      {selfState?.SelfTestSucceededAt
                        ? formatTimestamp(selfState.SelfTestSucceededAt)
                        : 'Not recorded'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-sm font-semibold">Step 3: Submit and complete</div>
                    <div className="mt-3 grid gap-3">
                      <select
                        value={recipientTrusteeUserAddress}
                        onChange={(event) => setRecipientTrusteeUserAddress(event.target.value)}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                      >
                        {recipientOptions.map((trustee) => (
                          <option key={trustee.TrusteeUserAddress} value={trustee.TrusteeUserAddress}>
                            {trustee.TrusteeDisplayName || trustee.TrusteeUserAddress}
                          </option>
                        ))}
                      </select>
                      <input
                        value={messageType}
                        onChange={(event) => setMessageType(event.target.value)}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                        placeholder="Message type"
                      />
                      <input
                        value={payloadVersion}
                        onChange={(event) => setPayloadVersion(event.target.value)}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                        placeholder="Payload version"
                      />
                      <textarea
                        value={encryptedPayload}
                        onChange={(event) => setEncryptedPayload(event.target.value)}
                        className="min-h-24 w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                        placeholder="Encrypted payload"
                      />
                      <input
                        value={payloadFingerprint}
                        onChange={(event) => setPayloadFingerprint(event.target.value)}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                        placeholder="Payload fingerprint"
                      />
                      <input
                        value={shareVersion}
                        onChange={(event) => setShareVersion(event.target.value)}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                        placeholder="Share version"
                      />
                      <input
                        value={tallyPublicKeyFingerprint}
                        onChange={(event) => setTallyPublicKeyFingerprint(event.target.value)}
                        className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-element/70 px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                        placeholder="Tally public key fingerprint"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting || !activeVersion || submitAction?.status !== 'available'}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                      data-testid="trustee-ceremony-submit-button"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span>Submit ceremony material</span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                    <div className="text-sm font-semibold">Step 4: Export encrypted share backup</div>
                    <div className="mt-3 text-sm text-hush-text-accent">
                      Share custody status:{' '}
                      {shareCustody
                        ? `${getCeremonyShareCustodyStatusLabel(shareCustody.Status)} • last export ${formatTimestamp(shareCustody.LastExportedAt)}`
                        : 'No share custody record yet'}
                    </div>
                    <div className="mt-2 text-sm text-hush-text-accent">
                      Import guidance: {importAction?.reason || 'Import is unavailable until a backup exists.'}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleExport()}
                      disabled={isSubmitting || !activeVersion || exportAction?.status !== 'available'}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple disabled:cursor-not-allowed disabled:text-hush-text-accent"
                      data-testid="trustee-ceremony-export-button"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span>Record share export</span>
                    </button>
                  </div>
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

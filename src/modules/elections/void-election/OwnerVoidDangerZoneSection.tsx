"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Loader2,
} from 'lucide-react';
import type { ElectionVerificationPackageStatusView } from '@/lib/grpc';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { getLifecycleLabel } from '../contracts';
import type { ElectionVoidEvidenceReferencePayload } from '../transactionService';
import {
  getLifecycleImpactCopy,
  isVoidEligible,
  type OwnerVoidDangerZoneSectionProps,
} from './VoidElectionTypes';
import { VoidElectionDialog } from './VoidElectionDialog';
import { VoidPublicationStatusDetails } from './VoidPublicationStatusDetails';
import { VoidValue } from './VoidValue';

export function OwnerVoidDangerZoneSection({
  election,
  actorPublicAddress,
  actorPublicEncryptAddress,
  actorPrivateEncryptKeyHex,
  signingPrivateKeyHex,
  isSubmitting,
  onVoidElection,
  onRetryVoidPublication,
}: OwnerVoidDangerZoneSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [voidStatus, setVoidStatus] = useState<ElectionVerificationPackageStatusView | null>(null);
  const [isLoadingVoidStatus, setIsLoadingVoidStatus] = useState(false);
  const isOwner =
    Boolean(election?.OwnerPublicAddress) &&
    election?.OwnerPublicAddress.toLowerCase() === actorPublicAddress.toLowerCase();
  const isVoided = election?.LifecycleState === ElectionLifecycleStateProto.Voided;
  const isEligible = isOwner && isVoidEligible(election?.LifecycleState);
  const impactCopy = getLifecycleImpactCopy(election?.LifecycleState);

  const refreshVoidStatus = useCallback(async () => {
    if (!election?.ElectionId || !isVoided) {
      setVoidStatus(null);
      return;
    }

    setIsLoadingVoidStatus(true);
    try {
      const response = await electionsService.getElectionVerificationPackageStatus({
        ElectionId: election.ElectionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setVoidStatus(response.Success ? response.Status ?? null : null);
    } catch {
      setVoidStatus(null);
    } finally {
      setIsLoadingVoidStatus(false);
    }
  }, [actorPublicAddress, election?.ElectionId, isVoided]);

  useEffect(() => {
    void refreshVoidStatus();
  }, [refreshVoidStatus]);

  const handleSubmit = async (
    publicJustification: string,
    evidenceReferences: ElectionVoidEvidenceReferencePayload[],
  ) => {
    const wasVoided = await onVoidElection(
      publicJustification,
      evidenceReferences,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      signingPrivateKeyHex,
    );

    if (wasVoided) {
      setIsDialogOpen(false);
      await refreshVoidStatus();
    }
  };

  const handleRetry = async (voidDecisionId: string) => {
    const wasSubmitted = await onRetryVoidPublication(
      voidDecisionId,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      signingPrivateKeyHex,
    );

    if (wasSubmitted) {
      await refreshVoidStatus();
    }
  };

  return (
    <div className="mt-5 rounded-3xl bg-red-500/10 p-5 text-red-50 shadow-sm shadow-black/10" data-testid="owner-void-danger-zone">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-red-100/80">
            <AlertTriangle className="h-4 w-4" />
            <span>Danger zone</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">Void election</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-red-100/85">
            This owner-only action moves the election to VOID and supersedes current publication
            refs. It is not part of anomaly triage and does not require trustee approval in v1.
          </p>
        </div>

        {isEligible ? (
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            disabled={isSubmitting}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="open-void-dialog-button"
          >
            <Ban className="h-4 w-4" />
            <span>Void election</span>
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <VoidValue label="Current lifecycle" value={getLifecycleLabel(election?.LifecycleState)} />
        <VoidValue
          label="Eligibility"
          value={isEligible ? 'Owner can void in v1' : isVoided ? 'Already VOID' : isOwner ? 'Unavailable' : 'Owner access required'}
          accentClass={isEligible ? 'text-amber-100' : isVoided ? 'text-red-100' : undefined}
        />
        <VoidValue label="Expected public state" value={isVoided ? 'VOID' : isEligible ? 'VOID after signed action' : 'No action'} />
      </div>

      <div className="mt-4 rounded-2xl bg-black/20 p-4 text-sm leading-7 text-red-100/85">
        <span className="font-semibold text-red-50">{impactCopy.title}.</span> {impactCopy.body}
      </div>

      {isVoided ? (
        <div className="mt-5">
          {isLoadingVoidStatus ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-black/20 px-4 py-3 text-sm text-hush-text-accent">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading VOID publication status...</span>
            </div>
          ) : voidStatus ? (
            <VoidPublicationStatusDetails
              status={voidStatus}
              canRetry
              isRetrying={isSubmitting}
              onRetry={handleRetry}
            />
          ) : (
            <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100">
              The VOID state is visible, but publication refs are not loaded yet. Refresh this
              workspace after indexing catches up.
            </div>
          )}
        </div>
      ) : null}

      {isDialogOpen && election ? (
        <VoidElectionDialog
          election={election}
          isSubmitting={isSubmitting}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

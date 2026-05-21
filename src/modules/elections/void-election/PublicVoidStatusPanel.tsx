"use client";

import { useEffect, useState } from 'react';
import {
  FileWarning,
  Loader2,
} from 'lucide-react';
import type { ElectionVerificationPackageStatusView } from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import type { PublicVoidStatusPanelProps } from './VoidElectionTypes';
import { VoidPublicationStatusDetails } from './VoidPublicationStatusDetails';

export function PublicVoidStatusPanel({
  electionId,
  actorPublicAddress,
  initialStatus,
}: PublicVoidStatusPanelProps) {
  const [status, setStatus] = useState<ElectionVerificationPackageStatusView | null>(
    initialStatus ?? null,
  );
  const [isLoading, setIsLoading] = useState(!initialStatus);

  useEffect(() => {
    let isActive = true;
    if (initialStatus?.VoidPublicationStatus) {
      setStatus(initialStatus);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void electionsService
      .getElectionVerificationPackageStatus({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      })
      .then((response) => {
        if (isActive) {
          setStatus(response.Success ? response.Status ?? null : null);
        }
      })
      .catch(() => {
        if (isActive) {
          setStatus(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [actorPublicAddress, electionId, initialStatus]);

  if (isLoading) {
    return (
      <section className="rounded-[28px] bg-[#151c33] p-5 text-sm text-hush-text-accent" data-testid="public-void-status-panel">
        <div className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-hush-purple" />
          <span>Loading public VOID status...</span>
        </div>
      </section>
    );
  }

  if (!status?.VoidPublicationStatus) {
    return null;
  }

  return (
    <section className="rounded-[28px] bg-[#151c33] p-5 shadow-sm shadow-black/10" data-testid="public-void-status-panel">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-red-500/15 p-3 text-red-100">
          <FileWarning className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-red-100/80">
            Public election status
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">This election is VOID</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
            No current final result claim exists for this election. Public VOID status exposes only
            the decision refs, package refs, verifier result, and public justification.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <VoidPublicationStatusDetails status={status} />
      </div>
    </section>
  );
}

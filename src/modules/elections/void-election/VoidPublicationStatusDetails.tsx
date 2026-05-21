import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { ElectionVerificationPackageStatusView } from '@/lib/grpc';
import { ElectionVoidPublicationAttemptStatusProto } from '@/lib/grpc';
import {
  formatArtifactValue,
  formatTimestamp,
  getLifecycleLabel,
} from '../contracts';
import {
  getVoidPublicationStatus,
  getVoidPublicationStatusLabel,
} from './VoidElectionTypes';
import { VoidValue } from './VoidValue';

export function VoidPublicationStatusDetails({
  status,
  canRetry,
  isRetrying,
  onRetry,
}: {
  status: ElectionVerificationPackageStatusView;
  canRetry?: boolean;
  isRetrying?: boolean;
  onRetry?: (voidDecisionId: string) => Promise<void>;
}) {
  const voidStatus = getVoidPublicationStatus(status);
  if (!voidStatus) {
    return (
      <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100">
        The election is VOID, but the current VOID publication status is still loading or has not
        indexed yet.
      </div>
    );
  }

  const statusLabel = getVoidPublicationStatusLabel(voidStatus.Status);
  const verifierResultCode = status.LastVerifierResult?.ResultCode || 'election_voided';

  return (
    <div className="space-y-4" data-testid="void-publication-status-details">
      <div className={`rounded-2xl p-4 text-sm ${statusLabel.toneClass}`}>
        <div className="flex items-start gap-3">
          {voidStatus.Status === ElectionVoidPublicationAttemptStatusProto.VoidPublicationSealed ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <div className="font-semibold">{statusLabel.label}</div>
            <div className="mt-2 leading-6">
              The election is VOID. No current final result claim exists for this election.
            </div>
            {voidStatus.Status === ElectionVoidPublicationAttemptStatusProto.VoidPublicationGenerationFailed ? (
              <div className="mt-2 leading-6">
                The void decision is already accepted. Retry keeps the same decision and creates a
                new publication attempt.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {voidStatus.PublicJustification ? (
        <div className="rounded-2xl bg-black/20 p-4 text-sm text-hush-text-primary" data-testid="public-void-justification">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Public justification
          </div>
          <p className="mt-3 leading-7">{voidStatus.PublicJustification}</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <VoidValue label="Decision id" value={formatArtifactValue(voidStatus.VoidDecisionId)} />
        <VoidValue
          label="Previous lifecycle"
          value={getLifecycleLabel(voidStatus.PreviousLifecycleState)}
        />
        <VoidValue label="Current state" value="VOID" accentClass="text-red-100" />
        <VoidValue label="Verifier result" value={verifierResultCode} accentClass="text-amber-100" />
        <VoidValue label="Publication attempt" value={formatArtifactValue(voidStatus.PublicationAttemptId)} />
        <VoidValue label="Package hash" value={formatArtifactValue(voidStatus.PackageHash)} />
        <VoidValue label="Public status ref" value={formatArtifactValue(voidStatus.PublicStatusArtifactRef)} />
        <VoidValue label="VOID package ref" value={formatArtifactValue(voidStatus.VoidPackageArtifactRef)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <VoidValue label="Actor role" value={voidStatus.ActorRole || 'ElectionOwner'} />
        <VoidValue label="Source transaction" value={formatArtifactValue(voidStatus.SourceTransactionId)} />
        <VoidValue
          label="Source block"
          value={voidStatus.SourceBlockHeight ? `${voidStatus.SourceBlockHeight}` : formatArtifactValue(voidStatus.SourceBlockId)}
        />
        <VoidValue
          label="Decided at"
          value={voidStatus.HasDecidedAt ? formatTimestamp(voidStatus.DecidedAt) : 'Not recorded'}
        />
      </div>

      {voidStatus.FailureReason ? (
        <div className="rounded-2xl bg-red-500/12 p-4 text-sm text-red-100">
          {voidStatus.FailureReason}
        </div>
      ) : null}

      {canRetry && voidStatus.CanRetry && onRetry ? (
        <button
          type="button"
          onClick={() => void onRetry(voidStatus.VoidDecisionId)}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="retry-void-publication-button"
        >
          {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span>Retry VOID publication</span>
        </button>
      ) : null}
    </div>
  );
}

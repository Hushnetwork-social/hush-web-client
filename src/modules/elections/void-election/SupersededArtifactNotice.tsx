import { AlertTriangle } from 'lucide-react';
import { formatArtifactValue } from '../contracts';
import type { SupersededArtifactNoticeProps } from './VoidElectionTypes';
import { VoidValue } from './VoidValue';

export function SupersededArtifactNotice({
  voidDecisionId,
  currentVoidPackageRef,
  verifierResultCode,
}: SupersededArtifactNoticeProps) {
  return (
    <div className="rounded-2xl bg-amber-500/12 p-4 text-sm text-amber-100" data-testid="superseded-artifact-notice">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="font-semibold">This artifact is historical and SupersededByVoid</div>
          <div className="mt-2 leading-6">
            It was superseded by an ElectionOwner void decision and is not a current final-result
            claim.
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <VoidValue label="Void decision id" value={formatArtifactValue(voidDecisionId ?? '')} />
            <VoidValue label="Current VOID package" value={formatArtifactValue(currentVoidPackageRef ?? '')} />
            <VoidValue label="Verifier result" value={verifierResultCode || 'election_voided'} />
          </div>
        </div>
      </div>
    </div>
  );
}

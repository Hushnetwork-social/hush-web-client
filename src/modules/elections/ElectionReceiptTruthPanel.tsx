"use client";

import type { OfficialResultVisibilityPolicyProto } from '@/lib/grpc';
import { ElectionBindingStatusProto } from '@/lib/grpc';
import {
  getBindingLabel,
  getModeProfileFamilyLabel,
  getOfficialResultVisibilityLabel,
  getSelectedProfileFamilyLabel,
  getSecrecyBoundaryCopy,
} from './contracts';

type ElectionReceiptTruthPanelProps = {
  bindingStatus: ElectionBindingStatusProto;
  selectedProfileDevOnly?: boolean;
  officialResultVisibilityPolicy?: OfficialResultVisibilityPolicyProto;
  profileId?: string;
  tallyPublicKeyFingerprint?: string;
  testId: string;
};

function formatContextValue(value?: string, fallback: string = 'Not recorded'): string {
  return value?.trim() || fallback;
}

export function ElectionReceiptTruthPanel({
  bindingStatus,
  selectedProfileDevOnly,
  officialResultVisibilityPolicy,
  profileId,
  tallyPublicKeyFingerprint,
  testId,
}: ElectionReceiptTruthPanelProps) {
  return (
    <section
      className="rounded-2xl bg-[#151c33] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]"
      data-testid={testId}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
        Mode and circuit truth
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
            Election mode
          </div>
          <div className="mt-1 text-sm text-hush-text-primary">
            {getBindingLabel(bindingStatus)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
            Allowed circuit families
          </div>
          <div className="mt-1 text-sm text-hush-text-primary">
            {getModeProfileFamilyLabel(bindingStatus)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
            Selected circuit family
          </div>
          <div className="mt-1 text-sm text-hush-text-primary">
            {getSelectedProfileFamilyLabel(selectedProfileDevOnly)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
            Bound ceremony profile
          </div>
          <div className="mt-1 text-sm text-hush-text-primary">
            {formatContextValue(profileId, 'Pending open-boundary binding')}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
            Tally key fingerprint
          </div>
          <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
            {formatContextValue(tallyPublicKeyFingerprint, 'Pending open-boundary binding')}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
            Official visibility
          </div>
          <div className="mt-1 text-sm text-hush-text-primary">
            {officialResultVisibilityPolicy === undefined
              ? 'Not recorded'
              : getOfficialResultVisibilityLabel(officialResultVisibilityPolicy)}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-hush-text-accent">
        {getSecrecyBoundaryCopy(selectedProfileDevOnly)}
      </p>
    </section>
  );
}

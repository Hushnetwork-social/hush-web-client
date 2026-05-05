"use client";

import { AlertCircle, CheckCircle2, Copy, ExternalLink, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { ElectionProtocolPackageBindingView } from '@/lib/grpc';
import { ProtocolPackageBindingStatusProto } from '@/lib/grpc';
import { getProtocolPackageBindingPresentation } from './contracts';

type ProtocolPackageBindingPanelMode = 'readiness' | 'evidence';

type ProtocolPackageBindingPanelProps = {
  binding?: ElectionProtocolPackageBindingView | null;
  fallbackStatus?: ProtocolPackageBindingStatusProto;
  fallbackMessage?: string | null;
  mode?: ProtocolPackageBindingPanelMode;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  testId?: string;
};

function copyHash(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value);
}

function HashField({
  label,
  shortValue,
  fullValue,
}: {
  label: string;
  shortValue: string;
  fullValue: string;
}) {
  return (
    <div className="rounded-2xl bg-black/18 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 break-all font-mono text-sm text-hush-text-primary" title={fullValue || shortValue}>
          {shortValue}
        </span>
        {fullValue ? (
          <button
            type="button"
            onClick={() => copyHash(fullValue)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hush-purple/16 text-hush-text-primary transition-colors hover:bg-hush-purple/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
            aria-label={`Copy full ${label.toLowerCase()} hash`}
          >
            <Copy className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getToneClass(tone: string): string {
  switch (tone) {
    case 'success':
      return 'bg-green-500/12 text-green-100';
    case 'warning':
      return 'bg-amber-500/12 text-amber-100';
    case 'error':
      return 'bg-red-500/12 text-red-100';
    default:
      return 'bg-hush-purple/12 text-hush-text-primary';
  }
}

export function ProtocolPackageBindingPanel({
  binding,
  fallbackStatus = ProtocolPackageBindingStatusProto.Missing,
  fallbackMessage,
  mode = 'readiness',
  onRefresh,
  refreshDisabled = false,
  testId = 'protocol-package-binding-panel',
}: ProtocolPackageBindingPanelProps) {
  const presentation = getProtocolPackageBindingPresentation(
    binding,
    fallbackStatus,
    fallbackMessage
  );
  const StatusIcon = presentation.openBlocked ? AlertCircle : mode === 'evidence' ? ShieldCheck : CheckCircle2;
  const canRefresh =
    mode === 'readiness' &&
    Boolean(onRefresh) &&
    presentation.openBlocked &&
    presentation.status !== ProtocolPackageBindingStatusProto.Sealed;
  const accessLocations = [
    ...(binding?.SpecAccessLocations ?? []),
    ...(binding?.ProofAccessLocations ?? []),
  ];

  return (
    <section
      className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10"
      data-testid={testId}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-hush-text-accent">
            Protocol Omega package refs
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getToneClass(presentation.tone)}`}>
              <StatusIcon className="h-4 w-4" />
              {presentation.label}
            </span>
            <span className="rounded-full bg-hush-purple/14 px-3 py-1 text-xs text-hush-text-primary">
              {presentation.version}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-hush-text-accent">
            {presentation.description}
          </p>
        </div>
        {canRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshDisabled}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
            data-testid="protocol-package-refresh"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Refresh package refs</span>
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <HashField
          label="Spec package"
          shortValue={presentation.specHashShort}
          fullValue={presentation.specHashFull}
        />
        <HashField
          label="Proof package"
          shortValue={presentation.proofHashShort}
          fullValue={presentation.proofHashFull}
        />
        <HashField
          label="Release manifest"
          shortValue={presentation.releaseHashShort}
          fullValue={presentation.releaseHashFull}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-violet-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
            Approval
          </div>
          <div className="mt-2">{presentation.approvalLabel}</div>
        </div>
        <div className="rounded-2xl bg-cyan-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
            External review
          </div>
          <div className="mt-2">{presentation.externalReviewLabel}</div>
        </div>
        <div className="rounded-2xl bg-emerald-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
            Access locations
          </div>
          <div className="mt-2">
            {accessLocations.length > 0 ? `${accessLocations.length} recorded` : 'Not recorded'}
          </div>
        </div>
      </div>

      {accessLocations.length > 0 ? (
        <div className="mt-4 space-y-2" data-testid="protocol-package-access-locations">
          <p className="text-sm text-hush-text-accent">
            Access-location availability is operational; sealed hashes remain the election evidence.
          </p>
          {accessLocations.map((location) => (
            <div
              key={`${location.Label}:${location.Location}`}
              className="flex flex-col gap-2 rounded-2xl bg-black/16 p-3 text-sm text-hush-text-accent md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-medium text-hush-text-primary">{location.Label}</div>
                <div className="mt-1 break-all font-mono text-xs">{location.Location}</div>
              </div>
              {location.Location.startsWith('http') ? (
                <a
                  href={location.Location}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${location.Label} access location`}
                  className="inline-flex items-center gap-2 rounded-xl bg-hush-purple/16 px-3 py-2 text-xs text-hush-text-primary transition-colors hover:bg-hush-purple/26"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open</span>
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

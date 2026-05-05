"use client";

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type {
  ElectionVerificationPackageExportAvailabilityView,
  ElectionVerificationPackageFileView,
  ElectionVerificationPackageStatusView,
  ExportElectionVerificationPackageResponse,
} from '@/lib/grpc';
import {
  ElectionVerificationPackageBlockerProto,
  ElectionVerificationPackageStatusProto,
  ElectionVerificationPackageViewProto,
  ElectionVerifierOverallStatusProto,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import {
  formatArtifactValue,
  formatTimestamp,
  shortenProtocolPackageHash,
} from './contracts';
import { AvailabilityCard } from './HushVotingWorkspaceShared';
import { ProtocolPackageBindingPanel } from './ProtocolPackageBindingPanel';

type VerificationPackageStatusSectionProps = {
  electionId: string;
  actorPublicAddress: string;
  status?: ElectionVerificationPackageStatusView | null;
};

type ExportState = {
  packageView: ElectionVerificationPackageViewProto;
  tone: 'success' | 'error';
  message: string;
  packageHash?: string;
  resultCode?: string;
} | null;

const PACKAGE_VIEW_LABELS: Record<ElectionVerificationPackageViewProto, string> = {
  [ElectionVerificationPackageViewProto.VerificationPackagePublicAnonymous]: 'public',
  [ElectionVerificationPackageViewProto.VerificationPackageRestrictedOwnerAuditor]: 'restricted',
};

function getStatusCopy(statusValue: ElectionVerificationPackageStatusProto): {
  label: string;
  body: string;
  className: string;
} {
  switch (statusValue) {
    case ElectionVerificationPackageStatusProto.VerificationPackageReady:
      return {
        label: 'Package ready',
        body: 'Independent election-record export is available for this finalized election.',
        className: 'bg-green-500/12 text-green-100',
      };
    case ElectionVerificationPackageStatusProto.VerificationPackageNotFinalized:
      return {
        label: 'Not finalized',
        body: 'The election must be finalized before verifier package export is available.',
        className: 'bg-amber-500/12 text-amber-100',
      };
    case ElectionVerificationPackageStatusProto.VerificationPackageMissing:
      return {
        label: 'Package missing',
        body: 'A sealed report package is required before verifier package export.',
        className: 'bg-amber-500/12 text-amber-100',
      };
    case ElectionVerificationPackageStatusProto.VerificationPackageProtocolRefsBlocked:
      return {
        label: 'Protocol refs blocked',
        body: 'Sealed Protocol Omega package refs are required before export.',
        className: 'bg-red-500/12 text-red-100',
      };
    case ElectionVerificationPackageStatusProto.VerificationPackageExportFailed:
      return {
        label: 'Export failed',
        body: 'The latest package export attempt failed and needs attention.',
        className: 'bg-red-500/12 text-red-100',
      };
    default:
      return {
        label: 'Not visible',
        body: 'Verification package controls are not visible to this actor.',
        className: 'bg-hush-purple/12 text-hush-text-primary',
      };
  }
}

function getVerifierCopy(statusValue?: ElectionVerifierOverallStatusProto): {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
} {
  switch (statusValue) {
    case ElectionVerifierOverallStatusProto.ElectionVerifierPass:
      return {
        label: 'Verifier: pass',
        className: 'bg-green-500/12 text-green-100',
        icon: CheckCircle2,
      };
    case ElectionVerifierOverallStatusProto.ElectionVerifierWarn:
      return {
        label: 'Verifier: warn',
        className: 'bg-amber-500/12 text-amber-100',
        icon: TriangleAlert,
      };
    case ElectionVerifierOverallStatusProto.ElectionVerifierFail:
      return {
        label: 'Verifier: fail',
        className: 'bg-red-500/12 text-red-100',
        icon: AlertCircle,
      };
    default:
      return {
        label: 'Verifier: not available',
        className: 'bg-hush-purple/12 text-hush-text-primary',
        icon: Info,
      };
  }
}

function getAvailabilityValue(
  availability?: ElectionVerificationPackageExportAvailabilityView
): string {
  if (!availability) {
    return 'Not available';
  }

  if (availability.IsAvailable) {
    return availability.PackageHash
      ? `Available - ${shortenProtocolPackageHash(availability.PackageHash)}`
      : 'Available';
  }

  return availability.BlockerCode || 'Blocked';
}

function getAvailabilityAccent(
  availability?: ElectionVerificationPackageExportAvailabilityView
): string | undefined {
  if (!availability) {
    return undefined;
  }

  if (availability.IsAvailable) {
    return 'text-green-100';
  }

  return availability.Blocker === ElectionVerificationPackageBlockerProto.VerificationPackageBlockerUnauthorized
    ? 'text-amber-100'
    : 'text-red-100';
}

function getDisabledExportLabel(
  availability?: ElectionVerificationPackageExportAvailabilityView
): string {
  if (!availability) {
    return 'Export is not available.';
  }

  return availability.Message || availability.BlockerCode || 'Export is currently blocked.';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return typeof btoa === 'function' ? btoa(binary) : binary;
}

function normalizeFileContent(content: ElectionVerificationPackageFileView['Content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return bytesToBase64(content);
}

function downloadPackageBundle(response: ExportElectionVerificationPackageResponse) {
  const packageViewLabel = PACKAGE_VIEW_LABELS[response.PackageView];
  const bundle = {
    electionId: response.ElectionId,
    packageId: response.PackageId,
    packageHash: response.PackageHash,
    packageView: packageViewLabel,
    files: response.Files.map((file) => ({
      relativePath: file.RelativePath,
      mediaType: file.MediaType,
      visibility: file.Visibility,
      contentBase64: normalizeFileContent(file.Content),
    })),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${response.PackageId || `HushElectionPackage-${response.ElectionId}`}-${packageViewLabel}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function ExportButton({
  label,
  packageView,
  availability,
  isLoading,
  onExport,
}: {
  label: string;
  packageView: ElectionVerificationPackageViewProto;
  availability?: ElectionVerificationPackageExportAvailabilityView;
  isLoading: boolean;
  onExport: (packageView: ElectionVerificationPackageViewProto) => void;
}) {
  const isAvailable = Boolean(availability?.IsAvailable);

  return (
    <button
      type="button"
      disabled={!isAvailable || isLoading}
      onClick={() => onExport(packageView)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent md:w-auto"
      title={isAvailable ? label : getDisabledExportLabel(availability)}
      aria-label={isAvailable ? label : `${label} unavailable: ${getDisabledExportLabel(availability)}`}
      data-testid={`verification-package-export-${PACKAGE_VIEW_LABELS[packageView]}`}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span>{label}</span>
    </button>
  );
}

export function VerificationPackageStatusSection({
  electionId,
  actorPublicAddress,
  status,
}: VerificationPackageStatusSectionProps) {
  const [loadingPackageView, setLoadingPackageView] =
    useState<ElectionVerificationPackageViewProto | null>(null);
  const [exportState, setExportState] = useState<ExportState>(null);

  if (!status?.IsVisible) {
    return null;
  }

  const statusCopy = getStatusCopy(status.Status);
  const verifierCopy = getVerifierCopy(status.LastVerifierResult?.OverallStatus);
  const VerifierIcon = verifierCopy.icon;
  const protocolBinding = status.ProtocolPackageBinding;

  const handleExport = async (packageView: ElectionVerificationPackageViewProto) => {
    setLoadingPackageView(packageView);
    setExportState(null);

    try {
      const response = await electionsService.exportElectionVerificationPackage({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        PackageView: packageView,
      });

      if (!response.Success) {
        setExportState({
          packageView,
          tone: 'error',
          message: response.ErrorMessage || response.ResultCode || 'Package export failed.',
          resultCode: response.ResultCode,
        });
        return;
      }

      downloadPackageBundle(response);
      setExportState({
        packageView,
        tone: 'success',
        message: `${PACKAGE_VIEW_LABELS[packageView]} verification package ready.`,
        packageHash: response.PackageHash,
      });
    } catch (error) {
      setExportState({
        packageView,
        tone: 'error',
        message: error instanceof Error ? error.message : 'Package export failed.',
      });
    } finally {
      setLoadingPackageView(null);
    }
  };

  return (
    <section
      className="rounded-[28px] bg-[#151c33] p-5 shadow-sm shadow-black/10"
      data-testid="verification-package-status-section"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-hush-text-accent">
            Verification package
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">
            Independent election-record export
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Export package files for local verifier replay without exposing package contents in the
            default workspace view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusCopy.className}`}>
            <ShieldCheck className="h-4 w-4" />
            {statusCopy.label}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${verifierCopy.className}`}>
            <VerifierIcon className="h-4 w-4" />
            {verifierCopy.label}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <AvailabilityCard
          label="Package status"
          value={status.StatusMessage || statusCopy.body}
          accentClass={status.Status === ElectionVerificationPackageStatusProto.VerificationPackageReady ? 'text-green-100' : 'text-hush-text-primary'}
        />
        <AvailabilityCard
          label="Public package"
          value={getAvailabilityValue(status.PublicPackage)}
          accentClass={getAvailabilityAccent(status.PublicPackage)}
        />
        <AvailabilityCard
          label="Restricted package"
          value={getAvailabilityValue(status.RestrictedPackage)}
          accentClass={getAvailabilityAccent(status.RestrictedPackage)}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-hush-bg-dark/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Export actions
              </div>
              <p className="mt-2 text-sm text-hush-text-accent">
                Public exports avoid restricted roster/checkoff evidence. Restricted exports remain
                limited to owner/admin and designated auditor roles.
              </p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <ExportButton
                label="Download public package"
                packageView={ElectionVerificationPackageViewProto.VerificationPackagePublicAnonymous}
                availability={status.PublicPackage}
                isLoading={
                  loadingPackageView ===
                  ElectionVerificationPackageViewProto.VerificationPackagePublicAnonymous
                }
                onExport={handleExport}
              />
              <ExportButton
                label="Download restricted package"
                packageView={ElectionVerificationPackageViewProto.VerificationPackageRestrictedOwnerAuditor}
                availability={status.RestrictedPackage}
                isLoading={
                  loadingPackageView ===
                  ElectionVerificationPackageViewProto.VerificationPackageRestrictedOwnerAuditor
                }
                onExport={handleExport}
              />
            </div>
          </div>

          {!status.RestrictedPackage?.IsAvailable &&
          status.RestrictedPackage?.Blocker ===
            ElectionVerificationPackageBlockerProto.VerificationPackageBlockerUnauthorized ? (
            <div
              className="mt-4 rounded-2xl bg-amber-500/12 p-4 text-sm text-amber-100"
              data-testid="verification-package-restricted-denied"
            >
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5" />
                <div>
                  <div className="font-semibold">Restricted package not available</div>
                  <div className="mt-2">
                    {status.RestrictedPackage.Message ||
                      'Restricted packages can include named roster/checkoff evidence and remain role-gated.'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {exportState ? (
            <div
              className={`mt-4 rounded-2xl p-4 text-sm ${
                exportState.tone === 'success'
                  ? 'bg-green-500/12 text-green-100'
                  : 'bg-red-500/12 text-red-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {exportState.tone === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5" />
                )}
                <div>
                  <div className="font-semibold">{exportState.message}</div>
                  {exportState.packageHash ? (
                    <div className="mt-2 font-mono text-xs">
                      Package hash: {shortenProtocolPackageHash(exportState.packageHash)}
                    </div>
                  ) : null}
                  {exportState.resultCode ? (
                    <div className="mt-2 font-mono text-xs">
                      Result code: {exportState.resultCode}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-hush-bg-dark/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Last verifier result
          </div>
          <div className="mt-3 text-sm text-hush-text-primary">
            {status.LastVerifierResult?.Message || 'No verifier output has been recorded.'}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Checks
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {status.LastVerifierResult
                  ? `${status.LastVerifierResult.PassedCount} passed, ${status.LastVerifierResult.WarningCount} warnings, ${status.LastVerifierResult.FailedCount} failed`
                  : 'Not recorded'}
              </div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Verified
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {status.LastVerifierResult?.HasVerifiedAt
                  ? formatTimestamp(status.LastVerifierResult.VerifiedAt)
                  : 'Not available'}
              </div>
            </div>
          </div>
          {status.LastVerifierResult?.PackageHash ? (
            <div className="mt-3 rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Verifier package hash
              </div>
              <div className="mt-2 break-all font-mono text-sm text-hush-text-primary">
                {formatArtifactValue(status.LastVerifierResult.PackageHash)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {protocolBinding ? (
        <details className="mt-5 rounded-2xl bg-black/18 p-4">
          <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
            Show protocol package details
          </summary>
          <div className="mt-4">
            <ProtocolPackageBindingPanel
              binding={protocolBinding}
              mode="evidence"
              testId="verification-package-protocol-refs"
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}

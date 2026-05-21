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
  getSp07VerificationPackagePresentation,
  getSp08VerificationPackagePresentation,
  getSp09VerificationPackagePresentation,
  getSp10VerificationPackagePresentation,
  getSp11VerificationPackagePresentation,
  shortenProtocolPackageHash,
} from './contracts';
import { AnomalyEvidenceManifestStatusPanel } from './AnomalyEvidenceManifestStatusPanel';
import { AvailabilityCard } from './HushVotingWorkspaceShared';
import { ProtocolPackageBindingPanel } from './ProtocolPackageBindingPanel';
import { VoidPublicationStatusDetails } from './VoidElectionPanels';

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
        label: 'Export available',
        body: 'A local election-record verifier export can be generated for this finalized election.',
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
    case ElectionVerificationPackageStatusProto.VerificationPackageVoided:
      return {
        label: 'Election VOID',
        body: 'This election has a terminal VOID decision. Export status is replaced by public VOID package refs and verifier result evidence.',
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

function getSp04EvidenceAccent(status: ElectionVerificationPackageStatusView): string {
  const evidence = status.Sp04Evidence;
  if (!evidence) {
    return 'text-hush-text-accent';
  }

  if (!evidence.EvidenceExpected) {
    return 'text-hush-text-accent';
  }

  if (evidence.PublicEvidenceAvailable && evidence.RestrictedEvidenceAvailable) {
    return 'text-green-100';
  }

  return 'text-amber-100';
}

function getSp05EvidenceAccent(status: ElectionVerificationPackageStatusView): string {
  const evidence = status.Sp05Evidence;
  if (!evidence) {
    return 'text-hush-text-accent';
  }

  if (!evidence.EvidenceExpected) {
    return 'text-hush-text-accent';
  }

  if (evidence.PublicEvidenceAvailable && evidence.LatestEliResultCode === 'eligibility_evidence_valid') {
    return 'text-green-100';
  }

  return evidence.PublicEvidenceAvailable ? 'text-amber-100' : 'text-red-100';
}

function getSp06EvidenceAccent(status: ElectionVerificationPackageStatusView): string {
  const evidence = status.Sp06Evidence;
  if (!evidence) {
    return 'text-hush-text-accent';
  }

  if (!evidence.EvidenceExpected) {
    return 'text-hush-text-accent';
  }

  const hasBlockingEvidence =
    evidence.MissingEvidenceCount > 0 ||
    evidence.StaleEvidenceCount > 0 ||
    evidence.IncompatibleEvidenceCount > 0 ||
    evidence.RejectedReleaseArtifactCount > 0;

  if (!evidence.PublicEvidenceAvailable || hasBlockingEvidence) {
    return 'text-amber-100';
  }

  return evidence.LatestCtrlResultCode ? 'text-green-100' : 'text-amber-100';
}

function getReleaseIntegrityToneClass(tone: 'neutral' | 'success' | 'warning' | 'error'): string {
  switch (tone) {
    case 'success':
      return 'text-green-100';
    case 'warning':
      return 'text-amber-100';
    case 'error':
      return 'text-red-100';
    case 'neutral':
    default:
      return 'text-hush-text-primary';
  }
}

function getReleaseIntegritySurfaceClass(tone: 'neutral' | 'success' | 'warning' | 'error'): string {
  switch (tone) {
    case 'success':
      return 'bg-green-500/10';
    case 'warning':
      return 'bg-amber-500/10';
    case 'error':
      return 'bg-red-500/10';
    case 'neutral':
    default:
      return 'bg-black/20';
  }
}

function getReleaseIntegrityIcon(tone: 'neutral' | 'success' | 'warning' | 'error') {
  switch (tone) {
    case 'success':
      return CheckCircle2;
    case 'warning':
      return TriangleAlert;
    case 'error':
      return AlertCircle;
    case 'neutral':
    default:
      return Info;
  }
}

function formatReleaseIntegrityMode(value?: string): string {
  return value || 'Not recorded';
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
  const sp07Presentation = getSp07VerificationPackagePresentation(status, 'auditor');
  const sp08Presentation = getSp08VerificationPackagePresentation(status, 'auditor');
  const sp09Presentation = getSp09VerificationPackagePresentation(status, 'auditor');
  const sp10Presentation = getSp10VerificationPackagePresentation(status, 'auditor');
  const sp11Presentation = getSp11VerificationPackagePresentation(status, 'auditor');
  const ReleaseIntegrityIcon = sp08Presentation
    ? getReleaseIntegrityIcon(sp08Presentation.tone)
    : Info;
  const ExternalReviewIcon = sp09Presentation
    ? getReleaseIntegrityIcon(sp09Presentation.tone)
    : Info;
  const OperationalSecurityIcon = sp10Presentation
    ? getReleaseIntegrityIcon(sp10Presentation.tone)
    : Info;
  const RegulatoryClaimIcon = sp11Presentation
    ? getReleaseIntegrityIcon(sp11Presentation.tone)
    : Info;

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
        message: `${PACKAGE_VIEW_LABELS[packageView]} verification package download prepared.`,
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

      {status.VoidPublicationStatus ? (
        <div className="mt-5" data-testid="verification-package-void-status">
          <VoidPublicationStatusDetails status={status} />
        </div>
      ) : null}

      <div className="mt-5">
        <AnomalyEvidenceManifestStatusPanel
          electionId={electionId}
          actorPublicAddress={actorPublicAddress}
          scopeId="package"
          title="Restricted anomaly intake manifest"
          description="Package readiness depends on scanner status, payload availability, recipient wraps, and manifest hash alignment before restricted evidence can be exported."
          testId="verification-package-anomaly-manifest"
        />
      </div>

      {status.Sp04Evidence ? (
        <div
          className="mt-5 rounded-2xl bg-hush-bg-dark/70 p-4"
          data-testid="verification-package-sp04-evidence"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-04 evidence
              </div>
              <div className={`mt-2 text-sm font-semibold ${getSp04EvidenceAccent(status)}`}>
                {status.Sp04Evidence.Message ||
                  (status.Sp04Evidence.EvidenceExpected
                    ? 'Challenge/spoil evidence expected for this package.'
                    : 'Challenge/spoil evidence is not expected for this profile.')}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Prepared
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp04Evidence.PreparedPackageCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Spoiled
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp04Evidence.SpoiledPackageCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Receipts
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp04Evidence.AcceptedBoundReceiptCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Set hash
                </div>
                <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                  {status.Sp04Evidence.ReceiptCommitmentSetHash
                    ? formatArtifactValue(status.Sp04Evidence.ReceiptCommitmentSetHash)
                    : 'Not available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {status.Sp05Evidence ? (
        <div
          className="mt-5 rounded-2xl bg-hush-bg-dark/70 p-4"
          data-testid="verification-package-sp05-evidence"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-05 eligibility/checkoff
              </div>
              <div className={`mt-2 text-sm font-semibold ${getSp05EvidenceAccent(status)}`}>
                {status.Sp05Evidence.Message ||
                  'Eligibility/checkoff evidence status is available for this package.'}
              </div>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {status.Sp05Evidence.LatestEliResultCode || 'ELI not available'}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Rostered
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp05Evidence.RosteredCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Commitments
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp05Evidence.CommitmentCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Counted
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp05Evidence.CountedParticipationCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Roster hash
                </div>
                <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                  {status.Sp05Evidence.RosterCanonicalHash
                    ? formatArtifactValue(status.Sp05Evidence.RosterCanonicalHash)
                    : 'Not available'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {status.Sp06Evidence ? (
        <div
          className="mt-5 rounded-2xl bg-hush-bg-dark/70 p-4"
          data-testid="verification-package-sp06-evidence"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-06 trustee control
              </div>
              <div className={`mt-2 text-sm font-semibold ${getSp06EvidenceAccent(status)}`}>
                {status.Sp06Evidence.Message ||
                  'Trustee control-domain evidence status is available for this package.'}
              </div>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {status.Sp06Evidence.LatestCtrlResultCode || 'CTRL not available'}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Profile
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {status.Sp06Evidence.ControlDomainProfileId}
                  {status.Sp06Evidence.ControlDomainProfileVersion
                    ? ` ${status.Sp06Evidence.ControlDomainProfileVersion}`
                    : ''}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Threshold
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp06Evidence.TrusteeThreshold} of {status.Sp06Evidence.TrusteeCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Open evidence
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp06Evidence.CompleteEvidenceCount} complete /{' '}
                  {status.Sp06Evidence.MissingEvidenceCount} missing
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Release artifacts
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp06Evidence.AcceptedReleaseArtifactCount} accepted /{' '}
                  {status.Sp06Evidence.RejectedReleaseArtifactCount} rejected
                </div>
              </div>
            </div>
          </div>
          {status.Sp06Evidence.Blockers.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-amber-100">
              {status.Sp06Evidence.Blockers.map((blocker) => (
                <li key={`${blocker.Code}-${blocker.TrusteeRef}`} className="rounded-2xl bg-amber-500/10 px-3 py-2">
                  {blocker.Message || blocker.Code}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {status.Sp07Evidence && sp07Presentation ? (
        <div
          className="mt-5 rounded-2xl bg-hush-bg-dark/70 p-4"
          data-testid="verification-package-sp07-evidence"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-07 publication proof
              </div>
              <div
                className={`mt-2 text-sm font-semibold ${
                  sp07Presentation.tone === 'success'
                    ? 'text-green-100'
                    : sp07Presentation.tone === 'error'
                      ? 'text-red-100'
                      : sp07Presentation.tone === 'warning'
                        ? 'text-amber-100'
                        : 'text-hush-text-primary'
                }`}
              >
                {status.Sp07Evidence.Message || sp07Presentation.description}
              </div>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {status.Sp07Evidence.LatestPubResultCode || 'PUB not available'}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Ballots
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp07Evidence.PublishedBallotCount || status.Sp07Evidence.AcceptedBallotCount}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Chunks
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {status.Sp07Evidence.CompletedChunkCount} / {status.Sp07Evidence.ChunkCount}
                  {status.Sp07Evidence.FailedChunkCount > 0
                    ? ` failed ${status.Sp07Evidence.FailedChunkCount}`
                    : ''}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Transcript
                </div>
                <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                  {status.Sp07Evidence.TranscriptHash
                    ? formatArtifactValue(status.Sp07Evidence.TranscriptHash)
                    : 'Not available'}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Proof
                </div>
                <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                  {status.Sp07Evidence.ProofHash
                    ? formatArtifactValue(status.Sp07Evidence.ProofHash)
                    : 'Not available'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Published stream
              </div>
              <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                {status.Sp07Evidence.PublishedBallotStreamHash
                  ? formatArtifactValue(status.Sp07Evidence.PublishedBallotStreamHash)
                  : 'Not available'}
              </div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Witness deletion
              </div>
              <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                {status.Sp07Evidence.WitnessDeletionReceiptHash
                  ? formatArtifactValue(status.Sp07Evidence.WitnessDeletionReceiptHash)
                  : 'Not available'}
              </div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                External review
              </div>
              <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                {status.Sp07Evidence.ExternalReviewStatus || 'external_crypto_review_pending'}
              </div>
            </div>
          </div>

          {status.Sp07Evidence.Blockers.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-red-100">
              {status.Sp07Evidence.Blockers.map((blocker) => (
                <li key={`${blocker.Code}-${blocker.Message}`} className="rounded-2xl bg-red-500/10 px-3 py-2">
                  {blocker.Message || blocker.Code}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {status.Sp08ReleaseIntegrity && sp08Presentation ? (
        <div
          className={`mt-5 rounded-2xl p-4 ${getReleaseIntegritySurfaceClass(sp08Presentation.tone)}`}
          data-testid="verification-package-sp08-evidence"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-08 release integrity
              </div>
              <div
                className={`mt-2 flex items-center gap-2 text-sm font-semibold ${getReleaseIntegrityToneClass(sp08Presentation.tone)}`}
              >
                <ReleaseIntegrityIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{sp08Presentation.label}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                {sp08Presentation.description}
              </p>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {sp08Presentation.primaryResultCode || 'REL not available'}
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Evidence mode
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {formatReleaseIntegrityMode(sp08Presentation.evidenceMode)}
                </div>
                {status.Sp08ReleaseIntegrity.NotForReleaseIntegrityClaims ? (
                  <div className="mt-1 text-xs text-amber-100">
                    Not for release-integrity claims
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Release manifest
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {status.Sp08ReleaseIntegrity.ReleaseManifestName || 'Not recorded'}
                </div>
                <div
                  className="mt-1 break-all font-mono text-xs text-hush-text-accent"
                  title={sp08Presentation.releaseManifestHashFull || undefined}
                >
                  {sp08Presentation.releaseManifestHashShort}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Evidence files
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {sp08Presentation.evidenceFileCount} public files
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  Components {sp08Presentation.componentCount} / lifecycle{' '}
                  {sp08Presentation.lifecycleBindingCount}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Protocol package manifest
              </div>
              <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                {status.Sp08ReleaseIntegrity.ProtocolPackageManifestName || 'Not recorded'}
              </div>
              <div
                className="mt-1 break-all font-mono text-xs text-hush-text-accent"
                title={sp08Presentation.protocolPackageManifestHashFull || undefined}
              >
                {sp08Presentation.protocolPackageManifestHashShort}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Lifecycle binding
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {sp08Presentation.lifecycleMismatchCount > 0
                  ? `${sp08Presentation.lifecycleMismatchCount} mismatch`
                  : 'Observed releases match'}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                {sp08Presentation.blocksHighAssurance
                  ? 'Blocks high-assurance claims'
                  : 'No high-assurance block reported'}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Mobile evidence
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {sp08Presentation.mobileEvidenceIncluded ? 'Included' : 'Not included'}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                Aggregate release evidence only
              </div>
            </div>
          </div>

          {sp08Presentation.blockingCodes.length > 0 ? (
            <ul
              className={`mt-4 space-y-2 text-sm ${getReleaseIntegrityToneClass(sp08Presentation.tone)}`}
              aria-label="SP-08 release-integrity blockers"
            >
              {sp08Presentation.blockingCodes.map((code) => (
                <li key={code} className="rounded-2xl bg-black/20 px-3 py-2 font-mono text-xs">
                  {code}
                </li>
              ))}
            </ul>
          ) : null}

          {sp08Presentation.showTechnicalRefs ? (
            <details className="mt-4 rounded-2xl bg-black/18 p-4">
              <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
                Show release evidence details
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                    Components
                  </div>
                  <div className="mt-3 space-y-2" data-testid="verification-package-sp08-components">
                    {status.Sp08ReleaseIntegrity.Components.length > 0 ? (
                      status.Sp08ReleaseIntegrity.Components.map((component) => (
                        <div
                          key={`${component.ComponentId}-${component.ArtifactDigest}`}
                          className="rounded-2xl bg-black/20 p-3"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="break-words text-sm font-semibold text-hush-text-primary">
                                {component.ComponentId || 'component'}
                              </div>
                              <div className="mt-1 text-xs text-hush-text-accent">
                                {component.ComponentType || 'component evidence'}
                                {component.IsPlaceholder ? ' / placeholder' : ''}
                                {component.HasSigningFingerprint ? ' / signed' : ''}
                              </div>
                            </div>
                            <code
                              className="break-all text-xs text-hush-text-primary sm:text-right"
                              title={component.ArtifactDigest || undefined}
                            >
                              {formatArtifactValue(component.ArtifactDigest)}
                            </code>
                          </div>
                          {component.ImmutableReference ? (
                            <div
                              className="mt-2 break-all font-mono text-xs text-hush-text-accent"
                              title={component.ImmutableReference}
                            >
                              {formatArtifactValue(component.ImmutableReference)}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-accent">
                        No component rows were projected.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Lifecycle observations
                    </div>
                    <div
                      className="mt-3 space-y-2"
                      data-testid="verification-package-sp08-lifecycle"
                    >
                      {status.Sp08ReleaseIntegrity.LifecycleBindings.length > 0 ? (
                        status.Sp08ReleaseIntegrity.LifecycleBindings.map((binding) => (
                          <div
                            key={`${binding.LifecycleStage}-${binding.ExpectedReleaseId}-${binding.ObservedReleaseId}`}
                            className="rounded-2xl bg-black/20 p-3"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-sm font-semibold text-hush-text-primary">
                                {binding.LifecycleStage || 'lifecycle stage'}
                              </div>
                              <div
                                className={`text-xs font-semibold ${
                                  binding.MatchesSealedPolicy ? 'text-green-100' : 'text-red-100'
                                }`}
                              >
                                {binding.MatchesSealedPolicy ? 'Matched' : 'Mismatch'}
                              </div>
                            </div>
                            <div className="mt-2 grid gap-2 text-xs text-hush-text-accent sm:grid-cols-2">
                              <div className="break-all">
                                Expected: {binding.ExpectedReleaseId || 'Not recorded'} /{' '}
                                {formatArtifactValue(binding.ExpectedArtifactDigest)}
                              </div>
                              <div className="break-all">
                                Observed: {binding.ObservedReleaseId || 'Not recorded'} /{' '}
                                {formatArtifactValue(binding.ObservedArtifactDigest)}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-accent">
                          No lifecycle rows were projected.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Evidence files
                    </div>
                    <div className="mt-3 space-y-2" data-testid="verification-package-sp08-files">
                      {status.Sp08ReleaseIntegrity.EvidenceFiles.length > 0 ? (
                        status.Sp08ReleaseIntegrity.EvidenceFiles.map((file) => (
                          <div
                            key={file.RelativePath}
                            className="rounded-2xl bg-black/20 p-3"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 break-words text-sm font-semibold text-hush-text-primary">
                                {file.RelativePath}
                              </div>
                              <div
                                className={`text-xs font-semibold ${
                                  file.IsPresent ? 'text-green-100' : 'text-red-100'
                                }`}
                              >
                                {file.IsPresent ? 'Present' : 'Missing'}
                              </div>
                            </div>
                            <div
                              className="mt-2 break-all font-mono text-xs text-hush-text-accent"
                              title={file.ContentHash || undefined}
                            >
                              {formatArtifactValue(file.ContentHash)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-accent">
                          No SP-08 evidence files were projected.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {status.Sp09ExternalReview && sp09Presentation ? (
        <div
          className={`mt-5 rounded-2xl p-4 ${getReleaseIntegritySurfaceClass(sp09Presentation.tone)}`}
          data-testid="verification-package-sp09-external-review"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-09 external review
              </div>
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getReleaseIntegrityToneClass(sp09Presentation.tone)}`}
              >
                <ExternalReviewIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{sp09Presentation.label}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                {sp09Presentation.description}
              </p>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {sp09Presentation.primaryResultCode || 'REV not available'}
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Availability
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {sp09Presentation.availability}
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  {sp09Presentation.detailedStatus}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Claim state
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {sp09Presentation.claimState}
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  {sp09Presentation.programVersion}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Reviewed artifacts
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {sp09Presentation.reviewedArtifactCount}
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  Open findings {sp09Presentation.openFindingCount}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Review scope
              </div>
              <div
                className="mt-2 break-all font-mono text-xs text-hush-text-primary"
                title={sp09Presentation.reviewScope}
              >
                {sp09Presentation.reviewScopeShort}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                High/Critical open
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {sp09Presentation.openHighFindingCount} high / {sp09Presentation.openCriticalFindingCount} critical
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                Strong claims are blocked when high or critical findings remain open.
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Evidence files
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {sp09Presentation.evidenceFileCount}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                Public package keeps restricted report and finding detail out of view.
              </div>
            </div>
          </div>

          {sp09Presentation.blockingCodes.length > 0 ? (
            <ul
              className={`mt-4 space-y-2 text-sm ${getReleaseIntegrityToneClass(sp09Presentation.tone)}`}
              aria-label="SP-09 external-review blockers"
            >
              {sp09Presentation.blockingCodes.map((code) => (
                <li key={code} className="rounded-2xl bg-black/20 px-3 py-2 font-mono text-xs">
                  {code}
                </li>
              ))}
            </ul>
          ) : null}

          {sp09Presentation.showTechnicalRefs ? (
            <details className="mt-4 rounded-2xl bg-black/18 p-4">
              <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
                Show external review evidence details
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                    Finding summary
                  </div>
                  <div className="mt-3 space-y-2" data-testid="verification-package-sp09-findings">
                    {status.Sp09ExternalReview.FindingSummary.length > 0 ? (
                      status.Sp09ExternalReview.FindingSummary.map((finding) => (
                        <div
                          key={finding.Severity}
                          className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-primary"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{finding.Severity}</span>
                            <span className="font-mono text-xs text-hush-text-accent">
                              open {finding.OpenCount} / fixed {finding.FixedCount} / accepted {finding.AcceptedLimitationCount}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-accent">
                        No finding rows were projected.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                    Reviewed artifacts
                  </div>
                  <div className="mt-3 space-y-2" data-testid="verification-package-sp09-reviewed-artifacts">
                    {status.Sp09ExternalReview.ReviewedArtifacts.length > 0 ? (
                      status.Sp09ExternalReview.ReviewedArtifacts.map((artifact) => (
                        <div
                          key={`${artifact.ArtifactId}-${artifact.ArtifactHash}`}
                          className="rounded-2xl bg-black/20 p-3"
                        >
                          <div className="break-words text-sm font-semibold text-hush-text-primary">
                            {artifact.ArtifactName || artifact.ArtifactId}
                          </div>
                          <div
                            className="mt-2 break-all font-mono text-xs text-hush-text-accent"
                            title={artifact.ArtifactHash || undefined}
                          >
                            {formatArtifactValue(artifact.ArtifactHash)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-accent">
                        No reviewer-scoped artifact hashes are available yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Evidence files
                </div>
                <div className="mt-3 space-y-2" data-testid="verification-package-sp09-files">
                  {status.Sp09ExternalReview.EvidenceFiles.map((file) => (
                    <div
                      key={file.RelativePath}
                      className="rounded-2xl bg-black/20 p-3"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 break-words text-sm font-semibold text-hush-text-primary">
                          {file.RelativePath}
                        </div>
                        <div
                          className={`text-xs font-semibold ${
                            file.IsPresent ? 'text-green-100' : 'text-red-100'
                          }`}
                        >
                          {file.IsPresent ? 'Present' : 'Missing'}
                        </div>
                      </div>
                      <div
                        className="mt-2 break-all font-mono text-xs text-hush-text-accent"
                        title={file.ContentHash || undefined}
                      >
                        {formatArtifactValue(file.ContentHash)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {status.Sp10OperationalSecurity && sp10Presentation ? (
        <div
          className={`mt-5 rounded-2xl p-4 ${getReleaseIntegritySurfaceClass(sp10Presentation.tone)}`}
          data-testid="verification-package-sp10-operational-security"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-10 operational security
              </div>
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getReleaseIntegrityToneClass(sp10Presentation.tone)}`}
              >
                <OperationalSecurityIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{sp10Presentation.label}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                {sp10Presentation.description}
              </p>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {sp10Presentation.primaryResultCode || 'OPS not available'}
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Evidence state
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {sp10Presentation.evidenceState}
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  {sp10Presentation.programVersion}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Deployment profile
                </div>
                <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                  {sp10Presentation.deploymentProfileId}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Evidence files
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {sp10Presentation.publicEvidenceFileCount} public /{' '}
                  {sp10Presentation.restrictedEvidenceFileCount} restricted
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  {sp10Presentation.blocksHighAssurance
                    ? 'Blocks high-assurance operational claims'
                    : 'No high-assurance operational block reported'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Custody mode
              </div>
              <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                {sp10Presentation.custodyMode}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                {sp10Presentation.executorKeyLifecycle}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Incident status
              </div>
              <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                {sp10Presentation.incidentStatus}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                FEAT-106 readiness remains separate.
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Release binding
              </div>
              <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                {sp10Presentation.releaseManifestHashShort}
              </div>
              <div className="mt-1 break-words text-xs text-hush-text-accent">
                {sp10Presentation.releaseEvidenceMode}
              </div>
            </div>
          </div>

          {sp10Presentation.blockingCodes.length > 0 ? (
            <ul
              className={`mt-4 space-y-2 text-sm ${getReleaseIntegrityToneClass(sp10Presentation.tone)}`}
              aria-label="SP-10 operational-security blockers"
            >
              {sp10Presentation.blockingCodes.map((code) => (
                <li key={code} className="rounded-2xl bg-black/20 px-3 py-2 font-mono text-xs">
                  {code}
                </li>
              ))}
            </ul>
          ) : null}

          {sp10Presentation.showTechnicalRefs ? (
            <details className="mt-4 rounded-2xl bg-black/18 p-4">
              <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
                Show operational evidence details
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-black/20 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Immutable deployment
                    </div>
                    <div
                      className="mt-2 break-all font-mono text-xs text-hush-text-primary"
                      title={sp10Presentation.immutableDeploymentRefFull || undefined}
                    >
                      {sp10Presentation.immutableDeploymentRefShort}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3 text-sm text-hush-text-primary">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Restricted refs
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-hush-text-accent">
                      <div className="break-all">
                        Access: {formatArtifactValue(sp10Presentation.accessSnapshotRef)}
                      </div>
                      <div className="break-all">
                        Backup: {formatArtifactValue(sp10Presentation.backupRestoreRef)}
                      </div>
                      <div className="break-all">
                        Auditor room: {formatArtifactValue(sp10Presentation.auditorRoomAccessLogRef)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                    Evidence files
                  </div>
                  <div className="mt-3 space-y-2" data-testid="verification-package-sp10-files">
                    {status.Sp10OperationalSecurity.EvidenceFiles.map((file) => (
                      <div key={file.RelativePath} className="rounded-2xl bg-black/20 p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 break-words text-sm font-semibold text-hush-text-primary">
                            {file.RelativePath}
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              file.IsPresent ? 'text-green-100' : 'text-red-100'
                            }`}
                          >
                            {file.IsPresent ? 'Present' : 'Missing'}
                          </div>
                        </div>
                        <div
                          className="mt-2 break-all font-mono text-xs text-hush-text-accent"
                          title={file.ContentHash || undefined}
                        >
                          {formatArtifactValue(file.ContentHash)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {status.Sp11RegulatoryClaim && sp11Presentation?.claimExported ? (
        <div
          className={`mt-5 rounded-2xl p-4 ${getReleaseIntegritySurfaceClass(sp11Presentation.tone)}`}
          data-testid="verification-package-sp11-regulatory-claim"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                SP-11 regulatory tracker
              </div>
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getReleaseIntegrityToneClass(sp11Presentation.tone)}`}
              >
                <RegulatoryClaimIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{sp11Presentation.label}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                {sp11Presentation.description}
              </p>
              <div className="mt-2 font-mono text-xs text-hush-text-accent">
                {sp11Presentation.primaryResultCode || 'REG not available'}
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Jurisdiction
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {sp11Presentation.jurisdictionId}
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  {sp11Presentation.trackerVersion}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Claim state
                </div>
                <div className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
                  {sp11Presentation.claimState}
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  {sp11Presentation.blocksClaims ? 'Claim reliance limited' : 'Tracker claim allowed'}
                </div>
              </div>

              <div className="rounded-2xl bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Evidence files
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {sp11Presentation.publicEvidenceFileCount} public /{' '}
                  {sp11Presentation.restrictedEvidenceFileCount} restricted
                </div>
                <div className="mt-1 text-xs text-hush-text-accent">
                  Not legal advice or authority approval.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Source checked
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {status.Sp11RegulatoryClaim.HasSourceCheckedAt
                  ? formatTimestamp(status.Sp11RegulatoryClaim.SourceCheckedAt)
                  : 'Not recorded'}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                Next review{' '}
                {status.Sp11RegulatoryClaim.HasNextReviewAt
                  ? formatTimestamp(status.Sp11RegulatoryClaim.NextReviewAt)
                  : 'not recorded'}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Claim id
              </div>
              <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                {sp11Presentation.claimId}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Authority evidence
              </div>
              <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                {formatArtifactValue(sp11Presentation.authorityEvidenceRef)}
              </div>
              <div className="mt-1 text-xs text-hush-text-accent">
                {sp11Presentation.requiresAuthorityEvidence ? 'Required by claim' : 'Not required'}
              </div>
            </div>
          </div>

          {sp11Presentation.blockingCodes.length > 0 ? (
            <ul
              className={`mt-4 space-y-2 text-sm ${getReleaseIntegrityToneClass(sp11Presentation.tone)}`}
              aria-label="SP-11 regulatory-claim blockers"
            >
              {sp11Presentation.blockingCodes.map((code) => (
                <li key={code} className="rounded-2xl bg-black/20 px-3 py-2 font-mono text-xs">
                  {code}
                </li>
              ))}
            </ul>
          ) : null}

          {sp11Presentation.showTechnicalRefs ? (
            <details className="mt-4 rounded-2xl bg-black/18 p-4">
              <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
                Show regulatory evidence details
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-black/20 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Source
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                      {sp11Presentation.sourceRef || 'Not recorded'}
                    </div>
                    <div className="mt-2 break-words text-xs text-hush-text-accent">
                      Owner: {sp11Presentation.owner || 'Not recorded'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Restricted workpaper
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-hush-text-primary">
                      {formatArtifactValue(sp11Presentation.restrictedWorkpaperRef)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                    Evidence files
                  </div>
                  <div className="mt-3 space-y-2" data-testid="verification-package-sp11-files">
                    {status.Sp11RegulatoryClaim.EvidenceFiles.map((file) => (
                      <div key={file.RelativePath} className="rounded-2xl bg-black/20 p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 break-words text-sm font-semibold text-hush-text-primary">
                            {file.RelativePath}
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              file.IsPresent ? 'text-green-100' : 'text-red-100'
                            }`}
                          >
                            {file.IsPresent ? 'Present' : 'Missing'}
                          </div>
                        </div>
                        <div
                          className="mt-2 break-all font-mono text-xs text-hush-text-accent"
                          title={file.ContentHash || undefined}
                        >
                          {formatArtifactValue(file.ContentHash)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

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

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionVerificationPackageBlockerProto,
  ElectionVerificationPackageStatusProto,
  ElectionVerificationPackageViewProto,
  ElectionVerifierOverallStatusProto,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { VerificationPackageStatusSection } from './VerificationPackageStatusSection';
import {
  createVerificationPackageAvailability,
  createVerificationPackageStatus,
} from './HushVotingWorkspaceTestUtils';

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: {
    exportElectionVerificationPackage: vi.fn(),
  },
}));

const exportElectionVerificationPackageMock = vi.mocked(
  electionsService.exportElectionVerificationPackage
);

describe('VerificationPackageStatusSection', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:verification-package'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders available package export status, DraftPrivate refs, and not-available verifier status', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="actor-address"
        status={createVerificationPackageStatus()}
      />
    );

    expect(screen.getByTestId('verification-package-status-section')).toHaveTextContent(
      'Independent election-record export'
    );
    expect(screen.getByText('Export available')).toBeInTheDocument();
    expect(screen.getByText('Verifier: not available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download public package' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download restricted package' })).toBeEnabled();

    fireEvent.click(screen.getByText('Show protocol package details'));

    expect(screen.getByTestId('verification-package-protocol-refs')).toHaveTextContent(
      'Draft/private'
    );
  });

  it('shows restricted package denial as a privacy boundary', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="trustee-address"
        status={createVerificationPackageStatus({
          RestrictedPackage: createVerificationPackageAvailability({
            PackageView:
              ElectionVerificationPackageViewProto.VerificationPackageRestrictedOwnerAuditor,
            VerifierProfileId: 'restricted_owner_auditor_v1',
            IsAvailable: false,
            Blocker:
              ElectionVerificationPackageBlockerProto.VerificationPackageBlockerUnauthorized,
            BlockerCode: 'restricted_export_unauthorized',
            Message:
              'Restricted package export is limited to the owner/admin and designated auditor roles.',
            PackageId: '',
            PackageHash: '',
          }),
        })}
      />
    );

    expect(screen.getByTestId('verification-package-restricted-denied')).toHaveTextContent(
      'Restricted package not available'
    );
    expect(screen.getByRole('button', { name: 'Download public package' })).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name:
          'Download restricted package unavailable: Restricted package export is limited to the owner/admin and designated auditor roles.',
      })
    ).toBeDisabled();
  });

  it('does not render voter-facing package refs when status is hidden', () => {
    const { container } = render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="voter-address"
        status={createVerificationPackageStatus({
          IsVisible: false,
        })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('downloads the public package bundle after an export succeeds', async () => {
    exportElectionVerificationPackageMock.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ElectionId: 'election-1',
      ActorPublicAddress: 'actor-address',
      PackageView: ElectionVerificationPackageViewProto.VerificationPackagePublicAnonymous,
      Blocker: ElectionVerificationPackageBlockerProto.VerificationPackageBlockerNone,
      ResultCode: '',
      PackageId: 'HushElectionPackage-election-1',
      PackageHash: 'f'.repeat(64),
      Files: [
        {
          RelativePath: 'ElectionRecord.json',
          MediaType: 'application/json',
          Visibility: 0,
          Content: 'e30=',
        },
      ],
    });

    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="actor-address"
        status={createVerificationPackageStatus()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download public package' }));

    await waitFor(() => {
      expect(exportElectionVerificationPackageMock).toHaveBeenCalledWith({
        ElectionId: 'election-1',
        ActorPublicAddress: 'actor-address',
        PackageView: ElectionVerificationPackageViewProto.VerificationPackagePublicAnonymous,
      });
    });
    expect(screen.getByText('public verification package download prepared.')).toBeInTheDocument();
  });

  it('renders warning verifier state with text, not only color', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="actor-address"
        status={createVerificationPackageStatus({
          LastVerifierResult: {
            OverallStatus: ElectionVerifierOverallStatusProto.ElectionVerifierWarn,
            VerifierVersion: 'hush-voting-verify v0.1.0',
            PackageHash: 'f'.repeat(64),
            PassedCount: 22,
            WarningCount: 2,
            FailedCount: 0,
            NotApplicableCount: 8,
            Message: 'Verifier completed with profile warnings.',
            HasVerifiedAt: false,
          },
        })}
      />
    );

    expect(screen.getByText('Verifier: warn')).toBeInTheDocument();
    expect(screen.getByText('Verifier completed with profile warnings.')).toBeInTheDocument();
    expect(screen.getByText('22 passed, 2 warnings, 0 failed')).toBeInTheDocument();
  });

  it.each([
    [
      ElectionVerifierOverallStatusProto.ElectionVerifierPass,
      'Verifier: pass',
      'Verifier completed successfully.',
    ],
    [
      ElectionVerifierOverallStatusProto.ElectionVerifierFail,
      'Verifier: fail',
      'Verifier failed required checks.',
    ],
  ])('renders verifier %s state with explicit text', (overallStatus, label, message) => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="actor-address"
        status={createVerificationPackageStatus({
          LastVerifierResult: {
            OverallStatus: overallStatus,
            VerifierVersion: 'hush-voting-verify v0.1.0',
            PackageHash: 'f'.repeat(64),
            PassedCount: overallStatus === ElectionVerifierOverallStatusProto.ElectionVerifierPass ? 30 : 22,
            WarningCount: 0,
            FailedCount: overallStatus === ElectionVerifierOverallStatusProto.ElectionVerifierFail ? 1 : 0,
            NotApplicableCount: 0,
            Message: message,
            HasVerifiedAt: false,
          },
        })}
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it.each([
    [
      ElectionVerificationPackageStatusProto.VerificationPackageNotFinalized,
      ElectionVerificationPackageBlockerProto.VerificationPackageBlockerNotFinalized,
      'election_not_finalized',
      'Not finalized',
    ],
    [
      ElectionVerificationPackageStatusProto.VerificationPackageMissing,
      ElectionVerificationPackageBlockerProto.VerificationPackageBlockerMissingPackage,
      'package_manifest_missing_artifact',
      'Package missing',
    ],
    [
      ElectionVerificationPackageStatusProto.VerificationPackageProtocolRefsBlocked,
      ElectionVerificationPackageBlockerProto.VerificationPackageBlockerProtocolRefs,
      'verifier_profile_package_mismatch',
      'Protocol refs blocked',
    ],
    [
      ElectionVerificationPackageStatusProto.VerificationPackageExportFailed,
      ElectionVerificationPackageBlockerProto.VerificationPackageBlockerExportFailed,
      'report_package_generation_failed',
      'Export failed',
    ],
    [
      ElectionVerificationPackageStatusProto.VerificationPackageProtocolRefsBlocked,
      ElectionVerificationPackageBlockerProto.VerificationPackageBlockerProfileMismatch,
      'verifier_profile_package_mismatch',
      'Protocol refs blocked',
    ],
  ])('renders blocker %s as disabled export controls', (statusCode, blocker, blockerCode, label) => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="actor-address"
        status={createVerificationPackageStatus({
          Status: statusCode,
          StatusMessage: 'Verification package export is blocked.',
          PublicPackage: createVerificationPackageAvailability({
            IsAvailable: false,
            Blocker: blocker,
            BlockerCode: blockerCode,
            Message: `Blocked by ${blockerCode}.`,
            PackageId: '',
            PackageHash: '',
          }),
          RestrictedPackage: createVerificationPackageAvailability({
            PackageView:
              ElectionVerificationPackageViewProto.VerificationPackageRestrictedOwnerAuditor,
            VerifierProfileId: 'restricted_owner_auditor_v1',
            IsAvailable: false,
            Blocker: blocker,
            BlockerCode: blockerCode,
            Message: `Blocked by ${blockerCode}.`,
            PackageId: '',
            PackageHash: '',
          }),
        })}
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `Download public package unavailable: Blocked by ${blockerCode}.`,
      })
    ).toBeDisabled();
    expect(screen.getAllByText(blockerCode).length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ProtocolPackageAccessLocationKindProto,
  ProtocolPackageApprovalStatusProto,
  ProtocolPackageBindingSourceProto,
  ProtocolPackageBindingStatusProto,
  ProtocolPackageExternalReviewStatusProto,
  type ElectionProtocolPackageBindingView,
} from '@/lib/grpc';
import {
  getProtocolPackageBindingPresentation,
  shortenProtocolPackageHash,
} from './contracts';

const timestamp = { seconds: 1_777_987_200, nanos: 0 };

function createBinding(
  overrides?: Partial<ElectionProtocolPackageBindingView>
): ElectionProtocolPackageBindingView {
  return {
    Id: 'binding-1',
    ElectionId: 'election-1',
    PackageId: 'omega-hushvoting-v1',
    PackageVersion: 'v1.0.0',
    SelectedProfileId: 'dkg-prod-3of5',
    SpecPackageHash: 'a'.repeat(64),
    ProofPackageHash: 'b'.repeat(64),
    ReleaseManifestHash: 'c'.repeat(64),
    SpecAccessLocations: [
      {
        LocationKind: ProtocolPackageAccessLocationKindProto.PublicWebsite,
        Label: 'Public package',
        Location: 'https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/spec.zip',
        ContentHash: 'a'.repeat(64),
      },
    ],
    ProofAccessLocations: [
      {
        LocationKind: ProtocolPackageAccessLocationKindProto.PublicWebsite,
        Label: 'Public package',
        Location: 'https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/proof.zip',
        ContentHash: 'b'.repeat(64),
      },
    ],
    PackageApprovalStatus: ProtocolPackageApprovalStatusProto.ApprovedInternal,
    Status: ProtocolPackageBindingStatusProto.Latest,
    Source: ProtocolPackageBindingSourceProto.CatalogSelection,
    DraftRevision: 2,
    BoundAt: timestamp,
    HasSealedAt: false,
    BoundByPublicAddress: 'owner-address',
    ExternalReviewStatus: ProtocolPackageExternalReviewStatusProto.NotReviewed,
    SourceTransactionId: '',
    SourceBlockHeight: 0,
    SourceBlockId: '',
    ...overrides,
  };
}

describe('protocol package presentation contracts', () => {
  it('shortens hashes for display while preserving short and missing values', () => {
    expect(shortenProtocolPackageHash('1234567890abcdefghijklmnopqrstuvwxyz')).toBe(
      '1234567890ab...stuvwxyz'
    );
    expect(shortenProtocolPackageHash('short-hash')).toBe('short-hash');
    expect(shortenProtocolPackageHash('')).toBe('Not recorded');
  });

  it('explains stale bindings as open-blocking without hiding full hashes', () => {
    const presentation = getProtocolPackageBindingPresentation(createBinding({
      Status: ProtocolPackageBindingStatusProto.Stale,
    }));

    expect(presentation.label).toBe('Stale package refs');
    expect(presentation.tone).toBe('warning');
    expect(presentation.openBlocked).toBe(true);
    expect(presentation.specHashShort).toBe('aaaaaaaaaaaa...aaaaaaaa');
    expect(presentation.specHashFull).toHaveLength(64);
    expect(presentation.approvalLabel).toBe('Approved internal');
    expect(presentation.externalReviewLabel).toBe('Not externally reviewed');
  });

  it.each([
    [ProtocolPackageBindingStatusProto.Latest, 'Latest approved', 'success', false],
    [ProtocolPackageBindingStatusProto.Stale, 'Stale package refs', 'warning', true],
    [ProtocolPackageBindingStatusProto.Incompatible, 'Incompatible package refs', 'error', true],
    [ProtocolPackageBindingStatusProto.Sealed, 'Sealed at open', 'neutral', false],
    [ProtocolPackageBindingStatusProto.ReferenceOnly, 'Reference only', 'warning', true],
  ] as const)(
    'provides stable copy for binding state %s',
    (status, expectedLabel, expectedTone, expectedOpenBlocked) => {
      const presentation = getProtocolPackageBindingPresentation(createBinding({ Status: status }));

      expect(presentation.status).toBe(status);
      expect(presentation.label).toBe(expectedLabel);
      expect(presentation.tone).toBe(expectedTone);
      expect(presentation.openBlocked).toBe(expectedOpenBlocked);
      expect(presentation.specHashFull).toHaveLength(64);
      expect(presentation.proofHashFull).toHaveLength(64);
      expect(presentation.releaseHashFull).toHaveLength(64);
    }
  );

  it.each([
    [ProtocolPackageExternalReviewStatusProto.NotReviewed, 'Not externally reviewed'],
    [ProtocolPackageExternalReviewStatusProto.ReviewRequested, 'External review requested'],
    [ProtocolPackageExternalReviewStatusProto.ReviewInProgress, 'External review in progress'],
    [ProtocolPackageExternalReviewStatusProto.ReviewedWithFindings, 'Reviewed with findings'],
    [ProtocolPackageExternalReviewStatusProto.ReviewedAccepted, 'External review accepted'],
  ] as const)('keeps external review status copy non-certifying for %s', (status, expectedLabel) => {
    const presentation = getProtocolPackageBindingPresentation(createBinding({
      ExternalReviewStatus: status,
    }));

    expect(presentation.externalReviewLabel).toBe(expectedLabel);
    expect(presentation.externalReviewLabel.toLowerCase()).not.toContain('certified');
  });

  it('keeps reference-only copy separate from sealed-at-open evidence', () => {
    const presentation = getProtocolPackageBindingPresentation(createBinding({
      Status: ProtocolPackageBindingStatusProto.ReferenceOnly,
      Source: ProtocolPackageBindingSourceProto.MigrationBackfill,
    }));

    expect(presentation.label).toBe('Reference only');
    expect(presentation.description).toContain('backfilled');
    expect(presentation.description).not.toContain('Sealed at open');
    expect(presentation.openBlocked).toBe(true);
  });

  it('uses readiness fallback status and server message when no binding is present', () => {
    const presentation = getProtocolPackageBindingPresentation(
      null,
      ProtocolPackageBindingStatusProto.Missing,
      'Latest approved Protocol Omega package refs are missing.'
    );

    expect(presentation.label).toBe('Missing package refs');
    expect(presentation.description).toContain('refs are missing');
    expect(presentation.version).toBe('Not selected');
  });
});

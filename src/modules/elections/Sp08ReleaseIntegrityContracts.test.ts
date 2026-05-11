import { describe, expect, it } from 'vitest';
import {
  ElectionVerificationArtifactVisibilityProto,
  type ElectionSp08ReleaseIntegrityStatusView,
} from '@/lib/grpc';
import {
  getSp08OpenReadinessPresentation,
  getSp08ReleaseIntegrityPresentation,
  getSp08VerificationPackagePresentation,
} from './contracts';

function createSp08ReleaseIntegrity(
  overrides?: Partial<ElectionSp08ReleaseIntegrityStatusView>
): ElectionSp08ReleaseIntegrityStatusView {
  return {
    EvidenceExpected: true,
    PublicEvidenceAvailable: true,
    RestrictedEvidenceAvailable: true,
    EvidenceMode: 'official_sp08',
    NotForReleaseIntegrityClaims: false,
    BlocksHighAssurance: false,
    ReleaseManifestName: 'HushVotingReleaseManifest-v1.json',
    ReleaseManifestHash: 'a'.repeat(64),
    ProtocolPackageManifestName: 'ProtocolOmegaReleaseManifest-v1.json',
    ProtocolPackageManifestHash: 'b'.repeat(64),
    PrimaryResultCode: 'release_integrity_evidence_valid',
    PrimaryIssue: '',
    ComponentCount: 2,
    LifecycleBindingCount: 1,
    EvidenceFileCount: 3,
    MobileEvidenceIncluded: true,
    Message: '',
    Components: [
      {
        ComponentId: 'server',
        ComponentType: 'container_image',
        EvidenceMode: 'official_sp08',
        ArtifactName: 'hush-server-node',
        ArtifactDigest: 'sha256:server',
        ImmutableReference: 'ghcr.io/hushnetwork/hush-server-node@sha256:server',
        BuildWorkflowRunId: '123',
        DistributionReference: 'ghcr.io/hushnetwork/hush-server-node@sha256:server',
        HasSigningFingerprint: false,
        IsPlaceholder: false,
      },
      {
        ComponentId: 'mobile_app',
        ComponentType: 'android_apk',
        EvidenceMode: 'official_sp08',
        ArtifactName: 'HushNetwork.apk',
        ArtifactDigest: 'sha256:mobile',
        ImmutableReference:
          'https://github.com/HushNetworkOrg/hush-web-client/actions/runs/123/artifacts/456',
        BuildWorkflowRunId: '123',
        DistributionReference:
          'https://github.com/HushNetworkOrg/hush-web-client/actions/runs/123/artifacts/456',
        HasSigningFingerprint: true,
        IsPlaceholder: false,
      },
    ],
    LifecycleBindings: [
      {
        LifecycleStage: 'open',
        ExpectedReleaseId: 'release-1',
        ObservedReleaseId: 'release-1',
        ExpectedArtifactDigest: 'sha256:server',
        ObservedArtifactDigest: 'sha256:server',
        MatchesSealedPolicy: true,
      },
    ],
    EvidenceFiles: [
      {
        RelativePath: 'artifacts/election-record/release-manifest.json',
        Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
        IsPresent: true,
        ContentHash: 'sha256:manifest',
      },
    ],
    ...overrides,
  };
}

describe('SP-08 release-integrity presentation contracts', () => {
  it('maps valid official release evidence to success without certification copy', () => {
    const presentation = getSp08ReleaseIntegrityPresentation(
      createSp08ReleaseIntegrity(),
      'auditor'
    );

    expect(presentation).toMatchObject({
      state: 'official',
      label: 'Official SP-08 evidence',
      tone: 'success',
      showTechnicalRefs: true,
      publicEvidenceAvailable: true,
      restrictedEvidenceAvailable: true,
      blocksHighAssurance: false,
      mobileEvidenceIncluded: true,
      releaseManifestHashShort: 'aaaaaaaaaaaa...aaaaaaaa',
      protocolPackageManifestHashShort: 'bbbbbbbbbbbb...bbbbbbbb',
      blockingCodes: [],
    });
    expect(presentation?.description.toLowerCase()).not.toContain('certified');
  });

  it('keeps development placeholder evidence visibly separate from official evidence', () => {
    const presentation = getSp08ReleaseIntegrityPresentation(
      createSp08ReleaseIntegrity({
        EvidenceMode: 'development_placeholder',
        NotForReleaseIntegrityClaims: true,
        BlocksHighAssurance: true,
        PrimaryResultCode: 'release_integrity_evidence_pending',
        Message:
          'Development placeholder SP-08 release-integrity evidence is present and is not official release evidence.',
        Components: [
          {
            ComponentId: 'server',
            ComponentType: 'container_image',
            EvidenceMode: 'development_placeholder',
            ArtifactName: 'placeholder',
            ArtifactDigest: 'sha256:placeholder',
            ImmutableReference: 'development-placeholder',
            BuildWorkflowRunId: '',
            DistributionReference: '',
            HasSigningFingerprint: false,
            IsPlaceholder: true,
          },
        ],
        ComponentCount: 1,
        MobileEvidenceIncluded: false,
      })
    );

    expect(presentation).toMatchObject({
      state: 'placeholder',
      label: 'Development placeholder',
      tone: 'error',
      blocksHighAssurance: true,
      primaryResultCode: 'release_integrity_evidence_pending',
      mobileEvidenceIncluded: false,
      blockingCodes: ['release_integrity_evidence_pending'],
    });
    expect(presentation?.description).toContain('not official release evidence');
  });

  it('maps open-readiness SP-08 blockers to high-assurance blocking copy', () => {
    const presentation = getSp08OpenReadinessPresentation({
      Sp08ReleaseIntegrity: createSp08ReleaseIntegrity({
        PublicEvidenceAvailable: false,
        RestrictedEvidenceAvailable: false,
        EvidenceMode: 'development_placeholder',
        NotForReleaseIntegrityClaims: true,
        BlocksHighAssurance: true,
        ReleaseManifestHash: '',
        PrimaryResultCode: 'release_integrity_evidence_mode_not_allowed',
        PrimaryIssue:
          'Official SP-08 release evidence is required before high-assurance elections can open.',
        Message: 'SP-08 release-integrity evidence blocks high-assurance election open.',
        ComponentCount: 6,
        LifecycleBindingCount: 0,
        EvidenceFileCount: 0,
        MobileEvidenceIncluded: false,
        Components: [],
        LifecycleBindings: [],
        EvidenceFiles: [],
      }),
    });

    expect(presentation).toMatchObject({
      state: 'placeholder',
      label: 'Development placeholder',
      tone: 'error',
      blocksHighAssurance: true,
      primaryResultCode: 'release_integrity_evidence_mode_not_allowed',
      blockingCodes: ['release_integrity_evidence_mode_not_allowed'],
    });
  });

  it('surfaces lifecycle mismatches as release-integrity blockers', () => {
    const presentation = getSp08ReleaseIntegrityPresentation(
      createSp08ReleaseIntegrity({
        BlocksHighAssurance: true,
        PrimaryResultCode: 'release_integrity_lifecycle_mismatch',
        PrimaryIssue:
          'One or more SP-08 lifecycle release bindings do not match the sealed policy.',
        LifecycleBindings: [
          {
            LifecycleStage: 'close',
            ExpectedReleaseId: 'release-1',
            ObservedReleaseId: 'release-2',
            ExpectedArtifactDigest: 'sha256:expected',
            ObservedArtifactDigest: 'sha256:observed',
            MatchesSealedPolicy: false,
          },
        ],
      }),
      'trustee'
    );

    expect(presentation).toMatchObject({
      state: 'blocked',
      tone: 'error',
      lifecycleMismatchCount: 1,
      blockingCodes: ['release_integrity_lifecycle_mismatch'],
    });
  });

  it('does not expose voter-facing SP-08 release-integrity refs in v1', () => {
    const presentation = getSp08VerificationPackagePresentation({
      IsVisible: true,
      Sp08ReleaseIntegrity: createSp08ReleaseIntegrity(),
    }, 'voter');

    expect(presentation).toBeNull();
  });
});

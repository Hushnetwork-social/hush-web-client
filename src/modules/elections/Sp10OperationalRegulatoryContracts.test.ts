import { describe, expect, it } from 'vitest';
import {
  ElectionVerificationArtifactVisibilityProto,
  type ElectionSp10OperationalSecurityStatusView,
  type ElectionSp11RegulatoryClaimStatusView,
} from '@/lib/grpc';
import {
  getSp10OperationalSecurityPresentation,
  getSp10VerificationPackagePresentation,
  getSp11RegulatoryClaimPresentation,
  getSp11VerificationPackagePresentation,
} from './contracts';

function createSp10OperationalSecurity(
  overrides?: Partial<ElectionSp10OperationalSecurityStatusView>
): ElectionSp10OperationalSecurityStatusView {
  return {
    EvidenceExpected: true,
    PublicEvidenceAvailable: true,
    RestrictedEvidenceAvailable: true,
    ProgramVersion: 'SP10-P1',
    DeploymentProfileId: 'hushvoting_managed_aws_container_v1',
    EvidenceState: 'managed_profile_evidence_available',
    DoesNotCompleteFeat106Readiness: true,
    Feat106ReadinessCaveat:
      'Managed deployment profile evidence is available for the declared scope; this is not legal approval or certification.',
    ReleaseEvidenceMode: 'official_sp08',
    ReleaseManifestHash: 'a'.repeat(64),
    ImmutableDeploymentRef: 'ghcr.io/hushnetwork/hush-server-node@sha256:server',
    CustodyMode: 'aws_kms_per_election_envelope_v1',
    ExecutorKeyLifecycle: 'executor_ephemeral_memory_key_v1',
    AccessSnapshotHashOrRestrictedRef: 'sha256:access-snapshot',
    BackupRestoreHashOrRestrictedRef: 'sha256:backup-restore',
    IncidentStatus: 'no_incident_declared',
    AuditorRoomAccessLogHashOrRestrictedRef: 'sha256:auditor-room',
    BlocksHighAssurance: false,
    PrimaryResultCode: 'operational_security_evidence_valid',
    PrimaryIssue: '',
    PublicEvidenceFileCount: 4,
    RestrictedEvidenceFileCount: 5,
    Message:
      'Managed deployment profile evidence is available for the declared scope; this is not legal approval or certification.',
    EvidenceFiles: [
      {
        RelativePath: 'artifacts/election-record/operational-security-summary.json',
        Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
        IsPresent: true,
        ContentHash: 'sha256:summary',
      },
    ],
    ...overrides,
  };
}

function createSp11RegulatoryClaim(
  overrides?: Partial<ElectionSp11RegulatoryClaimStatusView>
): ElectionSp11RegulatoryClaimStatusView {
  return {
    EvidenceExpected: true,
    PublicEvidenceAvailable: true,
    RestrictedEvidenceAvailable: false,
    ClaimExported: true,
    TrackerVersion: 'SP11-P1',
    JurisdictionId: 'CH',
    ClaimId: 'organizational_remote_voting_market_intelligence',
    ClaimState: 'allowed_with_limitation',
    HasSourceCheckedAt: true,
    HasNextReviewAt: true,
    SourceRef: 'https://www.bk.admin.ch/bk/en/home/politische-rechte/e-voting.html',
    Owner: 'protocol-omega-regulatory-tracker',
    IsLegalAdvice: false,
    RequiresAuthorityEvidence: false,
    AuthorityEvidenceRef: '',
    RestrictedWorkpaperRef: '',
    AllowedWording:
      'Regulatory tracker allows this claim only with the listed limitations; this is not legal advice.',
    IsStale: false,
    BlocksClaims: false,
    PrimaryResultCode: 'regulatory_claim_allowed_by_register',
    PrimaryIssue: '',
    PublicEvidenceFileCount: 1,
    RestrictedEvidenceFileCount: 0,
    Message:
      'Regulatory tracker allows this claim only with the listed limitations; this is not legal advice.',
    EvidenceFiles: [
      {
        RelativePath: 'artifacts/election-record/regulatory-claim-state.json',
        Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
        IsPresent: true,
        ContentHash: 'sha256:regulatory-claim-state',
      },
    ],
    ...overrides,
  };
}

describe('SP-10 operational-security presentation contracts', () => {
  it('maps complete managed-profile evidence to a success state', () => {
    const presentation = getSp10OperationalSecurityPresentation(
      createSp10OperationalSecurity(),
      'auditor'
    );

    expect(presentation).toMatchObject({
      state: 'managed_profile_evidence_available',
      label: 'Managed profile evidence available',
      tone: 'success',
      publicEvidenceAvailable: true,
      restrictedEvidenceAvailable: true,
      blocksHighAssurance: false,
      evidenceFileCount: 9,
      blockingCodes: [],
    });
    expect(presentation?.description.toLowerCase()).not.toContain('certified');
  });

  it.each([
    ['development_placeholder', 'development_placeholder', 'error'],
    ['managed_profile_declared', 'managed_profile_declared', 'warning'],
    ['managed_profile_exception_declared', 'managed_profile_exception_declared', 'warning'],
    ['blocked', 'blocked', 'error'],
  ] as const)('maps %s operational state to explicit UI state', (evidenceState, state, tone) => {
    const presentation = getSp10OperationalSecurityPresentation(
      createSp10OperationalSecurity({
        EvidenceState: evidenceState,
        BlocksHighAssurance: true,
        PrimaryResultCode: 'operational_security_blocked',
      })
    );

    expect(presentation?.state).toBe(state);
    expect(presentation?.tone).toBe(tone);
    expect(presentation?.blockingCodes).toContain('operational_security_blocked');
  });

  it('does not expose voter-facing SP-10 operational details', () => {
    const presentation = getSp10VerificationPackagePresentation({
      IsVisible: true,
      Sp10OperationalSecurity: createSp10OperationalSecurity(),
    }, 'voter');

    expect(presentation).toBeNull();
  });
});

describe('SP-11 regulatory-claim presentation contracts', () => {
  it('maps allowed-with-limitation tracker claims without approval wording', () => {
    const presentation = getSp11RegulatoryClaimPresentation(
      createSp11RegulatoryClaim(),
      'owner-admin'
    );

    expect(presentation).toMatchObject({
      state: 'allowed_with_limitation',
      label: 'Claim allowed with limitation',
      tone: 'success',
      claimExported: true,
      publicEvidenceAvailable: true,
      restrictedEvidenceAvailable: false,
      blockingCodes: [],
    });
    expect(presentation?.description.toLowerCase()).not.toContain('approved for public elections');
  });

  it('maps blocked and stale tracker states to warning or error states', () => {
    const stale = getSp11RegulatoryClaimPresentation(
      createSp11RegulatoryClaim({
        IsStale: true,
        BlocksClaims: true,
        PrimaryResultCode: 'regulatory_tracker_stale',
      })
    );
    const blockedCertification = getSp11RegulatoryClaimPresentation(
      createSp11RegulatoryClaim({
        ClaimState: 'blocked_until_certification',
        BlocksClaims: true,
        PrimaryResultCode: 'regulatory_claim_blocked_certification',
      })
    );
    const forbidden = getSp11RegulatoryClaimPresentation(
      createSp11RegulatoryClaim({
        ClaimState: 'forbidden',
        BlocksClaims: true,
        PrimaryResultCode: 'regulatory_claim_not_legal_approval',
      })
    );

    expect(stale).toMatchObject({
      state: 'stale_tracker',
      tone: 'warning',
      blockingCodes: ['regulatory_tracker_stale'],
    });
    expect(blockedCertification).toMatchObject({
      state: 'blocked_until_certification',
      tone: 'error',
      blockingCodes: ['regulatory_claim_blocked_certification'],
    });
    expect(forbidden).toMatchObject({
      state: 'forbidden',
      tone: 'error',
      blockingCodes: ['regulatory_claim_not_legal_approval'],
    });
  });

  it('does not expose voter-facing SP-11 regulatory details', () => {
    const presentation = getSp11VerificationPackagePresentation({
      IsVisible: true,
      Sp11RegulatoryClaim: createSp11RegulatoryClaim(),
    }, 'voter');

    expect(presentation).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionClosedProgressStatusProto,
  ElectionVerificationArtifactVisibilityProto,
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
    expect(screen.queryByTestId('verification-package-sp08-evidence')).not.toBeInTheDocument();
  });

  it('renders SP-07 publication-proof evidence and verifier result code', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus({
          Sp07Evidence: {
            EvidenceExpected: true,
            PublicEvidenceAvailable: true,
            RestrictedEvidenceAvailable: true,
            PublicationProofMode: 'zk_rerandomization_shuffle_v1',
            ProofConstruction: 'bayer_groth_reencryption_shuffle_argument_v1',
            StatementId: 'sp07-bayer-groth-hush-vector-shuffle-v1',
            ExternalReviewStatus: 'external_crypto_review_pending',
            AcceptedBallotCount: 18,
            PublishedBallotCount: 18,
            CiphertextSlotCount: 4,
            ChunkCount: 1,
            AcceptedBallotSetHash: '1'.repeat(64),
            PublishedBallotStreamHash: '2'.repeat(64),
            TranscriptHash: '3'.repeat(64),
            ProofHash: '4'.repeat(64),
            WitnessDeletionReceiptHash: '5'.repeat(64),
            LatestPubResultCode: 'PUB-001',
            ProgressStatus:
              ElectionClosedProgressStatusProto.ClosedProgressPublicationProofVerified,
            CanRetry: false,
            Blockers: [],
            Message: 'SP-07 publication-proof evidence is available for verification package export.',
            CompletedChunkCount: 1,
            FailedChunkCount: 0,
            SlowestChunkMilliseconds: 120,
          },
        })}
      />
    );

    expect(screen.getByTestId('verification-package-sp07-evidence')).toHaveTextContent(
      'SP-07 publication proof'
    );
    expect(screen.getByTestId('verification-package-sp07-evidence')).toHaveTextContent('PUB-001');
    expect(screen.getByTestId('verification-package-sp07-evidence')).toHaveTextContent(
      'external_crypto_review_pending'
    );
  });

  it('renders SP-08 official release-integrity evidence and detail rows', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus()}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp08-evidence');
    expect(evidence).toHaveTextContent('SP-08 release integrity');
    expect(evidence).toHaveTextContent('Official SP-08 evidence');
    expect(evidence).toHaveTextContent('release_integrity_evidence_valid');
    expect(evidence).toHaveTextContent('HushVotingReleaseManifest-v1.json');
    expect(evidence).toHaveTextContent('bbbbbbbbbbbb...bbbbbbbb');
    expect(evidence).toHaveTextContent('Mobile evidence');
    expect(evidence).toHaveTextContent('Included');

    fireEvent.click(screen.getByText('Show release evidence details'));

    expect(screen.getByTestId('verification-package-sp08-components')).toHaveTextContent(
      'mobile_app'
    );
    expect(screen.getByTestId('verification-package-sp08-lifecycle')).toHaveTextContent('Matched');
    expect(screen.getByTestId('verification-package-sp08-files')).toHaveTextContent(
      'release-integrity-verifier-output.json'
    );
  });

  it('renders SP-09 planned external review without certification wording', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus()}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp09-external-review');
    expect(evidence).toHaveTextContent('SP-09 external review');
    expect(evidence).toHaveTextContent('Review planned');
    expect(evidence).toHaveTextContent('external_review_not_complete');
    expect(evidence).toHaveTextContent('program_defined');
    expect(evidence).toHaveTextContent('protocol_pro..._path_v1');
    expect(evidence.textContent?.toLowerCase()).not.toContain('certified');
    expect(evidence.textContent?.toLowerCase()).not.toContain('externally audited');

    fireEvent.click(screen.getByText('Show external review evidence details'));

    expect(screen.getByTestId('verification-package-sp09-files')).toHaveTextContent(
      'external-review-status.json'
    );
    expect(screen.getByTestId('verification-package-sp09-reviewed-artifacts')).toHaveTextContent(
      'No reviewer-scoped artifact hashes are available yet.'
    );
  });

  it('renders SP-10 operational security evidence with OPS result details', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus()}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp10-operational-security');
    expect(evidence).toHaveTextContent('SP-10 operational security');
    expect(evidence).toHaveTextContent('Development placeholder');
    expect(evidence).toHaveTextContent('operational_security_development_placeholder');
    expect(evidence).toHaveTextContent('hushvoting_managed_aws_container_v1');
    expect(evidence).toHaveTextContent('FEAT-106 readiness remains separate.');
    expect(evidence.textContent?.toLowerCase()).not.toContain('certified');

    fireEvent.click(screen.getByText('Show operational evidence details'));

    expect(screen.getByTestId('verification-package-sp10-files')).toHaveTextContent(
      'operational-security-summary.json'
    );
    expect(screen.getByTestId('verification-package-sp10-files')).toHaveTextContent(
      'operational-access-control-snapshot.json'
    );
  });

  it('renders SP-11 regulatory claim only when a claim is exported', () => {
    const baseStatus = createVerificationPackageStatus();
    const statusWithClaim = createVerificationPackageStatus({
      Sp11RegulatoryClaim: {
        ...baseStatus.Sp11RegulatoryClaim!,
        EvidenceExpected: true,
        PublicEvidenceAvailable: true,
        RestrictedEvidenceAvailable: true,
        ClaimExported: true,
        TrackerVersion: 'SP11-P1',
        JurisdictionId: 'CH',
        ClaimId: 'organizational_remote_voting_market_intelligence',
        ClaimState: 'allowed_with_limitation',
        SourceRef: 'https://www.bk.admin.ch/bk/en/home/politische-rechte/e-voting.html',
        Owner: 'protocol-omega-regulatory-tracker',
        AllowedWording:
          'Regulatory tracker allows this claim only with the listed limitations; this is not legal advice.',
        PrimaryResultCode: 'regulatory_claim_allowed_by_register',
        PublicEvidenceFileCount: 1,
        RestrictedEvidenceFileCount: 1,
        Message:
          'Regulatory tracker allows this claim only with the listed limitations; this is not legal advice.',
        EvidenceFiles: [
          {
            RelativePath: 'artifacts/election-record/regulatory-claim-state.json',
            Visibility:
              ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
            IsPresent: true,
            ContentHash: 'sha256:regulatory-claim-state',
          },
          {
            RelativePath: 'artifacts/restricted/regulatory-jurisdiction-workpaper.json',
            Visibility:
              ElectionVerificationArtifactVisibilityProto.VerificationArtifactRestricted,
            IsPresent: true,
            ContentHash: 'sha256:regulatory-jurisdiction-workpaper',
          },
        ],
      },
    });

    const { rerender } = render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={baseStatus}
      />
    );

    expect(screen.queryByTestId('verification-package-sp11-regulatory-claim')).not.toBeInTheDocument();

    rerender(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={statusWithClaim}
      />
    );

    const claim = screen.getByTestId('verification-package-sp11-regulatory-claim');
    expect(claim).toHaveTextContent('SP-11 regulatory tracker');
    expect(claim).toHaveTextContent('Claim allowed with limitation');
    expect(claim).toHaveTextContent('regulatory_claim_allowed_by_register');
    expect(claim.textContent?.toLowerCase()).not.toContain('approved for public elections');

    fireEvent.click(screen.getByText('Show regulatory evidence details'));

    expect(screen.getByTestId('verification-package-sp11-files')).toHaveTextContent(
      'regulatory-claim-state.json'
    );
    expect(screen.getByTestId('verification-package-sp11-files')).toHaveTextContent(
      'regulatory-jurisdiction-workpaper.json'
    );
  });

  it('renders SP-09 available external review with scoped artifacts and limitations copy', () => {
    const baseStatus = createVerificationPackageStatus();

    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus({
          Sp09ExternalReview: {
            ...baseStatus.Sp09ExternalReview!,
            DetailedStatus: 'reviewed_with_limitations',
            Availability: 'available',
            ClaimState: 'reviewed_with_limitations',
            PrimaryResultCode: 'external_review_status_valid',
            PrimaryIssue: '',
            ReviewedArtifactCount: 3,
            ReviewedArtifacts: [
              {
                ArtifactId: 'protocol-release-manifest',
                ArtifactType: 'protocol_release_manifest',
                ArtifactName: 'Protocol release manifest',
                ArtifactHash: 'sha256:release',
                ArtifactVersion: 'v1.1.10',
                ReviewScope: 'protocol_proof_verifier_publication_path_v1',
              },
            ],
            Message: '',
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp09-external-review');
    expect(evidence).toHaveTextContent('Review available');
    expect(evidence).toHaveTextContent('Reviewed for declared scope and version, with limitations documented.');
    expect(evidence).toHaveTextContent('3');

    fireEvent.click(screen.getByText('Show external review evidence details'));

    expect(screen.getByTestId('verification-package-sp09-reviewed-artifacts')).toHaveTextContent(
      'Protocol release manifest'
    );
  });

  it.each([
    [
      'reviewed_with_open_findings',
      'available',
      'reviewed_with_open_findings',
      'external_review_open_findings_block_claims',
      'Review has open findings',
    ],
    [
      'reviewed_for_declared_scope',
      'not_available',
      'not_applicable_to_this_artifact_set',
      'external_review_scope_mismatch',
      'Review scope mismatch',
    ],
    [
      'reviewed_for_declared_scope',
      'available',
      'reviewed_for_declared_scope',
      'external_review_claim_not_allowed',
      'Review claim blocked',
    ],
    [
      'reviewed_for_declared_scope',
      'available',
      'reviewed_for_declared_scope',
      'external_review_public_boundary_violation',
      'Review claim blocked',
    ],
    [
      'requires_redesign',
      'not_available',
      'blocked_requires_redesign',
      'external_review_requires_redesign',
      'Review requires redesign',
    ],
  ])(
    'renders SP-09 blocking state %s/%s/%s as %s',
    (detailedStatus, availability, claimState, resultCode, expectedLabel) => {
      const baseStatus = createVerificationPackageStatus();

      render(
        <VerificationPackageStatusSection
          electionId="election-1"
          actorPublicAddress="owner-address"
          status={createVerificationPackageStatus({
            Sp09ExternalReview: {
              ...baseStatus.Sp09ExternalReview!,
              DetailedStatus: detailedStatus,
              Availability: availability,
              ClaimState: claimState,
              PrimaryResultCode: resultCode,
              PrimaryIssue: `${resultCode} requires operator attention.`,
              OpenHighFindingCount:
                resultCode === 'external_review_open_findings_block_claims' ? 1 : 0,
              OpenFindingCount:
                resultCode === 'external_review_open_findings_block_claims' ? 1 : 0,
              BlocksReviewedClaims: true,
              RequiresRedesign: resultCode === 'external_review_requires_redesign',
              Message: '',
            },
          })}
        />
      );

      const evidence = screen.getByTestId('verification-package-sp09-external-review');
      expect(evidence).toHaveTextContent(expectedLabel);
      expect(evidence).toHaveTextContent(resultCode);
      expect(evidence).toHaveTextContent(`${resultCode} requires operator attention.`);
      expect(evidence.textContent?.toLowerCase()).not.toContain('certified');
    }
  );

  it('renders SP-08 development placeholders as high-assurance blocking evidence', () => {
    const baseStatus = createVerificationPackageStatus();

    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="owner-address"
        status={createVerificationPackageStatus({
          Sp08ReleaseIntegrity: {
            ...baseStatus.Sp08ReleaseIntegrity!,
            EvidenceMode: 'development_placeholder',
            NotForReleaseIntegrityClaims: true,
            BlocksHighAssurance: true,
            PrimaryResultCode: 'release_integrity_evidence_pending',
            Message:
              'Development placeholder SP-08 release-integrity evidence is present and is not official release evidence.',
            ComponentCount: 1,
            MobileEvidenceIncluded: false,
            Components: [
              {
                ...baseStatus.Sp08ReleaseIntegrity!.Components[0],
                EvidenceMode: 'development_placeholder',
                IsPlaceholder: true,
                ImmutableReference: 'development-placeholder',
              },
            ],
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp08-evidence');
    expect(evidence).toHaveTextContent('Development placeholder');
    expect(evidence).toHaveTextContent('Not for release-integrity claims');
    expect(evidence).toHaveTextContent('Blocks high-assurance claims');
    expect(evidence).toHaveTextContent('release_integrity_evidence_pending');
    expect(evidence).toHaveTextContent('Not included');
    expect(evidence.textContent?.toLowerCase()).not.toContain('certified');
  });

  it('renders missing SP-08 release evidence as an explicit package issue', () => {
    const baseStatus = createVerificationPackageStatus();

    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="owner-address"
        status={createVerificationPackageStatus({
          Sp08ReleaseIntegrity: {
            ...baseStatus.Sp08ReleaseIntegrity!,
            PublicEvidenceAvailable: false,
            RestrictedEvidenceAvailable: false,
            EvidenceFileCount: 0,
            ReleaseManifestHash: '',
            PrimaryResultCode: 'release_integrity_manifest_missing',
            PrimaryIssue: 'SP-08 release manifest is missing from the public package.',
            Message: 'SP-08 release-integrity evidence is not exportable yet.',
            Components: [],
            ComponentCount: 0,
            LifecycleBindings: [],
            LifecycleBindingCount: 0,
            MobileEvidenceIncluded: false,
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp08-evidence');
    expect(evidence).toHaveTextContent('Release evidence missing');
    expect(evidence).toHaveTextContent('release_integrity_manifest_missing');
    expect(evidence).toHaveTextContent('SP-08 release-integrity evidence is not exportable yet.');
    expect(evidence).toHaveTextContent('Not recorded');
  });

  it.each([
    [
      'release_integrity_mutable_artifact_reference',
      'Mutable or local artifact references cannot satisfy SP-08 release-integrity evidence.',
    ],
    [
      'release_integrity_mobile_evidence_incomplete',
      'Mobile release evidence is incomplete for a release set that includes a mobile app.',
    ],
  ])('renders SP-08 blocked result %s with explicit issue text', (resultCode, issue) => {
    const baseStatus = createVerificationPackageStatus();

    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus({
          Sp08ReleaseIntegrity: {
            ...baseStatus.Sp08ReleaseIntegrity!,
            BlocksHighAssurance: true,
            PrimaryResultCode: resultCode,
            PrimaryIssue: issue,
            Message: '',
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp08-evidence');
    expect(evidence).toHaveTextContent('Release integrity blocked');
    expect(evidence).toHaveTextContent(resultCode);
    expect(evidence).toHaveTextContent(issue);
  });

  it('renders SP-08 lifecycle mismatches with expected and observed releases', () => {
    const baseStatus = createVerificationPackageStatus();

    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus({
          Sp08ReleaseIntegrity: {
            ...baseStatus.Sp08ReleaseIntegrity!,
            BlocksHighAssurance: true,
            PrimaryResultCode: 'release_integrity_lifecycle_mismatch',
            PrimaryIssue:
              'One or more SP-08 lifecycle release bindings do not match the sealed policy.',
            Message: '',
            LifecycleBindings: [
              {
                LifecycleStage: 'proof_worker',
                ExpectedReleaseId: 'release-2026.05.11',
                ObservedReleaseId: 'release-2026.05.12',
                ExpectedArtifactDigest: 'sha256:expected',
                ObservedArtifactDigest: 'sha256:observed',
                MatchesSealedPolicy: false,
              },
            ],
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp08-evidence');
    expect(evidence).toHaveTextContent('1 mismatch');
    expect(evidence).toHaveTextContent('release_integrity_lifecycle_mismatch');

    fireEvent.click(screen.getByText('Show release evidence details'));

    expect(screen.getByTestId('verification-package-sp08-lifecycle')).toHaveTextContent(
      'proof_worker'
    );
    expect(screen.getByTestId('verification-package-sp08-lifecycle')).toHaveTextContent(
      'Mismatch'
    );
    expect(screen.getByTestId('verification-package-sp08-lifecycle')).toHaveTextContent(
      'release-2026.05.12'
    );
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

  it('shows SP-04 evidence counts inside the existing package section', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="actor-address"
        status={createVerificationPackageStatus({
          Sp04Evidence: {
            EvidenceExpected: true,
            PublicEvidenceAvailable: true,
            RestrictedEvidenceAvailable: true,
            PreparedPackageCount: 184,
            SpoiledPackageCount: 92,
            AcceptedBoundReceiptCount: 92,
            ReceiptCommitmentSetHash: 'a'.repeat(64),
            Message: 'SP-04 evidence present in public and restricted package views.',
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp04-evidence');
    expect(evidence).toHaveTextContent('SP-04 evidence');
    expect(evidence).toHaveTextContent('SP-04 evidence present');
    expect(evidence).toHaveTextContent('184');
    expect(evidence).toHaveTextContent('92');
    expect(screen.getByRole('button', { name: 'Download restricted package' })).toBeEnabled();
  });

  it('shows SP-05 eligibility evidence and ELI result inside the existing package section', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus({
          Sp05Evidence: {
            EvidenceExpected: true,
            PublicEvidenceAvailable: true,
            RestrictedEvidenceAvailable: true,
            RosteredCount: 120,
            LinkedCount: 118,
            ActiveDenominatorCount: 119,
            CommitmentCount: 90,
            CountedParticipationCount: 88,
            DuplicateContactWarningCount: 2,
            RosterCanonicalHash: 'b'.repeat(64),
            CommitmentTreeRoot: 'c'.repeat(64),
            LatestEliResultCode: 'eligibility_dev_only_verification_blocked',
            Message: 'SP-05 verifier warning: provider is dev-only.',
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp05-evidence');
    expect(evidence).toHaveTextContent('SP-05 eligibility/checkoff');
    expect(evidence).toHaveTextContent('SP-05 verifier warning');
    expect(evidence).toHaveTextContent('eligibility_dev_only_verification_blocked');
    expect(evidence).toHaveTextContent('120');
    expect(evidence).toHaveTextContent('90');
  });

  it('shows SP-06 trustee control evidence and CTRL result inside the existing package section', () => {
    render(
      <VerificationPackageStatusSection
        electionId="election-1"
        actorPublicAddress="auditor-address"
        status={createVerificationPackageStatus({
          Sp06Evidence: {
            EvidenceExpected: true,
            PublicEvidenceAvailable: true,
            RestrictedEvidenceAvailable: true,
            ControlDomainProfileId: 'high_assurance_independent_trustees_v1',
            ControlDomainProfileVersion: 'v1',
            ThresholdProfileId: 'dkg-prod-3of5',
            TrusteeCount: 5,
            TrusteeThreshold: 3,
            AcceptedBeforeOpenCount: 5,
            CompleteEvidenceCount: 5,
            MissingEvidenceCount: 0,
            StaleEvidenceCount: 0,
            IncompatibleEvidenceCount: 0,
            AcceptedReleaseArtifactCount: 4,
            MissingReleaseArtifactCount: 1,
            RejectedReleaseArtifactCount: 0,
            LatestCtrlResultCode: 'CTRL-001',
            Blockers: [],
            Message: 'SP-06 trustee evidence is complete and exportable.',
          },
        })}
      />
    );

    const evidence = screen.getByTestId('verification-package-sp06-evidence');
    expect(evidence).toHaveTextContent('SP-06 trustee control');
    expect(evidence).toHaveTextContent('SP-06 trustee evidence is complete');
    expect(evidence).toHaveTextContent('CTRL-001');
    expect(evidence).toHaveTextContent('high_assurance_independent_trustees_v1 v1');
    expect(evidence).toHaveTextContent('3 of 5');
    expect(evidence).toHaveTextContent('4 accepted');
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

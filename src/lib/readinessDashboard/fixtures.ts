import type { ReadinessDashboardSource } from './contracts';

export const READINESS_DASHBOARD_BASELINE_PUBLIC_SAFE_SUMMARY = `# HushVoting Public-Safe Readiness Summary

| Field | Value |
| --- | --- |
| Register Version | RDY-REG-v0.1.3 |
| Generated At | 2026-05-25T15:45:00Z |
| Publication Status | not_for_publication |

## Current Public-Safe Status

not_for_publication

## Approved Public-Safe Claim Wording

HushVoting is being prepared for internal non-binding rehearsal use only. Pilot, production, and public election readiness claims remain unavailable until the remaining readiness blockers are resolved and accepted.

## Known Limitations

- Internal rehearsal use must be labelled non-binding.
- Pilot readiness remains blocked until the minimum confidence band and remaining pilot-critical evidence gates are satisfied.
- Production and public/state election readiness are not claimed in this version.

## Non-Claims

- This summary is not certification, legal approval, public election authorization, or independent validation.
- This summary does not publish private readiness scoring or restricted evidence.
`;

export function createReadinessDashboardFixtureSource(
  overrides: Partial<ReadinessDashboardSource> = {}
): ReadinessDashboardSource {
  const source: ReadinessDashboardSource = {
    catalog: {
      catalogVersion: '1.0',
      registerId: 'hushvoting-readiness-register',
      currentRegisterVersionId: 'RDY-REG-v0.1.3',
      currentRegisterVersion: 'v0.1.3',
      currentManifestHash:
        'e0a62370459c875602820e728fd6bb0dd006d302b8855d077a8205033677b055',
      currentArchiveHash:
        'a8a4eb01c496620c598ea3c97c92033098c43ecb6245797382625f26d2dc2ae0',
      entries: [
        {
          registerVersion: 'v0.1.2',
          registerVersionId: 'RDY-REG-v0.1.2',
          status: 'AcceptedInternal',
          generatedAt: '2026-05-21T17:15:00.0000000Z',
          totalScore: 59,
          strongestAllowedClaim: 'internal_non_binding_rehearsal',
          strongestAllowedV1PolicyCeiling: 'friendly_organization_pilot',
          publicationStatus: 'not_for_publication',
          manifestHash:
            'f4ccafc0fce0c4cfe4cbcf3f067b4390f5e69c2f69bd5d93b05db431f7c04960',
          archiveHash:
            '5c33242c77e7082d02eb9a61622165547289a52b5a21a11d99cf9d3ccf19218e',
          versionPath: 'v0.1.2',
        },
        {
          registerVersion: 'v0.1.3',
          registerVersionId: 'RDY-REG-v0.1.3',
          status: 'AcceptedInternal',
          generatedAt: '2026-05-25T15:45:00.0000000Z',
          totalScore: 60,
          strongestAllowedClaim: 'internal_non_binding_rehearsal',
          strongestAllowedV1PolicyCeiling: 'friendly_organization_pilot',
          publicationStatus: 'not_for_publication',
          manifestHash:
            'e0a62370459c875602820e728fd6bb0dd006d302b8855d077a8205033677b055',
          archiveHash:
            'a8a4eb01c496620c598ea3c97c92033098c43ecb6245797382625f26d2dc2ae0',
          versionPath: 'v0.1.3',
        },
      ],
    },
    manifest: {
      manifestVersion: '1.0',
      registerId: 'hushvoting-readiness-register',
      registerVersion: 'v0.1.3',
      registerVersionId: 'RDY-REG-v0.1.3',
      status: 'AcceptedInternal',
      generatedAt: '2026-05-25T15:45:00.0000000Z',
      sourceCommit: '4311e06',
      totalScore: 60,
      strongestAllowedClaim: 'internal_non_binding_rehearsal',
      strongestAllowedV1PolicyCeiling: 'friendly_organization_pilot',
      publicationStatus: 'not_for_publication',
      manifestHash:
        'e0a62370459c875602820e728fd6bb0dd006d302b8855d077a8205033677b055',
    },
    register: {
      schemaVersion: '1.0',
      registerId: 'hushvoting-readiness-register',
      registerVersion: 'v0.1.3',
      registerVersionId: 'RDY-REG-v0.1.3',
      status: 'AcceptedInternal',
      promotedAt: '2026-05-25T15:45:00Z',
      sourceCommit: '4311e06',
      claimPolicy: {
        minimumConfidenceScore: 70,
        strongerTargetScore: 80,
        strongestAllowedV1Claim: 'friendly_organization_pilot',
      },
      score: {
        total: 60,
        minimumConfidenceScore: 70,
        strongerTargetScore: 80,
      },
      dimensions: [
        {
          dimensionId: 'RDY-DIM-001',
          name: 'Protocol/spec/proof package',
          weight: 10,
          currentScore: 8,
          targetScoreBeforeReviewPilot: 8,
          sourceGapRows: ['Protocol/evidence architecture'],
          acceptanceGateIds: ['AT-RDY-001'],
          evidenceIds: ['RDY-EVID-AT-RDY-001-FEAT-130-001'],
          blockerIds: [],
          residualRisk: 'Package refs can become stale after future implementation changes.',
          scoreRationale: 'Protocol Omega package and readiness register baseline exist.',
        },
        {
          dimensionId: 'RDY-DIM-003',
          name: 'Cross-device receipt/inclusion verification',
          weight: 10,
          currentScore: 3,
          targetScoreBeforeReviewPilot: 7,
          sourceGapRows: ['Cross-device receipt/inclusion verification'],
          acceptanceGateIds: ['AT-RDY-008'],
          evidenceIds: ['RDY-EVID-AT-RDY-008-FEAT-136-001'],
          blockerIds: ['RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-003'],
          residualRisk: 'Cross-device verification is not accepted yet.',
          scoreRationale: 'FEAT-136 must be promoted before pilot claims can open.',
        },
        {
          dimensionId: 'RDY-DIM-005',
          name: 'Per-election KMS custody lifecycle',
          weight: 10,
          currentScore: 8,
          targetScoreBeforeReviewPilot: 8,
          sourceGapRows: ['Per-election KMS custody lifecycle'],
          acceptanceGateIds: ['AT-RDY-002', 'AT-RDY-003', 'AT-RDY-004'],
          evidenceIds: ['RDY-EVID-AT-RDY-002-FEAT-131-001'],
          blockerIds: [],
          residualRisk: 'Provider incidents and IAM drift still require operating history.',
          scoreRationale: 'FEAT-131 delivered accepted internal custody evidence.',
        },
        {
          dimensionId: 'RDY-DIM-008',
          name: 'Retention/log privacy proof',
          weight: 10,
          currentScore: 8,
          targetScoreBeforeReviewPilot: 8,
          sourceGapRows: ['Retention/log privacy proof'],
          acceptanceGateIds: ['AT-RDY-009', 'AT-RDY-010'],
          evidenceIds: ['RDY-EVID-AT-RDY-009-FEAT-137-001'],
          blockerIds: [],
          residualRisk: 'Future diagnostics can reintroduce correlation risk.',
          scoreRationale: 'FEAT-137 accepted evidence proves the reviewed boundary.',
        },
      ],
      claimLevels: [
        {
          claimLevel: 'internal_development',
          blockerSeverity: 'green',
          status: 'allowed',
          allowedWording:
            'HushVoting may use this register for internal development tracking and implementation planning.',
          limitationWording: '',
          blockedWording: '',
          blockerIds: [],
          publicSafeStatus: 'not_for_publication',
        },
        {
          claimLevel: 'internal_non_binding_rehearsal',
          blockerSeverity: 'amber',
          status: 'allowed_with_limitations',
          allowedWording:
            'HushVoting may use internal technical rehearsal evidence when product-mode profile limitations and stronger claim boundaries remain visible.',
          limitationWording:
            'Internal rehearsal evidence is not a customer, production, public/state, legal, certification, or independent-validation claim; runtime binding status is represented by the HushVoting claim profile gates.',
          blockedWording: '',
          blockerIds: ['RDY-BLOCK-INTERNAL_NON_BINDING_REHEARSAL-001'],
          publicSafeStatus: 'not_for_publication',
        },
        {
          claimLevel: 'friendly_organization_pilot',
          blockerSeverity: 'red',
          status: 'blocked',
          allowedWording: '',
          limitationWording: '',
          blockedWording:
            'Friendly organization pilot readiness is blocked until the score reaches the minimum confidence band and red blockers are resolved.',
          blockerIds: [
            'RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-002',
            'RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-003',
            'RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-006',
          ],
          publicSafeStatus: 'not_ready_for_public_claim',
        },
      ],
      claimProfiles: [
        {
          profileId: 'hushvoting.direct.binding',
          label: 'Binding HushVoting! Direct',
          productMode: 'HushVoting! Direct',
          governanceEffect: 'binding',
          bindingStatus: 'Binding',
          isNonBindingElection: false,
          thresholdProfile: 'direct',
          profileClass: 'standard',
          gateSeverity: 'amber',
          gateStatus: 'with_warnings',
          claimLevel: 'internal_non_binding_rehearsal',
          claimWording:
            'Product mode HushVoting! Direct, binding status Binding, and isNonBindingElection false are accepted for the internal technical claim profile gate with verifier warnings attached.',
          limitationWording:
            'The pass is limited to runtime/profile evidence and does not promote customer, production, public/state, legal, certification, or independent-validation claims.',
          evidenceRefs: ['audit-boundary-note.md', 'public-verifier-output-current-public/VerifierOutput.json'],
          requiredEvidence: [
            'productMode == HushVoting! Direct',
            'bindingStatus == Binding',
            'isNonBindingElection == false',
          ],
          verifierWarningCount: 2,
          verifierWarnings: [
            {
              checkCode: 'OPS-002',
              resultCode: 'operational_security_access_snapshot_missing',
              message: 'SP-10 access-control snapshot evidence is missing.',
              evidenceRef: 'public-verifier-output-current-public/VerifierOutput.json',
            },
            {
              checkCode: 'OPS-006',
              resultCode: 'operational_security_backup_restore_missing',
              message: 'SP-10 backup/restore evidence is missing.',
              evidenceRef: 'public-verifier-output-current-public/VerifierOutput.json',
            },
          ],
        },
      ],
      blockers: [
        {
          blockerId: 'RDY-BLOCK-INTERNAL_NON_BINDING_REHEARSAL-001',
          claimLevel: 'internal_non_binding_rehearsal',
          severity: 'amber',
          status: 'open',
          description:
            'Rehearsal is non-binding only and must display remaining pilot red blockers as limitations.',
          featureId: 'FEAT-130',
          acceptanceGateIds: ['AT-RDY-001'],
          dimensionIds: ['RDY-DIM-001'],
          limitationWording:
            'Internal rehearsal is allowed only as a non-binding run with all pilot blockers visible.',
          resolutionCriteria:
            'Promoted register keeps non-binding wording and visible blocker list in all generated internal outputs.',
        },
        {
          blockerId: 'RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-001',
          claimLevel: 'friendly_organization_pilot',
          severity: 'green',
          status: 'resolved',
          description: 'Per-election KMS custody lifecycle accepted.',
          featureId: 'FEAT-131',
          acceptanceGateIds: ['AT-RDY-002', 'AT-RDY-003', 'AT-RDY-004'],
          dimensionIds: ['RDY-DIM-005'],
          limitationWording: '',
          resolutionCriteria: 'Resolved by FEAT-131 accepted readiness fragment.',
        },
        {
          blockerId: 'RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-003',
          claimLevel: 'friendly_organization_pilot',
          severity: 'red',
          status: 'open',
          description: 'Cross-device receipt/inclusion verification not delivered.',
          featureId: 'FEAT-136',
          acceptanceGateIds: ['AT-RDY-008'],
          dimensionIds: ['RDY-DIM-003'],
          limitationWording: '',
          resolutionCriteria:
            'FEAT-136 delivers accepted cross-device receipt/inclusion verification evidence.',
        },
      ],
      evidenceItems: [
        {
          evidenceId: 'RDY-EVID-AT-RDY-001-FEAT-130-001',
          featureId: 'FEAT-130',
          sourceGapRow: 'Protocol/evidence architecture',
          status: 'accepted',
          acceptanceGateIds: ['AT-RDY-001'],
          dimensionIds: ['RDY-DIM-001'],
          producedAt: '2026-05-18T22:00:00Z',
          artifactRefs: [
            {
              artifactId: 'ART-RDY-GAP-20260518',
              relativePath:
                'hush-documents/PrivateServer_ElectronicVoting/HushVoting-Technical-Delivery-Gap-Assessment-2026-05-18.md',
              sha256Hash: '2de7e099895023fe4d4ef481fa4ff77c84bda6c2be2150e4bed297479f5257e0',
              hashAlgorithm: 'SHA-256',
              mediaType: 'text/markdown',
              sizeBytes: 36244,
              visibility: 'restricted_reviewer',
            },
          ],
          checkResults: [
            {
              checkId: 'CHK-RDY-001-GAP-REGISTER',
              status: 'pass',
              summary: 'Gap register maps source gaps to EPIC-015 and FEAT-130 through FEAT-142.',
              detailsRef:
                'hush-memory-bank/Features/00_EPICS/EPIC-015-hushvoting-technical-delivery-readiness/EpicDescription.md',
            },
          ],
          freshness: {
            state: 'current',
            invalidationRule: 'Event-based invalidation when score policy changes.',
            staleReason: '',
          },
          claimEffect: 'none',
        },
        {
          evidenceId: 'RDY-EVID-AT-RDY-002-FEAT-131-001',
          featureId: 'FEAT-131',
          status: 'accepted',
          acceptanceGateIds: ['AT-RDY-002', 'AT-RDY-003', 'AT-RDY-004'],
          dimensionIds: ['RDY-DIM-005'],
          freshness: {
            state: 'current',
            invalidationRule: 'Event-based invalidation when custody mode changes.',
            staleReason: '',
          },
          claimEffect: 'score_increase',
        },
        {
          evidenceId: 'RDY-EVID-AT-RDY-008-FEAT-136-001',
          featureId: 'FEAT-136',
          status: 'observed',
          acceptanceGateIds: ['AT-RDY-008'],
          dimensionIds: ['RDY-DIM-003'],
          freshness: {
            state: 'current',
            invalidationRule: 'Event-based invalidation when receipt semantics change.',
            staleReason: '',
          },
          claimEffect: 'block',
        },
      ],
      exceptions: [],
      generatedViews: {
        publicSafePublicationStatus: 'not_for_publication',
        publicSafeSummaryPath: 'public-safe-summary.md',
      },
    },
    publicSafeSummary: READINESS_DASHBOARD_BASELINE_PUBLIC_SAFE_SUMMARY,
  };

  return {
    ...source,
    ...overrides,
  };
}

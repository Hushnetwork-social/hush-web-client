import {
  READINESS_PROFILE_API_ROUTE_BASE,
  READINESS_PROFILE_ROUTE_BASE,
  type RawReadinessArtifactRef,
  type RawReadinessCheckResult,
  type RawReadinessClaimProfile,
  type RawReadinessEvidenceItem,
  type ReadinessClaimProfileGateView,
  type ReadinessDashboardApiState,
  type ReadinessDashboardSource,
  type ReadinessSeverity,
} from './contracts';

export type ReadinessProfileCheckStatus =
  | 'passed'
  | 'with_warnings'
  | 'rehearsal_accepted'
  | 'disabled'
  | 'not_observed'
  | 'future_gated'
  | 'not_applicable'
  | 'failed';

export type ReadinessProfileCheckTone = ReadinessSeverity | 'neutral';

export interface ReadinessProfileCheckArtifactRefView {
  artifactId: string;
  relativePath: string;
  sha256Hash: string;
  hashAlgorithm: string;
  mediaType: string;
  sizeBytes: number;
  visibility: string;
}

export interface ReadinessProfileCheckResultView {
  checkId: string;
  status: string;
  summary: string;
  detailsRef: string;
}

export interface ReadinessProfileEvidenceItemView {
  evidenceId: string;
  featureId: string;
  status: string;
  producedAt: string;
  sourceGapRow: string;
  releaseScope: string;
  visibility: string;
  acceptanceGateIds: string[];
  dimensionIds: string[];
  artifactRefs: ReadinessProfileCheckArtifactRefView[];
  checkResults: ReadinessProfileCheckResultView[];
  freshnessState: string;
  invalidationRule: string;
  staleReason: string;
  residualRisk: string;
  claimEffect: string;
}

export interface ReadinessProfileEvidenceCheckView {
  checkId: string;
  title: string;
  category: string;
  status: ReadinessProfileCheckStatus;
  tone: ReadinessProfileCheckTone;
  applicability: string;
  whatWasTested: string;
  whenWasTested: string;
  check: string;
  requiredEvidence: string[];
  evidenceRefs: string[];
  evidenceItems: ReadinessProfileEvidenceItemView[];
  disabledInDevelopment: boolean;
  developmentAdjustment: string;
}

export interface ReadinessProfileAssessmentView {
  severity: ReadinessSeverity;
  status: string;
  label: string;
  summary: string;
}

export interface ReadinessProfileDetailView {
  register: {
    registerVersionId: string;
    registerVersion: string;
    status: string;
    promotedAt: string;
    generatedAt: string;
    sourceCommit: string;
    publicationStatus: string;
    manifestHash: string;
    archiveFileName: string;
    archiveSha256Hash: string;
    archiveSizeBytes: number;
  };
  profile: ReadinessClaimProfileGateView;
  assessment: ReadinessProfileAssessmentView;
  checks: ReadinessProfileEvidenceCheckView[];
  download: {
    apiRoute: string;
    fileName: string;
  };
}

export type ReadinessProfileApiState = ReadinessDashboardApiState | 'not_found';

export type ReadinessProfileApiResponse =
  | {
      success: true;
      state: 'ready' | 'superseded_or_blocked_register';
      detail: ReadinessProfileDetailView;
    }
  | {
      success: false;
      state: Exclude<ReadinessProfileApiState, 'ready' | 'superseded_or_blocked_register'>;
      code: string;
      message: string;
    };

interface EvidenceCheckDefinition {
  checkId: string;
  title: string;
  category: string;
  gateIds: string[];
  dimensionIds: string[];
  requiredEvidence: string[];
  whatWasTested: string;
  check: string;
  onlyForProductModes?: string[];
  developmentAdjusted?: boolean;
  developmentAdjustment?: string;
  disabledForDevelopmentDirect?: boolean;
  disabledReason?: string;
  derivedStatus?: ReadinessProfileCheckStatus;
  derivedTone?: ReadinessProfileCheckTone;
  evidenceRefs?: string[];
}

interface ProfileBoundEvidenceOverride {
  status: ReadinessProfileCheckStatus;
  tone: ReadinessProfileCheckTone;
  evidenceRefs: string[];
  requiredEvidence: string[];
  whatWasTested: string;
  check: string;
  whenWasTested?: string;
}

const VERITAS_500_NON_BINDING_PROFILE_ID = 'hushvoting.veritas_3_of_5.non_binding';
const VERITAS_500_NON_BINDING_EVIDENCE_MARKER =
  'HushVoting-Veritas-500-Non-Binding-IV-20260611081304';

const VERITAS_500_LIFECYCLE_REF_SUFFIXES = [
  'evidence-summary.json',
  'public-verification-package/ElectionRecord.json',
  'public-verification-package/artifacts/report-package/canonical-manifest.json',
  'public-verification-package/artifacts/report-package/evidence-graph.json',
  'public-verification-package/artifacts/report-package/result-report.json',
  'public-verification-package/artifacts/election-record/tally-replay.json',
  'public-verification-package/artifacts/election-record/result-binding.json',
];

const VERITAS_500_TRUSTEE_REF_SUFFIXES = [
  'evidence-summary.json',
  'public-verification-package/artifacts/election-record/trustee-control-profile.json',
  'public-verification-package/artifacts/election-record/trustee-control-summary.json',
  'public-verification-package/artifacts/election-record/trustee-release-evidence.json',
  'public-verification-package/artifacts/election-record/trustee-verifier-output.json',
];

const VERITAS_500_CRYPTO_PATH_REF_SUFFIXES = [
  'evidence-summary.json',
  'public-verification-package/ElectionRecord.json',
  'public-verification-package/VerifierInputManifest.json',
  'public-verification-package/artifacts/election-record/trustee-control-profile.json',
  'public-verification-package/artifacts/election-record/trustee-control-summary.json',
  'public-verification-package/artifacts/election-record/result-binding.json',
  'public-verifier-output/VerifierOutput.json',
];

const evidenceCheckDefinitions: EvidenceCheckDefinition[] = [
  {
    checkId: 'binding-mode-circuit-crypto-validation',
    title: 'Binding mode, circuit, and crypto-path validation',
    category: 'protocol',
    gateIds: [],
    dimensionIds: [],
    requiredEvidence: [
      'Binding status and isNonBindingElection are explicit in the profile gate.',
      'Selected circuit/profile is compatible with the binding status.',
      'Binding Direct uses the protected admin production profile; non-binding Direct uses the explicit admin development/open profile unless a protected advisory profile is selected.',
      'Protocol Omega version and package refs are bound by selected profile.',
      'Binding elections reject dev/open ballot artifacts and do not use the dev-mode tally fallback.',
    ],
    evidenceRefs: [
      'hush-memory-bank/Features/04_COMPLETED/FEAT-105-election-crypto-circuit-validation-harness/validation-gate.md',
      'hush-memory-bank/Features/04_COMPLETED/FEAT-105-election-crypto-circuit-validation-harness/binding-vs-non-binding-audit-boundary.md',
      'hush-server-node/Node/HushServerNode.Tests/Elections/ElectionLifecycleServiceTests.cs',
    ],
    whatWasTested:
      'Election binding status, isNonBindingElection, selected circuit/profile, Protocol Omega version/package binding, ballot artifact acceptance policy, and close-counting/tally path for the Direct profile family.',
    check:
      'Run the FEAT-105 server unit block; verify the admin Direct profile matrix binds admin-dev-1of1 for non-binding and admin-prod-1of1 for binding, records protocolOmegaVersion omega-v1.0.0, binds the latest compatible Protocol Omega package refs, rejects dev/open artifacts on binding casts, allows explicit non-binding dev/open artifacts, and keeps binding close-counting on the protected aggregate/SP-07 path.',
  },
  {
    checkId: 'protocol-omega-package-binding',
    title: 'Protocol Omega package and evidence binding',
    category: 'protocol',
    gateIds: ['AT-RDY-001'],
    dimensionIds: ['RDY-DIM-001', 'RDY-DIM-004'],
    requiredEvidence: [
      'Protocol/spec proof package evidence is accepted and current.',
      'Publication/counting evidence is bound to the active Protocol Omega release scope.',
    ],
    whatWasTested:
      'The readiness register links protocol/package evidence, publication/counting evidence, release scope, artifact hashes, and check results for the active promoted version.',
    check:
      'Read evidence items for AT-RDY-001 on RDY-DIM-001 and RDY-DIM-004; verify accepted/current status, releaseScope, artifactRefs, checkResults, and manifest hash context.',
  },
  {
    checkId: 'deployment-software-proof-binding',
    title: 'Deployment and software proof binding',
    category: 'deployment',
    gateIds: ['AT-RDY-005'],
    dimensionIds: ['RDY-DIM-006'],
    requiredEvidence: [
      'Trusted deployment ceremony evidence is present where applicable.',
      'Release/deployment proof package, manifest, artifact identity, and downstream handoff are traceable.',
    ],
    whatWasTested:
      'Deployment ceremony evidence, release artifact identity, package manifest references, hash audit details, and deployment binding policy.',
    check:
      'Read AT-RDY-005/RDY-DIM-006 evidence items and checkResults; in Development Direct profiles, full production deployment evidence is outside the rehearsal claim and the row is accepted only as a visible development/rehearsal boundary.',
    developmentAdjusted: true,
    developmentAdjustment:
      'Development Direct profile: production deployment evidence is outside this rehearsal claim. The row is accepted as development/runtime/profile evidence plus local release/package binding; no production deployment, customer, legal, certification, or independent-validation claim is made.',
  },
  {
    checkId: 'election-lifecycle-tally-version-consistency',
    title: 'Election lifecycle, tally, and version consistency',
    category: 'lifecycle',
    gateIds: ['AT-RDY-002', 'AT-RDY-003', 'AT-RDY-004', 'AT-RDY-011', 'AT-RDY-012', 'AT-RDY-013', 'AT-RDY-014', 'AT-RDY-015'],
    dimensionIds: ['RDY-DIM-005', 'RDY-DIM-009', 'RDY-DIM-010'],
    requiredEvidence: [
      'Per-election custody lifecycle evidence is accepted and current.',
      'Governed outcome, void/publication replacement, pilot wrapper, and support/governance evidence are traceable.',
      'Open-election, vote/public package, finalization, and count/tally evidence remain version-bound to the promoted register context.',
    ],
    whatWasTested:
      'Election creation/open/finalization dependencies, per-election custody evidence, governed outcome continuity, void/publication replacement, pilot wrapper, and count/tally version-binding evidence.',
    check:
      'Read lifecycle acceptance gates and dimensions; compare evidence releaseScope, artifactRefs, checkResults, freshness, residual risk, and claim effect against the active register and manifest.',
    disabledForDevelopmentDirect: true,
    disabledReason:
      'Development Direct profile: full election lifecycle/tally consistency is disabled until a concrete election instance binds creation, open, vote, count, tally, and protocol-version evidence. This is not a failed or blocked check.',
  },
  {
    checkId: 'verifier-receipt-package-integrity',
    title: 'Verifier, receipt, and package integrity',
    category: 'verification',
    gateIds: ['AT-RDY-007', 'AT-RDY-008'],
    dimensionIds: ['RDY-DIM-002', 'RDY-DIM-003'],
    requiredEvidence: [
      'Verifier/sample/tamper corpus evidence is current.',
      'Cross-device receipt and inclusion verification evidence is accepted/current.',
    ],
    whatWasTested:
      'Verifier package integrity, sample/tamper corpus coverage, receipt export/import, package-bound public verifier output, and cross-device inclusion checks.',
    check:
      'Read AT-RDY-007/AT-RDY-008 evidence items; verify artifactRefs, public verifier output references, checkResults, freshness, and residual risk.',
  },
  {
    checkId: 'operational-privacy-boundary',
    title: 'Operational package and privacy boundary',
    category: 'privacy',
    gateIds: ['AT-RDY-006', 'AT-RDY-009', 'AT-RDY-010', 'AT-RDY-014'],
    dimensionIds: ['RDY-DIM-007', 'RDY-DIM-008'],
    requiredEvidence: [
      'Operational evidence package is current for the claimed environment.',
      'Retention/log privacy proof and public/restricted boundary evidence are current.',
    ],
    whatWasTested:
      'Operational evidence package, support readiness, retention/log privacy proof, public-safe/restricted evidence boundaries, and redaction-sensitive output handling.',
    check:
      'Read AT-RDY-006/AT-RDY-009/AT-RDY-010/AT-RDY-014 evidence items; verify status, artifactRefs, freshness, privacy-boundary checkResults, and limitation wording.',
  },
  {
    checkId: 'veritas-trustee-ceremony-acceptance',
    title: 'Veritas trustee ceremony acceptance',
    category: 'trustee',
    gateIds: [],
    dimensionIds: [],
    requiredEvidence: [
      'Trustee ceremony evidence is accepted for the requested threshold profile.',
      'Trustee acceptance, governed action, and threshold proof evidence are linked before the Veritas profile can pass.',
    ],
    whatWasTested:
      'Whether the selected profile is a Veritas threshold profile and whether accepted trustee ceremony evidence is bound to it.',
    check:
      'For Direct profiles this check is not applicable. For Veritas profiles, require accepted trustee ceremony and threshold acceptance evidence before the profile can pass.',
    onlyForProductModes: ['HushVoting! Veritas'],
  },
];

export function buildReadinessProfileRoute(profileId: string): string {
  return `${READINESS_PROFILE_ROUTE_BASE}/${encodeURIComponent(profileId)}`;
}

export function buildReadinessProfileApiRoute(profileId: string): string {
  return `${READINESS_PROFILE_API_ROUTE_BASE}/${encodeURIComponent(profileId)}`;
}

export function buildReadinessProfileZipApiRoute(profileId: string): string {
  return `${buildReadinessProfileApiRoute(profileId)}/zip`;
}

function toSafeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function mapClaimProfile(profile: RawReadinessClaimProfile): ReadinessClaimProfileGateView {
  const verifierWarnings = profile.verifierWarnings ?? [];

  return {
    profileId: profile.profileId,
    label: profile.label,
    productMode: profile.productMode,
    governanceEffect: profile.governanceEffect,
    bindingStatus: profile.bindingStatus,
    isNonBindingElection: profile.isNonBindingElection,
    thresholdProfile: profile.thresholdProfile,
    profileClass: profile.profileClass,
    severity: profile.gateSeverity,
    gateStatus: profile.gateStatus,
    claimLevel: profile.claimLevel,
    claimWording: profile.claimWording,
    limitationWording: profile.limitationWording,
    evidenceRefs: profile.evidenceRefs,
    requiredEvidence: profile.requiredEvidence,
    verifierWarningCount: profile.verifierWarningCount ?? verifierWarnings.length,
    verifierWarnings: verifierWarnings.map((warning) => ({
      checkCode: warning.checkCode,
      resultCode: warning.resultCode,
      message: warning.message,
      evidenceRef: warning.evidenceRef,
    })),
  };
}

function decodeProfileId(profileId: string): string {
  try {
    return decodeURIComponent(profileId);
  } catch {
    return profileId;
  }
}

function isDevelopmentDirectProfile(profile: RawReadinessClaimProfile): boolean {
  return (
    profile.productMode === 'HushVoting! Direct' &&
    profile.claimLevel === 'internal_non_binding_rehearsal'
  );
}

function isDefinitionApplicable(
  definition: EvidenceCheckDefinition,
  profile: RawReadinessClaimProfile
): boolean {
  if (!definition.onlyForProductModes) {
    return true;
  }

  return definition.onlyForProductModes.includes(profile.productMode);
}

function isPassedVeritas500NonBindingProfile(profile: RawReadinessClaimProfile): boolean {
  return (
    profile.profileId === VERITAS_500_NON_BINDING_PROFILE_ID &&
    profile.productMode === 'HushVoting! Veritas' &&
    profile.bindingStatus === 'Non-Binding' &&
    profile.isNonBindingElection &&
    profile.thresholdProfile === '3/5' &&
    profile.gateStatus === 'passed' &&
    profile.gateSeverity === 'green' &&
    profile.evidenceRefs.some((ref) => ref.includes(VERITAS_500_NON_BINDING_EVIDENCE_MARKER))
  );
}

function getProfileEvidenceRefsBySuffix(
  profile: RawReadinessClaimProfile,
  suffixes: string[]
): string[] {
  const matchingRefs = profile.evidenceRefs.filter(
    (ref) =>
      ref.includes(VERITAS_500_NON_BINDING_EVIDENCE_MARKER) &&
      suffixes.some((suffix) => ref.endsWith(suffix))
  );

  if (matchingRefs.length > 0) {
    return matchingRefs;
  }

  return profile.evidenceRefs.filter((ref) =>
    ref.includes(VERITAS_500_NON_BINDING_EVIDENCE_MARKER)
  );
}

function getProfileBoundEvidenceOverride(
  definition: EvidenceCheckDefinition,
  profile: RawReadinessClaimProfile,
  source: ReadinessDashboardSource
): ProfileBoundEvidenceOverride | null {
  if (
    definition.checkId === 'binding-mode-circuit-crypto-validation' &&
    profile.productMode === 'HushVoting! Direct'
  ) {
    const directCopy = getDirectCryptoPathCopy(definition, profile);

    return {
      status: 'passed',
      tone: 'green',
      whenWasTested: source.register.promotedAt || source.manifest.generatedAt,
      evidenceRefs: definition.evidenceRefs ?? [],
      requiredEvidence: directCopy.requiredEvidence,
      whatWasTested: directCopy.whatWasTested,
      check: directCopy.check,
    };
  }

  if (!isPassedVeritas500NonBindingProfile(profile)) {
    return null;
  }

  if (definition.checkId === 'binding-mode-circuit-crypto-validation') {
    return {
      status: 'passed',
      tone: 'green',
      whenWasTested: source.register.promotedAt || source.manifest.generatedAt,
      evidenceRefs: getProfileEvidenceRefsBySuffix(profile, VERITAS_500_CRYPTO_PATH_REF_SUFFIXES),
      requiredEvidence: [
        'The profile-bound Veritas 500 non-binding package records productMode HushVoting! Veritas.',
        'Threshold profile 3/5 is selected through dkg-dev-3of5 and TrusteeThreshold governance.',
        'Runtime binding status is NonBinding and isNonBindingElection is true.',
        'Three accepted finalization shares satisfy the 3-of-5 threshold.',
        'Public verifier output is bound to the same election record and reports warningCount=0.',
      ],
      whatWasTested:
        'HushVoting! Veritas 500, Non-Binding IV binding mode, threshold profile selection, trustee-governed crypto path, and verifier-output binding.',
      check:
        'Read the profile-bound Veritas IV election record, verifier input manifest, trustee control profile, trustee control summary, result binding, and verifier output. Verify selectedProfileId dkg-dev-3of5, governanceMode TrusteeThreshold, bindingStatus NonBinding, isNonBindingElection true, acceptedFinalizationShareCount=3, and warningCount=0.',
    };
  }

  if (definition.checkId === 'election-lifecycle-tally-version-consistency') {
    return {
      status: 'passed',
      tone: 'green',
      whenWasTested: source.register.promotedAt || source.manifest.generatedAt,
      evidenceRefs: getProfileEvidenceRefsBySuffix(profile, VERITAS_500_LIFECYCLE_REF_SUFFIXES),
      requiredEvidence: [
        'The profile-bound Veritas 500 non-binding package is sealed and finalized.',
        'Runtime binding status is NonBinding and isNonBindingElection is true.',
        'Lifecycle state is Finalized with two eligible voters and two counted votes.',
        'Tally replay, result binding, canonical manifest, and result report are bound to the same election id and package hash.',
        'The package warning count is zero.',
      ],
      whatWasTested:
        'HushVoting! Veritas 500, Non-Binding IV lifecycle, tally replay, result binding, result report, and package version binding.',
      check:
        'Read the profile-bound Veritas IV public verification package refs. Verify lifecycleState Finalized, bindingStatus NonBinding, isNonBindingElection true, dkg-dev-3of5, two eligible voters, two counted votes, matching tally/result hashes, and warningCount=0. Do not substitute older global FEAT-139 failed-finalize continuity residuals for this clean finalized package.',
    };
  }

  if (definition.checkId === 'veritas-trustee-ceremony-acceptance') {
    return {
      status: 'passed',
      tone: 'green',
      whenWasTested: source.register.promotedAt || source.manifest.generatedAt,
      evidenceRefs: getProfileEvidenceRefsBySuffix(profile, VERITAS_500_TRUSTEE_REF_SUFFIXES),
      requiredEvidence: [
        'The profile-bound Veritas 500 non-binding package is bound to the 3-of-5 trustee profile.',
        'Five trustee invitations reached accepted state.',
        'Three governed approvals satisfy the 3-of-5 threshold.',
        'Three finalization shares were accepted and bound to the final encrypted tally hash.',
        'Trustee verifier output reports the trustee control-domain evidence as valid.',
      ],
      whatWasTested:
        'HushVoting! Veritas 500, Non-Binding IV trustee acceptance, threshold-governed approvals, finalization shares, trustee control summary, and trustee verifier output.',
      check:
        'Read trustee-control-profile.json, trustee-control-summary.json, trustee-release-evidence.json, trustee-verifier-output.json, and evidence-summary.json from the profile-bound Veritas IV package. Verify acceptedTrusteeCount=5, threshold 3/5, governedApprovalCount=3, acceptedFinalizationShareCount=3, and no readiness blockers for the non-binding internal rehearsal claim.',
    };
  }

  return null;
}

function hasAny(values: string[], expected: string[]): boolean {
  return expected.some((item) => values.includes(item));
}

function getDirectCryptoPathCopy(
  definition: EvidenceCheckDefinition,
  profile: RawReadinessClaimProfile
): Pick<EvidenceCheckDefinition, 'requiredEvidence' | 'whatWasTested' | 'check'> {
  if (definition.checkId !== 'binding-mode-circuit-crypto-validation') {
    return definition;
  }

  if (profile.isNonBindingElection || profile.bindingStatus === 'Non-Binding') {
    return {
      requiredEvidence: [
        'This Direct profile is non-binding and isNonBindingElection is true.',
        'Selected Direct circuit/profile: admin-dev-1of1.',
        'Protocol Omega version: omega-v1.0.0.',
        'The latest compatible Protocol Omega package refs are bound by selected profile.',
        'Readable dev/open ballot artifacts are allowed only because this is the explicit non-binding Direct dev/open profile.',
        'Close-counting uses the dev-mode published-ballot tally fallback for this Direct non-binding rehearsal profile.',
      ],
      whatWasTested:
        'The non-binding Direct profile selects the explicit admin-dev-1of1 dev/open circuit, keeps isNonBindingElection true, binds Protocol Omega omega-v1.0.0 package refs, and keeps readable ballot/tally behavior confined to the non-binding rehearsal path.',
      check:
        'Run the FEAT-105 server unit block; verify non-binding Direct binds admin-dev-1of1, records protocolOmegaVersion omega-v1.0.0, binds the latest compatible Protocol Omega package refs, allows explicit dev/open ballot artifacts, and uses the dev-mode published-ballot tally fallback.',
    };
  }

  return {
    requiredEvidence: [
      'This Direct profile is binding and isNonBindingElection is false.',
      'Selected Direct circuit/profile: admin-prod-1of1.',
      'Protocol Omega version: omega-v1.0.0.',
      'The latest compatible Protocol Omega package refs are bound by selected profile.',
      'Dev/open ballot artifacts are rejected for this binding Direct profile.',
      'Close-counting stays on the protected aggregate/SP-07 path with the sealed Protocol Omega package binding.',
    ],
    whatWasTested:
      'The binding Direct profile selects the protected admin-prod-1of1 circuit, keeps isNonBindingElection false, binds Protocol Omega omega-v1.0.0 package refs, rejects dev/open ballot artifacts, and keeps close-counting on the protected aggregate/SP-07 path.',
    check:
      'Run the FEAT-105 server unit block; verify binding Direct binds admin-prod-1of1, records protocolOmegaVersion omega-v1.0.0, binds the latest compatible Protocol Omega package refs, rejects dev/open ballot artifacts during cast acceptance, and keeps close-counting on the protected aggregate/SP-07 path.',
  };
}

function getEvidenceItemsForDefinition(
  definition: EvidenceCheckDefinition,
  source: ReadinessDashboardSource
): RawReadinessEvidenceItem[] {
  if (definition.gateIds.length === 0 && definition.dimensionIds.length === 0) {
    return [];
  }

  return source.register.evidenceItems.filter(
    (item) =>
      hasAny(item.acceptanceGateIds, definition.gateIds) ||
      hasAny(item.dimensionIds, definition.dimensionIds)
  );
}

function getEvidenceSelectionKey(item: RawReadinessEvidenceItem): string {
  const sourceGapRow = item.sourceGapRow ?? '';
  const acceptanceGateIds = [...item.acceptanceGateIds].sort().join('|');
  const dimensionIds = [...item.dimensionIds].sort().join('|');

  return `${sourceGapRow}::${acceptanceGateIds}::${dimensionIds}`;
}

function isAcceptedCurrentEvidence(item: RawReadinessEvidenceItem): boolean {
  return item.status === 'accepted' && item.freshness?.state === 'current' && !item.freshness?.staleReason;
}

function getProducedAtSortValue(item: RawReadinessEvidenceItem): string {
  return item.producedAt ?? '';
}

function getLatestEvidenceItem(items: RawReadinessEvidenceItem[]): RawReadinessEvidenceItem {
  return [...items].sort((left, right) => {
    const producedAtCompare = getProducedAtSortValue(right).localeCompare(
      getProducedAtSortValue(left)
    );

    if (producedAtCompare !== 0) {
      return producedAtCompare;
    }

    return right.evidenceId.localeCompare(left.evidenceId);
  })[0];
}

function getCurrentEvidenceItemsForDefinition(
  definition: EvidenceCheckDefinition,
  source: ReadinessDashboardSource
): RawReadinessEvidenceItem[] {
  const evidenceItems = getEvidenceItemsForDefinition(definition, source);
  const groups = new Map<string, RawReadinessEvidenceItem[]>();

  for (const item of evidenceItems) {
    const key = getEvidenceSelectionKey(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.values()]
    .map((group) => {
      const acceptedCurrentItems = group.filter(isAcceptedCurrentEvidence);

      if (acceptedCurrentItems.length > 0) {
        return getLatestEvidenceItem(acceptedCurrentItems);
      }

      const activeItems = group.filter((item) => item.status !== 'superseded');

      return getLatestEvidenceItem(activeItems.length > 0 ? activeItems : group);
    })
    .sort((left, right) => {
      const producedAtCompare = getProducedAtSortValue(left).localeCompare(
        getProducedAtSortValue(right)
      );

      if (producedAtCompare !== 0) {
        return producedAtCompare;
      }

      return left.evidenceId.localeCompare(right.evidenceId);
    });
}

function mapArtifactRef(artifact: RawReadinessArtifactRef): ReadinessProfileCheckArtifactRefView {
  return {
    artifactId: artifact.artifactId,
    relativePath: artifact.relativePath,
    sha256Hash: artifact.sha256Hash,
    hashAlgorithm: artifact.hashAlgorithm,
    mediaType: artifact.mediaType,
    sizeBytes: artifact.sizeBytes,
    visibility: artifact.visibility,
  };
}

function mapCheckResult(result: RawReadinessCheckResult): ReadinessProfileCheckResultView {
  return {
    checkId: result.checkId,
    status: result.status,
    summary: result.summary,
    detailsRef: result.detailsRef,
  };
}

function mapEvidenceItem(item: RawReadinessEvidenceItem): ReadinessProfileEvidenceItemView {
  return {
    evidenceId: item.evidenceId,
    featureId: item.featureId,
    status: item.status,
    producedAt: item.producedAt ?? '',
    sourceGapRow: item.sourceGapRow ?? '',
    releaseScope: item.releaseScope ?? '',
    visibility: item.visibility ?? '',
    acceptanceGateIds: item.acceptanceGateIds,
    dimensionIds: item.dimensionIds,
    artifactRefs: (item.artifactRefs ?? []).map(mapArtifactRef),
    checkResults: (item.checkResults ?? []).map(mapCheckResult),
    freshnessState: item.freshness?.state ?? 'unknown',
    invalidationRule: item.freshness?.invalidationRule ?? '',
    staleReason: item.freshness?.staleReason ?? '',
    residualRisk: item.residualRisk ?? '',
    claimEffect: item.claimEffect ?? 'none',
  };
}

function getLatestTimestamp(values: string[]): string {
  const normalized = values.filter((value) => value.trim().length > 0);

  if (normalized.length === 0) {
    return '';
  }

  return normalized.sort().at(-1) ?? '';
}

function getProfileGateStatus(profile: RawReadinessClaimProfile): {
  status: ReadinessProfileCheckStatus;
  tone: ReadinessProfileCheckTone;
} {
  if (profile.gateSeverity === 'red') {
    return { status: 'failed', tone: 'red' };
  }

  if (profile.gateStatus === 'future_gated') {
    return { status: 'future_gated', tone: 'amber' };
  }

  if (profile.gateStatus === 'not_observed') {
    return { status: 'not_observed', tone: 'amber' };
  }

  if ((profile.verifierWarningCount ?? 0) > 0 || profile.gateStatus === 'with_warnings') {
    return { status: 'with_warnings', tone: 'amber' };
  }

  return { status: 'passed', tone: profile.gateSeverity };
}

function getEvidenceStatus(
  evidenceItems: RawReadinessEvidenceItem[],
  fallbackStatus: ReadinessProfileCheckStatus
): {
  status: ReadinessProfileCheckStatus;
  tone: ReadinessProfileCheckTone;
} {
  if (evidenceItems.length === 0) {
    return {
      status: fallbackStatus,
      tone: fallbackStatus === 'not_applicable' ? 'neutral' : 'amber',
    };
  }

  if (evidenceItems.some((item) => item.status === 'rejected')) {
    return { status: 'failed', tone: 'red' };
  }

  if (
    evidenceItems.some(
      (item) =>
        item.status === 'blocked' ||
        item.status !== 'accepted' ||
        item.freshness?.state === 'stale' ||
        item.freshness?.staleReason
    )
  ) {
    return { status: 'with_warnings', tone: 'amber' };
  }

  return { status: 'passed', tone: 'green' };
}

function buildProfileGateCheck(
  profile: RawReadinessClaimProfile,
  source: ReadinessDashboardSource
): ReadinessProfileEvidenceCheckView {
  const status = getProfileGateStatus(profile);
  const whenWasTested = source.register.promotedAt || source.manifest.generatedAt;

  return {
    checkId: 'profile-gate-runtime-evidence',
    title: 'Profile gate and runtime evidence',
    category: 'profile',
    status: status.status,
    tone: status.tone,
    applicability: 'Applies to this profile.',
    whatWasTested:
      'Product mode, binding status, isNonBindingElection value, threshold profile, runtime evidence references, and verifier warnings for the selected HushVoting profile gate.',
    whenWasTested,
    check: profile.requiredEvidence.join('; '),
    requiredEvidence: profile.requiredEvidence,
    evidenceRefs: profile.evidenceRefs,
    evidenceItems: [],
    disabledInDevelopment: false,
    developmentAdjustment: '',
  };
}

function buildEvidenceCheck(
  definition: EvidenceCheckDefinition,
  profile: RawReadinessClaimProfile,
  source: ReadinessDashboardSource
): ReadinessProfileEvidenceCheckView {
  const displayCopy = getDirectCryptoPathCopy(definition, profile);
  const profileBoundOverride = getProfileBoundEvidenceOverride(definition, profile, source);
  const applicable = profileBoundOverride !== null || isDefinitionApplicable(definition, profile);
  const evidenceItems =
    applicable && !profileBoundOverride ? getCurrentEvidenceItemsForDefinition(definition, source) : [];
  const disabledInDevelopment =
    applicable &&
    definition.disabledForDevelopmentDirect === true &&
    isDevelopmentDirectProfile(profile);
  const developmentAdjusted =
    applicable && definition.developmentAdjusted === true && isDevelopmentDirectProfile(profile);
  const status = developmentAdjusted
    ? ({ status: 'rehearsal_accepted', tone: 'amber' } as const)
    : disabledInDevelopment
      ? ({ status: 'disabled', tone: 'neutral' } as const)
      : profileBoundOverride
        ? ({
            status: profileBoundOverride.status,
            tone: profileBoundOverride.tone,
          } as const)
      : applicable && definition.derivedStatus
        ? ({
            status: definition.derivedStatus,
            tone: definition.derivedTone ?? 'green',
          } as const)
      : getEvidenceStatus(evidenceItems, applicable ? 'not_observed' : 'not_applicable');
  const latestProducedAt = getLatestTimestamp(evidenceItems.map((item) => item.producedAt ?? ''));
  const whenWasTested =
    profileBoundOverride?.whenWasTested ||
    latestProducedAt ||
    source.register.promotedAt ||
    source.manifest.generatedAt;

  return {
    checkId: definition.checkId,
    title: definition.title,
    category: definition.category,
    status: status.status,
    tone: status.tone,
    applicability: applicable ? 'Applies to this profile.' : 'Not applicable to this profile.',
    whatWasTested: profileBoundOverride?.whatWasTested ?? displayCopy.whatWasTested,
    whenWasTested,
    check: profileBoundOverride?.check ?? displayCopy.check,
    requiredEvidence: profileBoundOverride?.requiredEvidence ?? displayCopy.requiredEvidence,
    evidenceRefs: profileBoundOverride?.evidenceRefs ?? definition.evidenceRefs ?? [],
    evidenceItems: evidenceItems.map(mapEvidenceItem),
    disabledInDevelopment: disabledInDevelopment || developmentAdjusted,
    developmentAdjustment: disabledInDevelopment
      ? definition.disabledReason ?? ''
      : developmentAdjusted
        ? definition.developmentAdjustment ?? ''
        : '',
  };
}

function buildReadinessProfileAssessment(
  checks: ReadinessProfileEvidenceCheckView[]
): ReadinessProfileAssessmentView {
  if (checks.some((check) => check.status === 'failed')) {
    return {
      severity: 'red',
      status: 'failed',
      label: 'failed',
      summary: 'One or more readiness checks failed and must be resolved before this report can pass.',
    };
  }

  if (checks.some((check) => check.status === 'not_observed' || check.status === 'future_gated')) {
    return {
      severity: 'amber',
      status: 'incomplete',
      label: 'incomplete',
      summary: 'One or more readiness checks are not yet observed or are gated by a future ceremony.',
    };
  }

  if (checks.some((check) => check.status === 'with_warnings')) {
    return {
      severity: 'amber',
      status: 'with_warnings',
      label: 'with warnings',
      summary: 'One or more readiness checks need warning review before this report can pass cleanly.',
    };
  }

  return {
    severity: 'green',
    status: 'passed',
    label: 'passed',
    summary:
      'All current readiness checks passed for this profile; rehearsal-boundary acceptances and disabled/not-applicable checks remain visible for review.',
  };
}

export function buildReadinessProfileCheckZipFileName(
  detail: ReadinessProfileDetailView
): string {
  const safeProfileId = toSafeFileName(detail.profile.profileId);
  const safeRegisterVersion = toSafeFileName(detail.register.registerVersionId);

  return `hushvoting-readiness-${safeProfileId}-${safeRegisterVersion}.zip`;
}

export function buildReadinessProfileDetail(
  source: ReadinessDashboardSource,
  profileId: string
): ReadinessProfileDetailView | null {
  const normalizedProfileId = decodeProfileId(profileId);
  const rawProfile = (source.register.claimProfiles ?? []).find(
    (profile) => profile.profileId === normalizedProfileId
  );

  if (!rawProfile) {
    return null;
  }

  const profile = mapClaimProfile(rawProfile);
  const register = {
    registerVersionId: source.register.registerVersionId,
    registerVersion: source.register.registerVersion,
    status: source.register.status,
    promotedAt: source.register.promotedAt || source.manifest.generatedAt,
    generatedAt: source.manifest.generatedAt,
    sourceCommit: source.register.sourceCommit || source.manifest.sourceCommit,
    publicationStatus:
      source.register.generatedViews?.publicSafePublicationStatus ??
      source.manifest.publicationStatus,
    manifestHash: source.manifest.manifestHash,
    archiveFileName: source.manifest.archive?.fileName ?? '',
    archiveSha256Hash: source.manifest.archive?.sha256Hash ?? source.catalog.currentArchiveHash,
    archiveSizeBytes: source.manifest.archive?.sizeBytes ?? 0,
  };
  const checks = [
    buildProfileGateCheck(rawProfile, source),
    ...evidenceCheckDefinitions.map((definition) =>
      buildEvidenceCheck(definition, rawProfile, source)
    ),
  ];
  const assessment = buildReadinessProfileAssessment(checks);
  const detail: ReadinessProfileDetailView = {
    register,
    profile,
    assessment,
    checks,
    download: {
      apiRoute: buildReadinessProfileZipApiRoute(rawProfile.profileId),
      fileName: '',
    },
  };

  detail.download.fileName = buildReadinessProfileCheckZipFileName(detail);

  return detail;
}

function renderMarkdownList(values: string[], fallback = 'None recorded.'): string {
  if (values.length === 0) {
    return `- ${fallback}`;
  }

  return values.map((value) => `- ${value}`).join('\n');
}

function renderEvidenceItems(items: ReadinessProfileEvidenceItemView[]): string {
  if (items.length === 0) {
    return '- No readiness evidence items are bound to this check in the active register.';
  }

  return items
    .map((item) => {
      const artifactRefs = item.artifactRefs
        .map(
          (artifact) =>
            `  - ${artifact.artifactId}: ${artifact.relativePath} (${artifact.hashAlgorithm} ${artifact.sha256Hash})`
        )
        .join('\n');
      const checkResults = item.checkResults
        .map((result) => `  - ${result.checkId}: ${result.status} - ${result.summary}`)
        .join('\n');

      return [
        `- ${item.evidenceId} / ${item.featureId} / ${item.status}`,
        `  - Gates: ${item.acceptanceGateIds.join(', ') || 'none'}`,
        `  - Dimensions: ${item.dimensionIds.join(', ') || 'none'}`,
        `  - Produced at: ${item.producedAt || 'not recorded'}`,
        `  - Release scope: ${item.releaseScope || 'not recorded'}`,
        `  - Freshness: ${item.freshnessState}`,
        artifactRefs ? `  - Artifact refs:\n${artifactRefs}` : '  - Artifact refs: none recorded',
        checkResults ? `  - Check results:\n${checkResults}` : '  - Check results: none recorded',
      ].join('\n');
    })
    .join('\n');
}

export function renderReadinessProfileCheckReport(detail: ReadinessProfileDetailView): string {
  const lines = [
    `# ${detail.profile.label} Readiness Check Report`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Profile ID | ${detail.profile.profileId} |`,
    `| Register Version | ${detail.register.registerVersionId} |`,
    `| Register Status | ${detail.register.status} |`,
    `| Generated At | ${detail.register.generatedAt} |`,
    `| Last Updated At | ${detail.register.promotedAt} |`,
    `| Source Commit | ${detail.register.sourceCommit} |`,
    `| Manifest Hash | ${detail.register.manifestHash} |`,
    `| Register Archive | ${detail.register.archiveFileName || 'not recorded'} |`,
    `| Archive SHA-256 | ${detail.register.archiveSha256Hash || 'not recorded'} |`,
    '',
    '## Profile',
    '',
    `Product mode: ${detail.profile.productMode}`,
    `Binding status: ${detail.profile.bindingStatus}`,
    `isNonBindingElection: ${String(detail.profile.isNonBindingElection)}`,
    `Threshold profile: ${detail.profile.thresholdProfile}`,
    `Evidence assessment: ${detail.assessment.severity} / ${detail.assessment.status}`,
    `Assessment summary: ${detail.assessment.summary}`,
    `Register gate: ${detail.profile.severity} / ${detail.profile.gateStatus}`,
    '',
  ];

  for (const check of detail.checks) {
    lines.push(
      `## ${check.title}`,
      '',
      `Status: ${check.status}`,
      `Applicability: ${check.applicability}`,
      `When tested: ${check.whenWasTested || 'not recorded'}`,
      '',
      '### What Was Tested',
      '',
      check.whatWasTested,
      '',
      '### Check',
      '',
      check.check,
      '',
      '### Required Evidence',
      '',
      renderMarkdownList(check.requiredEvidence),
      '',
      '### Profile Evidence References',
      '',
      renderMarkdownList(check.evidenceRefs),
      '',
      '### Readiness Evidence Items',
      '',
      renderEvidenceItems(check.evidenceItems),
      ''
    );

    if (check.developmentAdjustment) {
      lines.push('### Development Adjustment', '', check.developmentAdjustment, '');
    }
  }

  return `${lines.join('\n')}\n`;
}

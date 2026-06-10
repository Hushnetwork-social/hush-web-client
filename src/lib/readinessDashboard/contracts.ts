export const READINESS_DASHBOARD_NAV_ID = 'readiness-dashboard';
export const READINESS_DASHBOARD_ROUTE = '/elections/readiness';
export const READINESS_DASHBOARD_LEGACY_INTERNAL_ROUTE = '/internal/hushvoting/readiness';
export const READINESS_DASHBOARD_API_ROUTE = '/api/internal/hushvoting/readiness';
export const READINESS_PROFILE_ROUTE_BASE = `${READINESS_DASHBOARD_ROUTE}/profile`;
export const READINESS_PROFILE_API_ROUTE_BASE = `${READINESS_DASHBOARD_API_ROUTE}/profile`;

export type ReadinessDashboardGateReason =
  | 'enabled'
  | 'missing_flag'
  | 'production_blocked'
  | 'unauthorized';

export type ReadinessDashboardApiState =
  | 'disabled'
  | 'production_blocked'
  | 'unauthorized'
  | 'missing_catalog'
  | 'missing_register'
  | 'invalid_register'
  | 'superseded_or_blocked_register'
  | 'load_error'
  | 'ready';

export type ReadinessSeverity = 'green' | 'amber' | 'red';
export type ReadinessEvidenceStatus =
  | 'missing'
  | 'placeholder'
  | 'draft'
  | 'observed'
  | 'accepted'
  | 'blocked'
  | 'rejected'
  | 'superseded';

export type ReadinessScoreBand =
  | 'below_minimum'
  | 'minimum_confidence'
  | 'strong_confidence'
  | 'mature';

export interface ReadinessDashboardClientGate {
  route: typeof READINESS_DASHBOARD_ROUTE;
  envFlag: 'NEXT_PUBLIC_HUSHVOTING_READINESS_DASHBOARD_ENABLED';
  enabled: boolean;
  hiddenFromOrdinaryHushVotingNavigation: boolean;
  reason: Exclude<ReadinessDashboardGateReason, 'unauthorized'>;
}

export interface ReadinessDashboardServerGate {
  route: typeof READINESS_DASHBOARD_ROUTE;
  enabled: boolean;
  hiddenFromOrdinaryHushVotingNavigation: boolean;
  reason: ReadinessDashboardGateReason;
  allowedPublicKey: string | null;
}

export interface ReadinessCatalogEntryView {
  registerVersion: string;
  registerVersionId: string;
  status: string;
  generatedAt: string;
  totalScore: number;
  strongestAllowedClaim: string;
  strongestAllowedV1PolicyCeiling: string;
  publicationStatus: string;
  manifestHash: string;
  archiveHash: string;
  current: boolean;
}

export interface ReadinessClaimGateView {
  claimLevel: string;
  severity: ReadinessSeverity;
  status: string;
  allowedWording: string;
  limitationWording: string;
  blockedWording: string;
  blockerIds: string[];
  publicSafeStatus: string;
}

export interface ReadinessClaimProfileWarningView {
  checkCode: string;
  resultCode: string;
  message: string;
  evidenceRef: string;
}

export interface ReadinessClaimProfileGateView {
  profileId: string;
  label: string;
  productMode: string;
  governanceEffect: string;
  bindingStatus: string;
  isNonBindingElection: boolean;
  thresholdProfile: string;
  profileClass: string;
  severity: ReadinessSeverity;
  gateStatus: string;
  claimLevel: string;
  claimWording: string;
  limitationWording: string;
  evidenceRefs: string[];
  requiredEvidence: string[];
  verifierWarningCount: number;
  verifierWarnings: ReadinessClaimProfileWarningView[];
}

export interface ReadinessDimensionView {
  dimensionId: string;
  name: string;
  weight: number;
  currentScore: number;
  targetScore: number;
  sourceGapRows: string[];
  acceptanceGateIds: string[];
  evidenceIds: string[];
  blockerIds: string[];
  residualRisk: string;
  scoreRationale: string;
}

export interface ReadinessBlockerView {
  blockerId: string;
  claimLevel: string;
  severity: ReadinessSeverity;
  status: string;
  description: string;
  featureId: string;
  acceptanceGateIds: string[];
  dimensionIds: string[];
  limitationWording: string;
  resolutionCriteria: string;
}

export interface ReadinessEvidenceView {
  evidenceId: string;
  featureId: string;
  status: ReadinessEvidenceStatus;
  freshnessState: string;
  staleReason: string;
  invalidationRule: string;
  claimEffect: string;
  acceptanceGateIds: string[];
  dimensionIds: string[];
}

export interface ReadinessExceptionView {
  exceptionId: string;
  reason: string;
  status: string;
  claimImpact: string;
  affectedClaim: string;
  scoreImpact: string;
}

export interface ReadinessChildFeatureView {
  featureId: string;
  title: string;
  implementationStatus: string;
  readinessEvidenceStatus: ReadinessEvidenceStatus | 'not_promoted_yet' | 'completed_not_promoted';
  gates: string[];
  claimImpact: string;
  notes: string;
}

export interface ReadinessDashboardViewModel {
  access: {
    route: typeof READINESS_DASHBOARD_ROUTE;
    enabled: boolean;
    reason: ReadinessDashboardGateReason;
    hiddenFromOrdinaryNavigation: boolean;
  };
  catalog: {
    registerId: string;
    currentRegisterVersionId: string;
    currentRegisterVersion: string;
    currentManifestHash: string;
    currentArchiveHash: string;
    entries: ReadinessCatalogEntryView[];
  };
  register: {
    registerVersionId: string;
    registerVersion: string;
    status: string;
    promotedAt: string;
    sourceCommit: string;
    publicationStatus: string;
    dataHealth: 'current' | 'missing' | 'invalid' | 'blocked' | 'superseded' | 'stale';
    warnings: string[];
  };
  score: {
    total: number;
    minimumConfidenceScore: number;
    strongerTargetScore: number;
    thresholdBand: ReadinessScoreBand;
  };
  claims: ReadinessClaimGateView[];
  claimProfiles: ReadinessClaimProfileGateView[];
  dimensions: ReadinessDimensionView[];
  blockers: ReadinessBlockerView[];
  evidenceLifecycleCounts: Record<ReadinessEvidenceStatus, number>;
  staleEvidence: ReadinessEvidenceView[];
  exceptions: ReadinessExceptionView[];
  childFeatures: ReadinessChildFeatureView[];
  publicSafePreview: {
    publicationStatus: string;
    generatedMarkdown: string;
    redactionStatus: 'passed' | 'failed';
    redactionWarnings: string[];
  };
}

export type ReadinessDashboardApiResponse =
  | {
      success: true;
      state: 'ready' | 'superseded_or_blocked_register';
      dashboard: ReadinessDashboardViewModel;
    }
  | {
      success: false;
      state: Exclude<
        ReadinessDashboardApiState,
        'ready' | 'superseded_or_blocked_register'
      >;
      code: string;
      message: string;
    };

export interface RawReadinessCatalogEntry {
  registerVersion: string;
  registerVersionId: string;
  status: string;
  generatedAt: string;
  totalScore: number;
  strongestAllowedClaim: string;
  strongestAllowedV1PolicyCeiling: string;
  publicationStatus: string;
  manifestHash: string;
  archiveHash: string;
  versionPath: string;
}

export interface RawReadinessCatalog {
  catalogVersion: string;
  registerId: string;
  entries: RawReadinessCatalogEntry[];
  currentRegisterVersionId: string;
  currentRegisterVersion: string;
  currentManifestHash: string;
  currentArchiveHash: string;
}

export interface RawReadinessManifest {
  manifestVersion: string;
  registerId: string;
  registerVersion: string;
  registerVersionId: string;
  status: string;
  generatedAt: string;
  sourceCommit: string;
  totalScore: number;
  strongestAllowedClaim: string;
  strongestAllowedV1PolicyCeiling: string;
  publicationStatus: string;
  manifestHash: string;
  archive?: {
    fileName: string;
    sha256Hash: string;
    hashAlgorithm: string;
    sizeBytes: number;
  };
  files?: RawReadinessManifestFile[];
}

export interface RawReadinessManifestFile {
  relativePath: string;
  visibility: string;
  sha256Hash: string;
  hashAlgorithm: string;
  mediaType: string;
  sizeBytes: number;
}

export interface RawReadinessDimension {
  dimensionId: string;
  name: string;
  weight: number;
  currentScore: number;
  targetScoreBeforeReviewPilot: number;
  sourceGapRows: string[];
  acceptanceGateIds: string[];
  evidenceIds: string[];
  blockerIds: string[];
  residualRisk: string;
  scoreRationale: string;
}

export interface RawReadinessClaimLevel {
  claimLevel: string;
  blockerSeverity: ReadinessSeverity;
  status: string;
  allowedWording: string;
  limitationWording: string;
  blockedWording: string;
  blockerIds: string[];
  publicSafeStatus: string;
}

export interface RawReadinessClaimProfile {
  profileId: string;
  label: string;
  productMode: string;
  governanceEffect: string;
  bindingStatus: string;
  isNonBindingElection: boolean;
  thresholdProfile: string;
  profileClass: string;
  gateSeverity: ReadinessSeverity;
  gateStatus: string;
  claimLevel: string;
  claimWording: string;
  limitationWording: string;
  evidenceRefs: string[];
  requiredEvidence: string[];
  verifierWarningCount?: number;
  verifierWarnings?: RawReadinessClaimProfileWarning[];
}

export interface RawReadinessClaimProfileWarning {
  checkCode: string;
  resultCode: string;
  message: string;
  evidenceRef: string;
}

export interface RawReadinessBlocker {
  blockerId: string;
  claimLevel: string;
  severity: ReadinessSeverity;
  status: string;
  description: string;
  featureId: string;
  acceptanceGateIds: string[];
  dimensionIds: string[];
  limitationWording: string;
  resolutionCriteria: string;
}

export interface RawReadinessEvidenceItem {
  evidenceId: string;
  parentEpic?: string;
  featureId: string;
  sourceGapRow?: string;
  status: ReadinessEvidenceStatus;
  acceptanceGateIds: string[];
  dimensionIds: string[];
  electionScope?: string;
  releaseScope?: string;
  visibility?: string;
  producedAt?: string;
  owner?: string;
  artifactRefs?: RawReadinessArtifactRef[];
  checkResults?: RawReadinessCheckResult[];
  freshness?: {
    state?: string;
    invalidationRule?: string;
    staleReason?: string;
  };
  residualRisk?: string;
  claimEffect?: string;
}

export interface RawReadinessArtifactRef {
  artifactId: string;
  relativePath: string;
  sha256Hash: string;
  hashAlgorithm: string;
  mediaType: string;
  sizeBytes: number;
  visibility: string;
}

export interface RawReadinessCheckResult {
  checkId: string;
  status: string;
  summary: string;
  detailsRef: string;
}

export interface RawReadinessException {
  exceptionId?: string;
  reason?: string;
  status?: string;
  claimImpact?: string;
  affectedClaim?: string;
  scoreImpact?: string;
}

export interface RawReadinessRegister {
  schemaVersion: string;
  registerId: string;
  registerVersion: string;
  registerVersionId: string;
  status: string;
  promotedAt: string;
  sourceCommit: string;
  claimPolicy: {
    minimumConfidenceScore: number;
    strongerTargetScore: number;
    strongestAllowedV1Claim: string;
  };
  score: {
    total: number;
    minimumConfidenceScore: number;
    strongerTargetScore: number;
  };
  dimensions: RawReadinessDimension[];
  claimLevels: RawReadinessClaimLevel[];
  claimProfiles?: RawReadinessClaimProfile[];
  blockers: RawReadinessBlocker[];
  evidenceItems: RawReadinessEvidenceItem[];
  exceptions: RawReadinessException[];
  generatedViews?: {
    publicSafePublicationStatus?: string;
    publicSafeSummaryPath?: string;
  };
}

export interface ReadinessDashboardSource {
  catalog: RawReadinessCatalog;
  register: RawReadinessRegister;
  manifest: RawReadinessManifest;
  publicSafeSummary: string;
}

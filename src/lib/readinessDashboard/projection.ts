import {
  READINESS_DASHBOARD_ROUTE,
  type RawReadinessBlocker,
  type RawReadinessCatalogEntry,
  type RawReadinessClaimProfile,
  type RawReadinessDimension,
  type RawReadinessEvidenceItem,
  type RawReadinessException,
  type RawReadinessRegister,
  type ReadinessDashboardServerGate,
  type ReadinessDashboardSource,
  type ReadinessDashboardViewModel,
  type ReadinessEvidenceStatus,
  type ReadinessScoreBand,
} from './contracts';
import { buildReadinessChildFeatureViews } from './featureStatusSnapshot';
import {
  redactPublicSafeSummaryForPreview,
  validatePublicSafeSummary,
} from './redaction';

const evidenceStatuses: ReadinessEvidenceStatus[] = [
  'missing',
  'placeholder',
  'draft',
  'observed',
  'accepted',
  'blocked',
  'rejected',
  'superseded',
];

function getScoreBand(
  total: number,
  minimumConfidenceScore: number,
  strongerTargetScore: number
): ReadinessScoreBand {
  if (total < minimumConfidenceScore) {
    return 'below_minimum';
  }

  if (total < strongerTargetScore) {
    return 'minimum_confidence';
  }

  if (total < 90) {
    return 'strong_confidence';
  }

  return 'mature';
}

function getRegisterDataHealth(register: RawReadinessRegister) {
  const normalizedStatus = register.status.toLowerCase();

  if (normalizedStatus.includes('superseded')) {
    return 'superseded' as const;
  }

  if (normalizedStatus.includes('blocked')) {
    return 'blocked' as const;
  }

  if (register.evidenceItems.some((item) => item.freshness?.state === 'stale')) {
    return 'stale' as const;
  }

  return 'current' as const;
}

function buildWarnings(register: RawReadinessRegister): string[] {
  const warnings: string[] = [];
  const dataHealth = getRegisterDataHealth(register);

  if (dataHealth !== 'current') {
    warnings.push(`Register data health is ${dataHealth}.`);
  }

  if (register.score.total < register.score.minimumConfidenceScore) {
    warnings.push('Score is below the minimum confidence threshold.');
  }

  if (register.score.total < register.score.strongerTargetScore) {
    warnings.push('Hush-owned 95+ internal audit target remains open.');
  }

  if (
    register.claimLevels.some(
      (claim) => claim.blockerSeverity === 'red' && claim.status === 'blocked'
    )
  ) {
    warnings.push('One or more current claim gates remain blocked.');
  }

  return warnings;
}

function mapCatalogEntry(
  entry: RawReadinessCatalogEntry,
  currentRegisterVersionId: string
) {
  return {
    registerVersion: entry.registerVersion,
    registerVersionId: entry.registerVersionId,
    status: entry.status,
    generatedAt: entry.generatedAt,
    totalScore: entry.totalScore,
    strongestAllowedClaim: entry.strongestAllowedClaim,
    strongestAllowedV1PolicyCeiling: entry.strongestAllowedV1PolicyCeiling,
    publicationStatus: entry.publicationStatus,
    manifestHash: entry.manifestHash,
    archiveHash: entry.archiveHash,
    current: entry.registerVersionId === currentRegisterVersionId,
  };
}

function mapDimension(dimension: RawReadinessDimension) {
  return {
    dimensionId: dimension.dimensionId,
    name: dimension.name,
    weight: dimension.weight,
    currentScore: dimension.currentScore,
    targetScore: dimension.targetScoreBeforeReviewPilot,
    sourceGapRows: dimension.sourceGapRows,
    acceptanceGateIds: dimension.acceptanceGateIds,
    evidenceIds: dimension.evidenceIds,
    blockerIds: dimension.blockerIds,
    residualRisk: dimension.residualRisk,
    scoreRationale: dimension.scoreRationale,
  };
}

function mapBlocker(blocker: RawReadinessBlocker) {
  return {
    blockerId: blocker.blockerId,
    claimLevel: blocker.claimLevel,
    severity: blocker.severity,
    status: blocker.status,
    description: blocker.description,
    featureId: blocker.featureId,
    acceptanceGateIds: blocker.acceptanceGateIds,
    dimensionIds: blocker.dimensionIds,
    limitationWording: blocker.limitationWording,
    resolutionCriteria: blocker.resolutionCriteria,
  };
}

function mapEvidence(evidence: RawReadinessEvidenceItem) {
  return {
    evidenceId: evidence.evidenceId,
    featureId: evidence.featureId,
    status: evidence.status,
    freshnessState: evidence.freshness?.state ?? 'unknown',
    staleReason: evidence.freshness?.staleReason ?? '',
    invalidationRule: evidence.freshness?.invalidationRule ?? '',
    claimEffect: evidence.claimEffect ?? 'none',
    acceptanceGateIds: evidence.acceptanceGateIds,
    dimensionIds: evidence.dimensionIds,
  };
}

function mapException(exception: RawReadinessException, index: number) {
  return {
    exceptionId: exception.exceptionId ?? `RDY-EXCEPTION-${index + 1}`,
    reason: exception.reason ?? 'No reason supplied.',
    status: exception.status ?? 'unknown',
    claimImpact: exception.claimImpact ?? 'unknown',
    affectedClaim: exception.affectedClaim ?? 'unknown',
    scoreImpact: exception.scoreImpact ?? 'unknown',
  };
}

function mapClaimProfile(profile: RawReadinessClaimProfile) {
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

function buildEvidenceLifecycleCounts(
  evidenceItems: RawReadinessEvidenceItem[]
): Record<ReadinessEvidenceStatus, number> {
  const counts = evidenceStatuses.reduce(
    (accumulator, status) => ({
      ...accumulator,
      [status]: 0,
    }),
    {} as Record<ReadinessEvidenceStatus, number>
  );

  evidenceItems.forEach((item) => {
    counts[item.status] += 1;
  });

  return counts;
}

export function projectReadinessDashboard(
  source: ReadinessDashboardSource,
  gate: ReadinessDashboardServerGate
): ReadinessDashboardViewModel {
  const { catalog, register, manifest, publicSafeSummary } = source;
  const publicSafePreview = redactPublicSafeSummaryForPreview(publicSafeSummary);
  const redaction = validatePublicSafeSummary(publicSafePreview);
  const staleEvidence = register.evidenceItems.filter(
    (item) => item.status === 'superseded' || item.freshness?.state === 'stale'
  );

  return {
    access: {
      route: READINESS_DASHBOARD_ROUTE,
      enabled: gate.enabled,
      reason: gate.reason,
      hiddenFromOrdinaryNavigation: gate.hiddenFromOrdinaryHushVotingNavigation,
    },
    catalog: {
      registerId: catalog.registerId,
      currentRegisterVersionId: catalog.currentRegisterVersionId,
      currentRegisterVersion: catalog.currentRegisterVersion,
      currentManifestHash: catalog.currentManifestHash,
      currentArchiveHash: catalog.currentArchiveHash,
      entries: catalog.entries.map((entry) =>
        mapCatalogEntry(entry, catalog.currentRegisterVersionId)
      ),
    },
    register: {
      registerVersionId: register.registerVersionId,
      registerVersion: register.registerVersion,
      status: register.status,
      promotedAt: register.promotedAt || manifest.generatedAt,
      sourceCommit: register.sourceCommit || manifest.sourceCommit,
      publicationStatus:
        register.generatedViews?.publicSafePublicationStatus ?? manifest.publicationStatus,
      dataHealth: getRegisterDataHealth(register),
      warnings: buildWarnings(register),
    },
    score: {
      total: register.score.total,
      minimumConfidenceScore: register.score.minimumConfidenceScore,
      strongerTargetScore: register.score.strongerTargetScore,
      thresholdBand: getScoreBand(
        register.score.total,
        register.score.minimumConfidenceScore,
        register.score.strongerTargetScore
      ),
    },
    claims: register.claimLevels.map((claim) => ({
      claimLevel: claim.claimLevel,
      severity: claim.blockerSeverity,
      status: claim.status,
      allowedWording: claim.allowedWording,
      limitationWording: claim.limitationWording,
      blockedWording: claim.blockedWording,
      blockerIds: claim.blockerIds,
      publicSafeStatus: claim.publicSafeStatus,
    })),
    claimProfiles: (register.claimProfiles ?? []).map(mapClaimProfile),
    dimensions: register.dimensions.map(mapDimension),
    blockers: register.blockers
      .filter((blocker) => blocker.status !== 'superseded')
      .map(mapBlocker)
      .sort((left, right) => {
        const severityWeight = { red: 0, amber: 1, green: 2 };
        return severityWeight[left.severity] - severityWeight[right.severity];
      }),
    evidenceLifecycleCounts: buildEvidenceLifecycleCounts(register.evidenceItems),
    staleEvidence: staleEvidence.map(mapEvidence),
    exceptions: register.exceptions.map(mapException),
    childFeatures: buildReadinessChildFeatureViews(register),
    publicSafePreview: {
      publicationStatus:
        register.generatedViews?.publicSafePublicationStatus ?? manifest.publicationStatus,
      generatedMarkdown: publicSafePreview,
      redactionStatus: redaction.status,
      redactionWarnings: redaction.warnings,
    },
  };
}

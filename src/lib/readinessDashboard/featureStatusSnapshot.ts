import type {
  RawReadinessRegister,
  ReadinessChildFeatureView,
  ReadinessEvidenceStatus,
} from './contracts';

interface FeatureSnapshotRow {
  featureId: string;
  title: string;
  implementationStatus: string;
  gates: string[];
}

export const READINESS_DASHBOARD_CHILD_FEATURE_SNAPSHOT: FeatureSnapshotRow[] = [
  {
    featureId: 'FEAT-130',
    title: 'Readiness Claim Register And Scorecard',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-001'],
  },
  {
    featureId: 'FEAT-131',
    title: 'Per-Election KMS Custody Lifecycle',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-002', 'AT-RDY-003', 'AT-RDY-004'],
  },
  {
    featureId: 'FEAT-132',
    title: 'Trusted Deployment Ceremony',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-005'],
  },
  {
    featureId: 'FEAT-133',
    title: 'Operational Evidence Export And OPS Checks',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-006'],
  },
  {
    featureId: 'FEAT-134',
    title: 'Security Dependency And Support Readiness Evidence',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-014'],
  },
  {
    featureId: 'FEAT-135',
    title: 'Public Verifier Sample And Tamper Corpus',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-007'],
  },
  {
    featureId: 'FEAT-136',
    title: 'Cross-Device Receipt Inclusion Verification',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-008'],
  },
  {
    featureId: 'FEAT-137',
    title: 'Retention And Log Privacy Proof',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-009', 'AT-RDY-010'],
  },
  {
    featureId: 'FEAT-138',
    title: 'ElectionOwner Void Decision And Voided Publication Replacement',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-015'],
  },
  {
    featureId: 'FEAT-139',
    title: 'EPIC-014 Dispute And Continuity Readiness Evidence',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-011'],
  },
  {
    featureId: 'FEAT-140',
    title: 'Legal And Governance Boundary Wrapper',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-012'],
  },
  {
    featureId: 'FEAT-141',
    title: 'Pilot Evidence Package And Rehearsal',
    implementationStatus: '01_SUBMITTED',
    gates: ['AT-RDY-013'],
  },
  {
    featureId: 'FEAT-142',
    title: 'Internal Readiness Dashboard',
    implementationStatus: '03_IN_PROGRESS',
    gates: ['AT-RDY-016'],
  },
  {
    featureId: 'FEAT-143',
    title: 'Runtime Deployment Proof Binding Ledger',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-017'],
  },
  {
    featureId: 'FEAT-144',
    title: 'HushWebClient Deployment Proof Exposure And Handshake',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-RDY-018'],
  },
  {
    featureId: 'FEAT-146',
    title: 'Governed Outcome Producer',
    implementationStatus: '04_COMPLETED',
    gates: ['AT-PROC-I26', 'AT-PROC-I27', 'AT-PROC-I28', 'AT-PROC-I29', 'AT-RDY-011'],
  },
];

const evidenceRank: ReadinessEvidenceStatus[] = [
  'missing',
  'placeholder',
  'draft',
  'observed',
  'accepted',
  'blocked',
  'rejected',
  'superseded',
];

function pickBestEvidenceStatus(
  statuses: ReadinessEvidenceStatus[]
): ReadinessEvidenceStatus | null {
  if (statuses.length === 0) {
    return null;
  }

  if (statuses.includes('accepted')) {
    return 'accepted';
  }

  return statuses.reduce((best, current) =>
    evidenceRank.indexOf(current) > evidenceRank.indexOf(best) ? current : best
  );
}

export function buildReadinessChildFeatureViews(
  register: RawReadinessRegister
): ReadinessChildFeatureView[] {
  return READINESS_DASHBOARD_CHILD_FEATURE_SNAPSHOT.map((feature) => {
    const evidenceItems = register.evidenceItems.filter(
      (item) => item.featureId === feature.featureId
    );
    const evidenceStatus = pickBestEvidenceStatus(
      evidenceItems.map((item) => item.status)
    );
    const blockers = register.blockers.filter((item) => item.featureId === feature.featureId);
    const claimEffects = new Set(
      evidenceItems
        .map((item) => item.claimEffect)
        .filter((item): item is string => !!item && item.length > 0)
    );
    const readinessEvidenceStatus =
      evidenceStatus ??
      (feature.implementationStatus === '04_COMPLETED'
        ? 'completed_not_promoted'
        : 'not_promoted_yet');

    return {
      ...feature,
      readinessEvidenceStatus,
      gates: Array.from(new Set([...feature.gates, ...blockers.flatMap((item) => item.acceptanceGateIds)])),
      claimImpact:
        blockers.some((item) => item.severity === 'red' && item.status !== 'resolved')
          ? 'block'
          : claimEffects.size > 0
            ? Array.from(claimEffects).join(', ')
            : 'none',
      notes:
        readinessEvidenceStatus === 'completed_not_promoted'
          ? 'Completed implementation is not yet accepted in the promoted register.'
          : readinessEvidenceStatus === 'not_promoted_yet'
            ? 'No promoted readiness evidence is available in the current register.'
            : `Promoted register evidence is ${readinessEvidenceStatus}.`,
    };
  });
}

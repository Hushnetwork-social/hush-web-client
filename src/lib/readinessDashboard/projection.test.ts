import { describe, expect, it } from 'vitest';
import { createReadinessDashboardFixtureSource } from './fixtures';
import { projectReadinessDashboard } from './projection';
import { validatePublicSafeSummary } from './redaction';
import type { ReadinessDashboardServerGate } from './contracts';

const enabledGate: ReadinessDashboardServerGate = {
  route: '/elections/readiness',
  enabled: true,
  hiddenFromOrdinaryHushVotingNavigation: false,
  reason: 'enabled',
  allowedPublicKey: 'npub-1',
};

describe('FEAT-142 readiness dashboard projection', () => {
  it('renders the promoted RDY-REG-v0.1.3 baseline', () => {
    const dashboard = projectReadinessDashboard(
      createReadinessDashboardFixtureSource(),
      enabledGate
    );

    expect(dashboard.register.registerVersionId).toBe('RDY-REG-v0.1.3');
    expect(dashboard.register.status).toBe('AcceptedInternal');
    expect(dashboard.score.total).toBe(60);
    expect(dashboard.score.thresholdBand).toBe('below_minimum');
    expect(
      dashboard.claims.find((claim) => claim.claimLevel === 'internal_non_binding_rehearsal')
    ).toMatchObject({
      severity: 'amber',
      status: 'allowed_with_limitations',
    });
    expect(
      dashboard.blockers.find(
        (blocker) => blocker.blockerId === 'RDY-BLOCK-FRIENDLY_ORGANIZATION_PILOT-003'
      )
    ).toMatchObject({
      severity: 'red',
      status: 'open',
    });
  });

  it('keeps red pilot blockers independent from a synthetic score above 70', () => {
    const source = createReadinessDashboardFixtureSource({
      register: {
        ...createReadinessDashboardFixtureSource().register,
        score: {
          total: 75,
          minimumConfidenceScore: 70,
          strongerTargetScore: 80,
        },
      },
    });
    const dashboard = projectReadinessDashboard(source, enabledGate);

    expect(dashboard.score.thresholdBand).toBe('minimum_confidence');
    expect(
      dashboard.claims.find((claim) => claim.claimLevel === 'friendly_organization_pilot')
    ).toMatchObject({
      severity: 'red',
      status: 'blocked',
    });
  });

  it('separates completed implementation status from promoted readiness evidence', () => {
    const dashboard = projectReadinessDashboard(
      createReadinessDashboardFixtureSource(),
      enabledGate
    );

    expect(
      dashboard.childFeatures.find((feature) => feature.featureId === 'FEAT-143')
    ).toMatchObject({
      implementationStatus: '04_COMPLETED',
      readinessEvidenceStatus: 'completed_not_promoted',
    });
  });

  it('rejects public-safe preview content that leaks scores or private refs', () => {
    const result = validatePublicSafeSummary(
      'Public summary with 60/100 and hush-documents/PrivateServer/path'
    );

    expect(result.status).toBe('failed');
    expect(result.warnings.join(' ')).toContain('numeric readiness score');
    expect(result.warnings.join(' ')).toContain('private document path');
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  READINESS_DASHBOARD_CLIENT_ENV_FLAG,
  READINESS_DASHBOARD_PUBLIC_KEY_HEADER,
  READINESS_DASHBOARD_ROUTE,
  buildReadinessProfileApiRoute,
  buildReadinessProfileDetail,
  createReadinessDashboardFixtureSource,
  getReadinessDashboardClientRouteGate,
  type RawReadinessEvidenceItem,
  type ReadinessDashboardClientGate,
  type ReadinessProfileApiResponse,
  type ReadinessProfileDetailView,
} from '@/lib/readinessDashboard';
import { ReadinessProfileCheckPage } from './ReadinessProfileCheckPage';

const clientGate: ReadinessDashboardClientGate = getReadinessDashboardClientRouteGate({
  env: {
    NODE_ENV: 'development',
    [READINESS_DASHBOARD_CLIENT_ENV_FLAG]: 'true',
  },
});

const veritas500NonBindingEvidenceRefs = [
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/evidence-summary.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/ElectionRecord.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/VerifierInputManifest.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/report-package/canonical-manifest.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/report-package/evidence-graph.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/report-package/result-report.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/election-record/trustee-control-profile.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/election-record/trustee-control-summary.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/election-record/trustee-release-evidence.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/election-record/trustee-verifier-output.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/election-record/tally-replay.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verification-package/artifacts/election-record/result-binding.json',
  'hush-documents/PrivateServer_ElectronicVoting/Live-Rehearsal-Evidence/HushVoting-Veritas-500-Non-Binding-IV-20260611081304/public-verifier-output/VerifierOutput.json',
];

function getProfileDetail(profileId = 'hushvoting.direct.binding'): ReadinessProfileDetailView {
  const detail = buildReadinessProfileDetail(
    createReadinessDashboardFixtureSource(),
    profileId
  );

  if (!detail) {
    throw new Error('Fixture readiness profile detail was not built.');
  }

  return detail;
}

function getProfileResponse(profileId?: string): ReadinessProfileApiResponse {
  return {
    success: true,
    state: 'ready',
    detail: getProfileDetail(profileId),
  };
}

function createEvidenceItem(
  overrides: Partial<RawReadinessEvidenceItem> & Pick<RawReadinessEvidenceItem, 'evidenceId'>
): RawReadinessEvidenceItem {
  return {
    evidenceId: overrides.evidenceId,
    featureId: 'FEAT-999',
    sourceGapRow: 'Verifier/sample/tamper corpus',
    status: 'accepted',
    acceptanceGateIds: ['AT-RDY-007'],
    dimensionIds: ['RDY-DIM-002'],
    producedAt: '2026-06-04T12:00:00Z',
    artifactRefs: [],
    checkResults: [],
    freshness: {
      state: 'current',
      invalidationRule: 'Event-based invalidation when readiness evidence changes.',
      staleReason: '',
    },
    residualRisk: '',
    claimEffect: 'score_increase',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReadinessProfileCheckPage', () => {
  it('renders profile checks, evidence rows, and the ZIP action', () => {
    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.direct.binding"
        gate={clientGate}
        initialResponse={getProfileResponse()}
        credentialsPublicKey="npub-1"
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Binding HushVoting! Direct' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Readiness dashboard' })).toHaveAttribute(
      'href',
      READINESS_DASHBOARD_ROUTE
    );
    expect(screen.getByRole('button', { name: /download zip/i })).toBeEnabled();

    const checks = screen.getByTestId('readiness-profile-checks');
    expect(checks).toHaveTextContent('Profile gate and runtime evidence');
    expect(checks).toHaveTextContent('Binding mode, circuit, and crypto-path validation');
    expect(checks).toHaveTextContent('Protocol Omega package and evidence binding');
    expect(checks).toHaveTextContent('Deployment and software proof binding');
    expect(checks).not.toHaveTextContent('RDY-EVID-AT-RDY-001-FEAT-130-001');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expand Binding mode, circuit, and crypto-path validation',
      })
    );
    expect(checks).toHaveTextContent('admin-prod-1of1');
    expect(checks).not.toHaveTextContent('admin-dev-1of1');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expand Protocol Omega package and evidence binding',
      })
    );
    expect(checks).toHaveTextContent('Protocol and evidence architecture traceability');
    expect(checks).not.toHaveTextContent(
      'Gap register maps source gaps to the promoted readiness evidence set'
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expand Protocol and evidence architecture traceability',
      })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expand Deployment and software proof binding',
      })
    );

    expect(checks).toHaveTextContent(
      'Development Direct profile: production deployment evidence is outside this rehearsal claim'
    );
    expect(checks).toHaveTextContent('RDY-EVID-AT-RDY-001-FEAT-130-001');
    expect(checks).toHaveTextContent(
      'Gap register maps source gaps to the promoted readiness evidence set'
    );
  });

  it('fetches the current profile checks without browser cache reuse', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => getProfileResponse('hushvoting.direct.binding'),
    } as Response);

    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.direct.binding"
        gate={clientGate}
        credentialsPublicKey="npub-1"
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Binding HushVoting! Direct' })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(buildReadinessProfileApiRoute('hushvoting.direct.binding')),
      {
        cache: 'no-store',
        headers: {
          [READINESS_DASHBOARD_PUBLIC_KEY_HEADER]: 'npub-1',
        },
      }
    );
  });

  it('downloads the current profile ZIP without browser cache reuse', async () => {
    const response = getProfileResponse('hushvoting.direct.binding');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['profile checks']),
      headers: new Headers({
        'content-disposition': 'attachment; filename="profile-checks.zip"',
      }),
    } as Response);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:profile-checks');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.direct.binding"
        gate={clientGate}
        initialResponse={response}
        credentialsPublicKey="npub-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /download zip/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(response.detail.download.apiRoute),
      {
        cache: 'no-store',
        headers: {
          [READINESS_DASHBOARD_PUBLIC_KEY_HEADER]: 'npub-1',
        },
      }
    );
  });

  it('renders the Direct crypto-path check differently for binding and non-binding profiles', () => {
    const source = createReadinessDashboardFixtureSource();
    const bindingProfile = source.register.claimProfiles?.find(
      (profile) => profile.profileId === 'hushvoting.direct.binding'
    );

    if (!bindingProfile) {
      throw new Error('Expected binding fixture profile was not found.');
    }

    source.register.claimProfiles?.push({
      ...bindingProfile,
      profileId: 'hushvoting.direct.non_binding',
      label: 'Non-Binding HushVoting! Direct',
      governanceEffect: 'non_binding',
      bindingStatus: 'Non-Binding',
      isNonBindingElection: true,
      gateSeverity: 'green',
      gateStatus: 'passed',
      verifierWarningCount: 0,
      verifierWarnings: [],
      claimWording:
        'Product mode HushVoting! Direct, binding status Non-Binding, and isNonBindingElection true are accepted for the internal technical claim profile gate.',
      requiredEvidence: [
        'productMode == HushVoting! Direct',
        'bindingStatus == Non-Binding',
        'isNonBindingElection == true',
      ],
    });

    const bindingDetail = buildReadinessProfileDetail(
      source,
      'hushvoting.direct.binding'
    );
    const nonBindingDetail = buildReadinessProfileDetail(
      source,
      'hushvoting.direct.non_binding'
    );

    if (!bindingDetail || !nonBindingDetail) {
      throw new Error('Expected binding and non-binding profile details to be built.');
    }

    const bindingCheck = bindingDetail.checks.find(
      (check) => check.checkId === 'binding-mode-circuit-crypto-validation'
    );
    const nonBindingCheck = nonBindingDetail.checks.find(
      (check) => check.checkId === 'binding-mode-circuit-crypto-validation'
    );

    expect(bindingCheck?.requiredEvidence.join(' ')).toContain('admin-prod-1of1');
    expect(bindingCheck?.requiredEvidence.join(' ')).not.toContain('admin-dev-1of1');
    expect(bindingCheck?.check).toContain('rejects dev/open ballot artifacts');
    expect(bindingCheck?.check).toContain('protected aggregate/SP-07 path');

    expect(nonBindingCheck?.requiredEvidence.join(' ')).toContain('admin-dev-1of1');
    expect(nonBindingCheck?.requiredEvidence.join(' ')).not.toContain('admin-prod-1of1');
    expect(nonBindingCheck?.check).toContain('allows explicit dev/open ballot artifacts');
    expect(nonBindingCheck?.check).toContain('dev-mode published-ballot tally fallback');
  });

  it('uses the profile gate status in the header when checks have warnings', () => {
    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.direct.binding"
        gate={clientGate}
        initialResponse={getProfileResponse('hushvoting.direct.binding')}
        credentialsPublicKey="npub-1"
      />
    );

    expect(screen.getByTestId('readiness-profile-gate-status')).toHaveTextContent(
      'amber / with_warnings'
    );
    expect(screen.queryByText('green / passed')).not.toBeInTheDocument();
    expect(screen.getByText('Warning checks')).toBeInTheDocument();
    expect(screen.getByText('Disabled / N/A').closest('div')).toHaveTextContent('2');
  });

  it('keeps a not-observed Veritas profile gate in the header when evidence checks warn', () => {
    const source = createReadinessDashboardFixtureSource();
    const baseProfile = source.register.claimProfiles?.find(
      (profile) => profile.profileId === 'hushvoting.direct.binding'
    );

    if (!baseProfile) {
      throw new Error('Expected fixture binding profile was not found.');
    }

    source.register.claimProfiles?.push({
      ...baseProfile,
      profileId: 'hushvoting.veritas_3_of_5.non_binding',
      label: 'Non-Binding HushVoting! Veritas 3/5',
      productMode: 'HushVoting! Veritas',
      governanceEffect: 'non_binding',
      bindingStatus: 'Non-Binding',
      isNonBindingElection: true,
      thresholdProfile: '3/5',
      gateSeverity: 'amber',
      gateStatus: 'not_observed',
      claimWording:
        'The non-binding Veritas 3/5 profile is tracked, but no accepted runtime rehearsal evidence is bound to it in the current accepted evidence baseline.',
      limitationWording:
        'Requires a Veritas 3/5 threshold ceremony, trustee evidence, bindingStatus Non-Binding, and isNonBindingElection true.',
      evidenceRefs: [],
      requiredEvidence: [
        'productMode == HushVoting! Veritas',
        'thresholdProfile == 3/5',
        'bindingStatus == Non-Binding',
        'isNonBindingElection == true',
      ],
      verifierWarningCount: 0,
      verifierWarnings: [],
    });

    const detail = buildReadinessProfileDetail(
      source,
      'hushvoting.veritas_3_of_5.non_binding'
    );

    if (!detail) {
      throw new Error('Expected Veritas profile detail to be built.');
    }

    expect(detail.assessment.status).toBe('incomplete');
    expect(
      detail.checks.find((check) => check.checkId === 'profile-gate-runtime-evidence')
    ).toMatchObject({
      status: 'not_observed',
      tone: 'amber',
    });

    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.veritas_3_of_5.non_binding"
        gate={clientGate}
        initialResponse={{
          success: true,
          state: 'ready',
          detail,
        }}
        credentialsPublicKey="npub-1"
      />
    );

    expect(screen.getByRole('heading', { name: 'Non-Binding HushVoting! Veritas 3/5' })).toBeInTheDocument();
    expect(screen.getByTestId('readiness-profile-gate-status')).toHaveTextContent(
      'amber / not_observed'
    );
    expect(screen.getByText('Warning checks')).toBeInTheDocument();
  });

  it('uses package-bound Veritas 500 non-binding evidence instead of stale generic lifecycle warnings', () => {
    const source = createReadinessDashboardFixtureSource();
    const baseProfile = source.register.claimProfiles?.find(
      (profile) => profile.profileId === 'hushvoting.direct.binding'
    );

    if (!baseProfile) {
      throw new Error('Expected fixture binding profile was not found.');
    }

    source.register.evidenceItems.push(
      createEvidenceItem({
        evidenceId: 'RDY-EVID-AT-RDY-011-FEAT-139-001',
        featureId: 'FEAT-139',
        sourceGapRow: 'Governed outcome and continuity evidence',
        status: 'blocked',
        acceptanceGateIds: ['AT-RDY-011'],
        dimensionIds: ['RDY-DIM-009'],
        producedAt: '2026-05-25T00:00:00Z',
        freshness: {
          state: 'stale',
          invalidationRule: 'Event-based invalidation when failed-finalize evidence changes.',
          staleReason: 'freshness stale after feat146',
        },
        residualRisk: 'Failed-finalize outcome evidence remains absent.',
      })
    );

    source.register.claimProfiles?.push({
      ...baseProfile,
      profileId: 'hushvoting.veritas_3_of_5.non_binding',
      label: 'Non-Binding HushVoting! Veritas 3/5',
      productMode: 'HushVoting! Veritas',
      governanceEffect: 'non_binding',
      bindingStatus: 'Non-Binding',
      isNonBindingElection: true,
      thresholdProfile: '3/5',
      gateSeverity: 'green',
      gateStatus: 'passed',
      claimWording:
        'HushVoting! Veritas 500, Non-Binding IV binds finalized runtime evidence for the internal technical Veritas 3/5 rehearsal profile.',
      limitationWording:
        'The pass is limited to internal non-binding rehearsal evidence.',
      evidenceRefs: veritas500NonBindingEvidenceRefs,
      requiredEvidence: [
        'productMode == HushVoting! Veritas',
        'thresholdProfile == 3/5',
        'bindingStatus == Non-Binding',
        'isNonBindingElection == true',
        'acceptedTrusteeCount == 5',
        'acceptedFinalizationShareCount == 3',
        'package warningCount == 0',
      ],
      verifierWarningCount: 0,
      verifierWarnings: [],
    });

    const detail = buildReadinessProfileDetail(
      source,
      'hushvoting.veritas_3_of_5.non_binding'
    );

    if (!detail) {
      throw new Error('Expected Veritas profile detail to be built.');
    }

    const profileGate = detail.checks.find(
      (check) => check.checkId === 'profile-gate-runtime-evidence'
    );
    const cryptoPathCheck = detail.checks.find(
      (check) => check.checkId === 'binding-mode-circuit-crypto-validation'
    );
    const lifecycleCheck = detail.checks.find(
      (check) => check.checkId === 'election-lifecycle-tally-version-consistency'
    );
    const trusteeCheck = detail.checks.find(
      (check) => check.checkId === 'veritas-trustee-ceremony-acceptance'
    );

    expect(profileGate).toMatchObject({ status: 'passed', tone: 'green' });
    expect(cryptoPathCheck).toMatchObject({ status: 'passed', tone: 'green' });
    expect(lifecycleCheck).toMatchObject({ status: 'passed', tone: 'green' });
    expect(trusteeCheck).toMatchObject({ status: 'passed', tone: 'green' });
    expect(cryptoPathCheck?.evidenceRefs.join(' ')).toContain('VerifierInputManifest.json');
    expect(cryptoPathCheck?.evidenceRefs.join(' ')).toContain('trustee-control-profile.json');
    expect(lifecycleCheck?.evidenceItems).toEqual([]);
    expect(lifecycleCheck?.evidenceRefs.join(' ')).toContain('tally-replay.json');
    expect(trusteeCheck?.evidenceRefs.join(' ')).toContain('trustee-release-evidence.json');

    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.veritas_3_of_5.non_binding"
        gate={clientGate}
        initialResponse={{
          success: true,
          state: 'ready',
          detail,
        }}
        credentialsPublicKey="npub-1"
      />
    );

    expect(screen.getByTestId('readiness-profile-gate-status')).toHaveTextContent(
      'green / passed'
    );
  });

  it('reports current accepted replacement evidence instead of older observed rows', () => {
    const source = createReadinessDashboardFixtureSource();
    const receiptEvidence = source.register.evidenceItems.find(
      (item) => item.evidenceId === 'RDY-EVID-AT-RDY-008-FEAT-136-001'
    );

    if (!receiptEvidence) {
      throw new Error('Expected fixture receipt evidence row was not found.');
    }

    receiptEvidence.status = 'accepted';
    receiptEvidence.producedAt = '2026-06-04T12:00:00Z';
    receiptEvidence.sourceGapRow = 'Cross-device receipt/inclusion verification';
    receiptEvidence.claimEffect = 'score_increase';

    source.register.evidenceItems.push(
      createEvidenceItem({
        evidenceId: 'RDY-EVID-AT-RDY-007-FEAT-112-001',
        featureId: 'FEAT-112',
        status: 'observed',
        producedAt: '2026-05-18T22:00:00Z',
        residualRisk: 'Runnable public sample and tamper corpus remain incomplete.',
        claimEffect: 'none',
        checkResults: [
          {
            checkId: 'CHK-RDY-007-BASELINE',
            status: 'warn',
            summary:
              'Protocol package exists, but public sample and tamper corpus still need accepted delivery evidence.',
            detailsRef: 'readiness-register',
          },
        ],
      }),
      createEvidenceItem({
        evidenceId: 'RDY-EVID-AT-RDY-007-FEAT-158-001',
        featureId: 'FEAT-158',
        status: 'accepted',
        producedAt: '2026-06-04T12:00:00Z',
        residualRisk: 'Current accepted verifier corpus proof is bound to the readiness report.',
        checkResults: [
          {
            checkId: 'CHK-RDY-007-AUDIT95',
            status: 'pass',
            summary: 'Current verifier corpus evidence is accepted and bound to the report.',
            detailsRef: 'readiness-register',
          },
        ],
      })
    );

    const detail = buildReadinessProfileDetail(source, 'hushvoting.direct.binding');
    const verifierCheck = detail?.checks.find(
      (check) => check.checkId === 'verifier-receipt-package-integrity'
    );
    const evidenceIds = verifierCheck?.evidenceItems.map((item) => item.evidenceId) ?? [];

    expect(verifierCheck?.status).toBe('passed');
    expect(evidenceIds).toContain('RDY-EVID-AT-RDY-007-FEAT-158-001');
    expect(evidenceIds).not.toContain('RDY-EVID-AT-RDY-007-FEAT-112-001');
  });

  it('treats rehearsal-accepted and disabled profile checks as pass-equivalent overall', () => {
    const source = createReadinessDashboardFixtureSource();
    const profile = source.register.claimProfiles?.find(
      (item) => item.profileId === 'hushvoting.direct.binding'
    );
    const receiptEvidence = source.register.evidenceItems.find(
      (item) => item.evidenceId === 'RDY-EVID-AT-RDY-008-FEAT-136-001'
    );

    if (!profile || !receiptEvidence) {
      throw new Error('Expected fixture profile and receipt evidence were not found.');
    }

    profile.gateSeverity = 'green';
    profile.gateStatus = 'passed';
    profile.verifierWarningCount = 0;
    profile.verifierWarnings = [];
    receiptEvidence.status = 'accepted';
    receiptEvidence.producedAt = '2026-06-04T12:00:00Z';
    receiptEvidence.claimEffect = 'score_increase';
    source.register.evidenceItems.push(
      createEvidenceItem({
        evidenceId: 'RDY-EVID-AT-RDY-007-FEAT-158-001',
        featureId: 'FEAT-158',
      }),
      createEvidenceItem({
        evidenceId: 'RDY-EVID-AT-RDY-006-FEAT-163-001',
        featureId: 'FEAT-163',
        sourceGapRow: 'Operational readiness package',
        acceptanceGateIds: ['AT-RDY-006'],
        dimensionIds: ['RDY-DIM-007'],
      })
    );

    const detail = buildReadinessProfileDetail(source, 'hushvoting.direct.binding');

    expect(detail?.assessment).toMatchObject({
      severity: 'green',
      status: 'passed',
      label: 'passed',
    });
    expect(detail?.checks.some((check) => check.status === 'rehearsal_accepted')).toBe(true);
    expect(detail?.checks.some((check) => check.status === 'disabled')).toBe(true);
    expect(detail?.checks.some((check) => check.status === 'not_applicable')).toBe(true);
  });

  it('shows the row-level reason for warning evidence rows', () => {
    const response = getProfileResponse('hushvoting.direct.binding');
    const verifierCheck = response.detail.checks.find(
      (check) => check.checkId === 'verifier-receipt-package-integrity'
    );
    const warningItem = verifierCheck?.evidenceItems.find((item) => item.status === 'observed');

    if (!warningItem) {
      throw new Error('Expected fixture warning evidence row was not found.');
    }

    warningItem.sourceGapRow = 'Verifier/sample/tamper corpus';
    warningItem.residualRisk = 'Runnable public sample and tamper corpus remain incomplete.';
    warningItem.checkResults = [
      {
        checkId: 'CHK-RDY-007-BASELINE',
        status: 'warn',
        summary:
          'Protocol package exists, but public sample and tamper corpus still need accepted delivery evidence.',
        detailsRef: 'readiness-register',
      },
    ];

    render(
      <ReadinessProfileCheckPage
        profileId="hushvoting.direct.binding"
        gate={clientGate}
        initialResponse={response}
        credentialsPublicKey="npub-1"
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Expand Verifier, receipt, and package integrity',
      })
    );

    expect(screen.getByText('observed')).toBeInTheDocument();
    expect(screen.getByText(/Evidence is observed but not accepted/i)).toBeInTheDocument();
    expect(screen.getByText('Why this is warning-level')).toBeInTheDocument();
    expect(screen.getByText('What tamper corpus means')).toBeInTheDocument();
    expect(
      screen.getByText(/controlled set of deliberately modified verifier packages/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/not evidence that someone attacked an election/i)).toBeInTheDocument();
    expect(screen.getByText('Proposed resolution')).toBeInTheDocument();
    expect(screen.getByText(/Promote the accepted verifier-corpus evidence/i)).toBeInTheDocument();
  });
});

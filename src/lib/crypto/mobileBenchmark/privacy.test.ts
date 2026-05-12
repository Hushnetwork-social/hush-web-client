import { describe, expect, it } from 'vitest';
import {
  MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
  type MobileBenchmarkReport,
  type MobileElectionCryptoOperationResult,
} from './contracts.ts';
import {
  assertMobileBenchmarkReportExportable,
  findUnsupportedMobileBenchmarkClaims,
  sanitizeMobileElectionCryptoOperationResult,
  scanMobileBenchmarkReportPrivacy,
  validateMobileBenchmarkReportForExport,
} from './privacy.ts';

function createReport(overrides?: Partial<MobileBenchmarkReport>): MobileBenchmarkReport {
  return {
    schemaVersion: MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
    reportId: 'report-privacy',
    generatedAt: '2026-05-12T07:30:00.000Z',
    benchmarkRole: 'auditor',
    implementationPath: 'tauri_webview_wasm',
    pathStatus: 'measured',
    deviceClass: 'tablet',
    benchmarkApp: {
      name: 'HushVoting mobile benchmark',
      version: '0.1.0',
      buildId: 'local-dev',
      releaseIntegrityMode: 'development_placeholder',
      notForReleaseIntegrityClaims: true,
    },
    protocolPackage: {
      packageId: 'omega-hushvoting-v1',
      version: 'v1.1.12',
      manifestHash: 'b'.repeat(64),
      spCoverage: [],
    },
    environment: [],
    scenarios: [],
    maturityGapStatus: {
      externalReview: 'planned',
      operationalEvidence: 'referenced_with_limitations',
      regulatoryTracking: 'referenced_with_limitations',
      feat106Readiness: 'not_complete',
      legalValidation: 'not_available',
      certification: 'not_available',
      publicElectionParity: 'not_claimed',
    },
    summary: {
      assurancePositioning:
        'Synthetic local benchmark evidence for architecture comparison only.',
      warnings: [],
    },
    ...overrides,
  };
}

describe('FEAT-121 mobile benchmark privacy and claim boundaries', () => {
  it('blocks export when forbidden report fields are present', () => {
    const report = {
      ...createReport(),
      scenarios: [
        {
          scenarioId: 'scenario-privacy',
          title: 'Privacy check',
          status: 'passed',
          implementationPath: 'browser_fallback_wasm',
          pathStatus: 'measured',
          warnings: [],
          operations: [
            {
              operationId: 'op-private',
              scenarioId: 'scenario-privacy',
              operationKind: 'proof_generation',
              status: 'passed',
              startedAt: '2026-05-12T07:30:01.000Z',
              durationMs: 1,
              resultCode: 'bad_fixture',
              metrics: [],
              publicOutput: {
                vote_secret: 'should-never-export',
              },
            },
          ],
        },
      ],
    } satisfies MobileBenchmarkReport;

    const validation = validateMobileBenchmarkReportForExport(report);

    expect(validation.exportable).toBe(false);
    expect(validation.privacy.findings).toContainEqual(
      expect.objectContaining({
        path: 'scenarios[0].operations[0].publicOutput.vote_secret',
        code: 'forbidden_field',
      })
    );
    expect(() => assertMobileBenchmarkReportExportable(report)).toThrow(
      /Mobile benchmark report export blocked/
    );
  });

  it('blocks claim wording that implies certification, legal approval, or FEAT-106 completion', () => {
    const findings = findUnsupportedMobileBenchmarkClaims([
      {
        path: 'summary',
        text: 'Mobile ready, certified, legally validated, and FEAT-106 complete.',
      },
    ]);

    expect(findings.map((finding) => finding.phrase)).toEqual(
      expect.arrayContaining([
        'mobile ready',
        'certified',
        'legally validated',
        'feat-106 complete',
      ])
    );
  });

  it('allows non-claim maturity wording for SP-09, SP-10, and SP-11 references', () => {
    const report = createReport({
      summary: {
        assurancePositioning:
          'References external review, operational evidence, and regulatory tracking as separate maturity dimensions with limitations.',
        warnings: [
          'This benchmark does not complete legal validation, certification, or FEAT-106 readiness.',
        ],
      },
    });

    const validation = validateMobileBenchmarkReportForExport(report);

    expect(validation.exportable).toBe(true);
    expect(validation.claimFindings).toHaveLength(0);
  });

  it('keeps MobileElectionCrypto public operation output free of private material', () => {
    const result: MobileElectionCryptoOperationResult<Record<string, unknown>> = {
      operationId: 'op-proof',
      operationKind: 'proof_generation',
      status: 'passed',
      startedAt: '2026-05-12T07:30:01.000Z',
      durationMs: 20,
      resultCode: 'proof_generated',
      metrics: [],
      publicOutput: {
        proofHash: 'sha256:proof',
        publicInputsHash: 'sha256:public-inputs',
      },
    };

    expect(sanitizeMobileElectionCryptoOperationResult(result)).toBe(result);
    expect(() =>
      sanitizeMobileElectionCryptoOperationResult({
        ...result,
        publicOutput: {
          proofHash: 'sha256:proof',
          rawAttestationToken: 'raw-token',
        },
      })
    ).toThrow(/forbidden report output/);
  });

  it('detects forbidden values even when the field name is generic', () => {
    const scan = scanMobileBenchmarkReportPrivacy({
      notes: 'raw attestation token was attached by mistake',
    });

    expect(scan.status).toBe('blocked');
    expect(scan.findings[0]).toMatchObject({
      path: 'notes',
      code: 'forbidden_value',
    });
  });
});

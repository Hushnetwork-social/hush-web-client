import { describe, expect, it } from 'vitest';
import { FEAT107_FIXTURE_VERSION } from '@/lib/crypto/elections';
import {
  createMobileBenchmarkFixtureCatalog,
  createMobileBenchmarkProtocolPackageCoverage,
  createPublicTestVectorSecretFixture,
  getMobileBenchmarkFixturesForScenario,
  getMobileBenchmarkSpCoverageForScenario,
  getScenarioCoverageMatrix,
  summarizeCoverageByStatus,
  validateMobileBenchmarkFixtureCatalogPrivacy,
  validateMobileBenchmarkFixturePrivacy,
} from './fixtures.ts';
import { scanMobileBenchmarkReportPrivacy } from './privacy.ts';

describe('FEAT-121 mobile benchmark fixture catalog', () => {
  it('builds deterministic primitive fixtures from FEAT-107 without exporting private test data', () => {
    const first = createMobileBenchmarkFixtureCatalog()[0];
    const second = createMobileBenchmarkFixtureCatalog()[0];

    expect(first.fixtureId).toBe('feat107-primitive-election-crypto-v1');
    expect(first.fixtureHash).toBe(second.fixtureHash);
    expect(first.publicData.fixtureVersion).toBe(FEAT107_FIXTURE_VERSION);
    expect(first.publicData).not.toHaveProperty('testOnly');
    expect(first.excludedPrivateMaterial).toEqual(
      expect.arrayContaining(['testOnly.privateKey', 'testOnly.encryptionNonceSeed'])
    );
    expect(scanMobileBenchmarkReportPrivacy(first.publicData).status).toBe('passed');
  });

  it('maps SP-03 through SP-08 fixture refs to the required scenarios', () => {
    expect(getMobileBenchmarkSpCoverageForScenario('scenario-09')).toContainEqual(
      expect.objectContaining({ spId: 'SP-04', status: 'covered' })
    );
    expect(getMobileBenchmarkSpCoverageForScenario('scenario-10')).toContainEqual(
      expect.objectContaining({ spId: 'SP-05', status: 'covered' })
    );
    expect(getMobileBenchmarkSpCoverageForScenario('scenario-11')).toContainEqual(
      expect.objectContaining({ spId: 'SP-03', status: 'covered' })
    );
    expect(getMobileBenchmarkSpCoverageForScenario('scenario-12')).toContainEqual(
      expect.objectContaining({ spId: 'SP-07', status: 'covered' })
    );
    expect(getMobileBenchmarkSpCoverageForScenario('scenario-13')).toContainEqual(
      expect.objectContaining({ spId: 'SP-08', status: 'covered' })
    );
    expect(getMobileBenchmarkSpCoverageForScenario('scenario-14')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ spId: 'SP-06', status: 'covered' }),
        expect.objectContaining({ spId: 'SP-07', status: 'covered' }),
      ])
    );
  });

  it('creates a scenario coverage matrix for all 14 benchmark scenarios', () => {
    const matrix = getScenarioCoverageMatrix();

    expect(Object.keys(matrix)).toHaveLength(14);
    expect(matrix['scenario-01']).toContainEqual(
      expect.objectContaining({ status: 'not_applicable' })
    );
    expect(getMobileBenchmarkFixturesForScenario('scenario-13')[0].fixtureId).toBe(
      'sp08-synthetic-release-integrity-v1'
    );
  });

  it('keeps protocol package version and manifest hash on every coverage record', () => {
    const coverage = createMobileBenchmarkProtocolPackageCoverage([
      'scenario-09',
      'scenario-10',
      'scenario-11',
      'scenario-12',
      'scenario-13',
      'scenario-14',
    ]);

    expect(coverage.length).toBeGreaterThanOrEqual(6);
    expect(
      coverage.every(
        (item) => item.packageVersion === 'v1.1.12' && item.packageHash.length === 64
      )
    ).toBe(true);
  });

  it('summarizes every SP coverage state without dropping gap semantics', () => {
    const summary = summarizeCoverageByStatus([
      {
        spId: 'SP-03',
        status: 'covered',
        packageVersion: 'v1.1.12',
        packageHash: 'a'.repeat(64),
        fixtureRef: 'covered',
      },
      {
        spId: 'SP-04',
        status: 'fixture_gap',
        packageVersion: 'v1.1.12',
        packageHash: 'a'.repeat(64),
        fixtureRef: 'fixture-gap',
      },
      {
        spId: 'SP-05',
        status: 'schema_gap',
        packageVersion: 'v1.1.12',
        packageHash: 'a'.repeat(64),
        fixtureRef: 'schema-gap',
      },
      {
        spId: 'SP-06',
        status: 'not_applicable',
        packageVersion: 'v1.1.12',
        packageHash: 'a'.repeat(64),
        fixtureRef: 'not-applicable',
      },
      {
        spId: 'SP-07',
        status: 'not_run',
        packageVersion: 'v1.1.12',
        packageHash: 'a'.repeat(64),
        fixtureRef: 'not-run',
      },
    ]);

    expect(summary).toEqual({
      covered: 1,
      fixture_gap: 1,
      schema_gap: 1,
      not_applicable: 1,
      not_run: 1,
    });
  });

  it('passes privacy validation for the default synthetic catalog', () => {
    expect(validateMobileBenchmarkFixtureCatalogPrivacy()).toHaveLength(0);
  });

  it('rejects real identifiers and forbidden private material in fixture public data', () => {
    const [base] = createMobileBenchmarkFixtureCatalog();
    const issues = validateMobileBenchmarkFixturePrivacy({
      ...base,
      fixtureId: 'bad-fixture',
      publicData: {
        electionId: 'election-prod-123',
        organizationId: 'hush-network-real-org',
        privateWitness: 'not allowed',
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'real_election_identifier' }),
        expect.objectContaining({ code: 'real_organization_identifier' }),
        expect.objectContaining({ code: 'forbidden_fixture_material' }),
      ])
    );
  });

  it('allows public test-vector secrets only when explicitly marked', () => {
    expect(validateMobileBenchmarkFixturePrivacy(createPublicTestVectorSecretFixture(true))).toHaveLength(
      0
    );
    expect(validateMobileBenchmarkFixturePrivacy(createPublicTestVectorSecretFixture(false))).toContainEqual(
      expect.objectContaining({
        code: 'unmarked_public_test_vector_secret',
      })
    );
  });
});

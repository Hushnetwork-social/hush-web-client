import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { buildControlledElectionFixturePack } from '../elections/index.ts';
import {
  MOBILE_BENCHMARK_SCENARIO_IDS,
  type MobileBenchmarkScenarioId,
  type MobileBenchmarkSpCoverage,
  type MobileBenchmarkSpCoverageStatus,
  type MobileBenchmarkSpId,
} from './contracts.ts';
import { scanMobileBenchmarkReportPrivacy } from './privacy.ts';

export const MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF = {
  packageId: 'protocol-omega-hushvoting-v1',
  packageVersion: 'v1.1.12',
  specPackageHash: '828643bee4a2b3ad031df326da563b52f2d0537dd24a09cbb6cea4534b270c90',
  proofPackageHash: '392d2a66db6a9a0db3097c2863a33b1451d68b81bfee778e5b5e8a9cdfe20475',
  releaseManifestHash: '1690cb419d533febe5e3771ac3df352c83ddb3cdb02a252501907cff6f80a7ef',
} as const;

export type MobileBenchmarkFixtureSourceFeature =
  | 'FEAT-107'
  | 'FEAT-113'
  | 'FEAT-114'
  | 'FEAT-115'
  | 'FEAT-116'
  | 'FEAT-117'
  | 'FEAT-118';

export type MobileBenchmarkFixtureKind =
  | 'primitive_crypto_public_vector'
  | 'sp03_election_record_verifier'
  | 'sp04_challenge_spoil'
  | 'sp05_eligibility_checkoff'
  | 'sp06_trustee_resilience'
  | 'sp07_publication_counting'
  | 'sp08_release_integrity';

export interface MobileBenchmarkProtocolPackageRef {
  packageId: typeof MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageId;
  packageVersion: typeof MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageVersion;
  manifestHash: typeof MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.releaseManifestHash;
}

export interface MobileBenchmarkFixtureCatalogEntry {
  fixtureId: string;
  title: string;
  sourceFeature: MobileBenchmarkFixtureSourceFeature;
  fixtureKind: MobileBenchmarkFixtureKind;
  scenarioIds: MobileBenchmarkScenarioId[];
  fixtureHash: string;
  publicTestVector: boolean;
  publicTestVectorSecretPolicy: 'no_secret_material' | 'public_test_vector_only';
  protocolPackage: MobileBenchmarkProtocolPackageRef;
  spCoverage: MobileBenchmarkSpCoverage[];
  publicData: Record<string, unknown>;
  excludedPrivateMaterial: string[];
}

export interface MobileBenchmarkFixturePrivacyIssue {
  fixtureId: string;
  path: string;
  code:
    | 'forbidden_fixture_material'
    | 'real_election_identifier'
    | 'real_organization_identifier'
    | 'unmarked_public_test_vector_secret';
  message: string;
}

const encoder = new TextEncoder();

const protocolPackage = {
  packageId: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageId,
  packageVersion: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageVersion,
  manifestHash: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.releaseManifestHash,
} as const;

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJsonStringify(child)}`)
    .join(',')}}`;
}

export function stableMobileBenchmarkFixtureHash(value: unknown): string {
  return bytesToHex(sha256(encoder.encode(stableJsonStringify(value))));
}

function coverage(
  spId: MobileBenchmarkSpId,
  status: MobileBenchmarkSpCoverageStatus,
  fixtureRef: string,
  notes?: string
): MobileBenchmarkSpCoverage {
  return {
    spId,
    status,
    packageVersion: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageVersion,
    packageHash: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.releaseManifestHash,
    fixtureRef,
    notes,
  };
}

function buildPrimitivePublicData(): Record<string, unknown> {
  const fixturePack = buildControlledElectionFixturePack({
    seed: 107n,
    choiceIndex: 2,
    profile: 'PRODUCTION_LIKE_PROFILE',
    decodeTier: 'CLUB_ROLLOUT_TIER',
    encryptionNonceSeed: 700n,
    rerandomizationNonceSeed: 900n,
  });

  return {
    fixtureVersion: fixturePack.fixtureVersion,
    profile: fixturePack.profile,
    decodeTier: fixturePack.decodeTier,
    circuitVersion: fixturePack.circuitVersion,
    deterministic: fixturePack.deterministic,
    generatedAt: fixturePack.generatedAt,
    publicKey: fixturePack.publicKey,
    ballot: fixturePack.ballot,
    rerandomizedBallot: fixturePack.rerandomizedBallot,
    expectedAggregateTally: fixturePack.expectedAggregateTally,
  };
}

function entry(
  input: Omit<MobileBenchmarkFixtureCatalogEntry, 'fixtureHash' | 'protocolPackage'>
): MobileBenchmarkFixtureCatalogEntry {
  const hashInput = {
    fixtureId: input.fixtureId,
    sourceFeature: input.sourceFeature,
    fixtureKind: input.fixtureKind,
    scenarioIds: input.scenarioIds,
    spCoverage: input.spCoverage,
    publicData: input.publicData,
  };

  return {
    ...input,
    fixtureHash: stableMobileBenchmarkFixtureHash(hashInput),
    protocolPackage,
  };
}

export function createMobileBenchmarkFixtureCatalog(): MobileBenchmarkFixtureCatalogEntry[] {
  const primitivePublicData = buildPrimitivePublicData();

  return [
    entry({
      fixtureId: 'feat107-primitive-election-crypto-v1',
      title: 'FEAT-107 deterministic primitive election crypto vector',
      sourceFeature: 'FEAT-107',
      fixtureKind: 'primitive_crypto_public_vector',
      scenarioIds: [
        'scenario-02',
        'scenario-03',
        'scenario-04',
        'scenario-05',
        'scenario-06',
        'scenario-07',
      ],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [
        coverage('SP-05', 'covered', 'feat107-primitive-election-crypto-v1'),
        coverage('SP-07', 'fixture_gap', 'feat107-primitive-election-crypto-v1'),
      ],
      publicData: primitivePublicData,
      excludedPrivateMaterial: [
        'testOnly.seed',
        'testOnly.privateKey',
        'testOnly.encryptionNonceSeed',
        'testOnly.rerandomizationNonceSeed',
      ],
    }),
    entry({
      fixtureId: 'sp04-synthetic-challenge-spoil-v1',
      title: 'SP-04 synthetic challenge/spoil package profile',
      sourceFeature: 'FEAT-114',
      fixtureKind: 'sp04_challenge_spoil',
      scenarioIds: ['scenario-09'],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [coverage('SP-04', 'covered', 'sp04-synthetic-challenge-spoil-v1')],
      publicData: {
        syntheticElectionId: 'synthetic-election-sp04-challenge-spoil',
        receiptCommitmentScheme: 'hushvoting-sp04-receipt-commitment-sha256-v1',
        expectedResultCodes: ['challenge_transcript_valid', 'spoiled_ballot_not_counted'],
      },
      excludedPrivateMaterial: ['vote_secret', 'private witness data', 'real vote choice'],
    }),
    entry({
      fixtureId: 'sp05-synthetic-eligibility-checkoff-v1',
      title: 'SP-05 synthetic eligibility/checkoff profile',
      sourceFeature: 'FEAT-115',
      fixtureKind: 'sp05_eligibility_checkoff',
      scenarioIds: ['scenario-10'],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [coverage('SP-05', 'covered', 'sp05-synthetic-eligibility-checkoff-v1')],
      publicData: {
        syntheticElectionId: 'synthetic-election-sp05-checkoff',
        anonymousCommitmentSetHash: 'sha256:synthetic-sp05-commitment-set',
        restrictedRosterRef: 'restricted:synthetic-sp05-roster-not-exported',
        expectedResultCodes: ['eligibility_checkoff_boundary_valid'],
      },
      excludedPrivateMaterial: ['named voter roster', 'voter/device join', 'real organization id'],
    }),
    entry({
      fixtureId: 'sp03-synthetic-election-record-verifier-v1',
      title: 'SP-03 synthetic election record and verifier profile',
      sourceFeature: 'FEAT-113',
      fixtureKind: 'sp03_election_record_verifier',
      scenarioIds: ['scenario-11'],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [coverage('SP-03', 'covered', 'sp03-synthetic-election-record-verifier-v1')],
      publicData: {
        syntheticElectionId: 'synthetic-election-sp03-record',
        verifierPackageRef: 'synthetic-sp03-verifier-package',
        expectedResultCodes: ['verification_package_valid', 'tamper_fixture_rejected'],
      },
      excludedPrivateMaterial: ['restricted package bytes', 'named checkoff roster'],
    }),
    entry({
      fixtureId: 'sp07-synthetic-publication-counting-v1',
      title: 'SP-07 synthetic publication-proof/counting profile',
      sourceFeature: 'FEAT-117',
      fixtureKind: 'sp07_publication_counting',
      scenarioIds: ['scenario-12'],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [coverage('SP-07', 'covered', 'sp07-synthetic-publication-counting-v1')],
      publicData: {
        syntheticElectionId: 'synthetic-election-sp07-publication',
        transcriptHash: 'sha256:synthetic-sp07-transcript',
        proofHash: 'sha256:synthetic-sp07-proof',
        expectedResultCodes: ['publication_proof_evidence_valid'],
      },
      excludedPrivateMaterial: ['witness material', 'shuffle map', 'private randomness'],
    }),
    entry({
      fixtureId: 'sp08-synthetic-release-integrity-v1',
      title: 'SP-08 synthetic release-integrity profile',
      sourceFeature: 'FEAT-118',
      fixtureKind: 'sp08_release_integrity',
      scenarioIds: ['scenario-08', 'scenario-13'],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [coverage('SP-08', 'covered', 'sp08-synthetic-release-integrity-v1')],
      publicData: {
        syntheticElectionId: 'synthetic-election-sp08-release',
        releaseManifestHash: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.releaseManifestHash,
        releaseIntegrityModes: ['development_placeholder', 'official_sp08'],
        expectedResultCodes: [
          'release_integrity_evidence_valid',
          'release_integrity_evidence_pending',
        ],
      },
      excludedPrivateMaterial: ['raw attestation token', 'raw device identifier'],
    }),
    entry({
      fixtureId: 'sp06-synthetic-trustee-resilience-v1',
      title: 'SP-06 synthetic trustee resilience profile',
      sourceFeature: 'FEAT-116',
      fixtureKind: 'sp06_trustee_resilience',
      scenarioIds: ['scenario-14'],
      publicTestVector: true,
      publicTestVectorSecretPolicy: 'no_secret_material',
      spCoverage: [
        coverage('SP-06', 'covered', 'sp06-synthetic-trustee-resilience-v1'),
        coverage('SP-07', 'covered', 'sp06-synthetic-trustee-resilience-v1'),
      ],
      publicData: {
        syntheticElectionId: 'synthetic-election-sp06-trustee-resilience',
        trusteeProfileId: 'high_assurance_independent_trustees_v1',
        threshold: 3,
        trusteeCount: 5,
        expectedOutcomes: {
          exactlyThreshold: 'finalizes',
          oneMissingNonRequired: 'finalizes',
          belowThreshold: 'fail_closed',
          staleShare: 'rejected',
          duplicateShare: 'rejected',
          wrongTargetShare: 'rejected',
        },
      },
      excludedPrivateMaterial: ['raw trustee share', 'trustee private material'],
    }),
  ];
}

export function getMobileBenchmarkFixturesForScenario(
  scenarioId: MobileBenchmarkScenarioId,
  catalog = createMobileBenchmarkFixtureCatalog()
): MobileBenchmarkFixtureCatalogEntry[] {
  return catalog.filter((fixture) => fixture.scenarioIds.includes(scenarioId));
}

export function getMobileBenchmarkSpCoverageForScenario(
  scenarioId: MobileBenchmarkScenarioId,
  catalog = createMobileBenchmarkFixtureCatalog()
): MobileBenchmarkSpCoverage[] {
  const coverageByKey = new Map<string, MobileBenchmarkSpCoverage>();

  for (const fixture of getMobileBenchmarkFixturesForScenario(scenarioId, catalog)) {
    for (const item of fixture.spCoverage) {
      coverageByKey.set(`${item.spId}:${item.fixtureRef}`, item);
    }
  }

  if (coverageByKey.size === 0) {
    return [
      coverage(
        'SP-03',
        'not_applicable',
        `no-sp-coverage-${scenarioId}`,
        'Scenario has no direct SP package fixture requirement.'
      ),
    ];
  }

  return [...coverageByKey.values()];
}

export function getScenarioCoverageMatrix(
  catalog = createMobileBenchmarkFixtureCatalog()
): Record<MobileBenchmarkScenarioId, MobileBenchmarkSpCoverage[]> {
  return Object.fromEntries(
    MOBILE_BENCHMARK_SCENARIO_IDS.map((scenarioId) => [
      scenarioId,
      getMobileBenchmarkSpCoverageForScenario(scenarioId, catalog),
    ])
  ) as Record<MobileBenchmarkScenarioId, MobileBenchmarkSpCoverage[]>;
}

export function summarizeCoverageByStatus(
  coverageItems: MobileBenchmarkSpCoverage[]
): Record<MobileBenchmarkSpCoverageStatus, number> {
  const summary: Record<MobileBenchmarkSpCoverageStatus, number> = {
    covered: 0,
    fixture_gap: 0,
    schema_gap: 0,
    not_applicable: 0,
    not_run: 0,
  };

  for (const item of coverageItems) {
    summary[item.status] += 1;
  }

  return summary;
}

export function validateMobileBenchmarkFixturePrivacy(
  fixture: MobileBenchmarkFixtureCatalogEntry
): MobileBenchmarkFixturePrivacyIssue[] {
  const issues: MobileBenchmarkFixturePrivacyIssue[] = [];
  const privacyScan = scanMobileBenchmarkReportPrivacy(fixture.publicData, 'publicData');

  for (const finding of privacyScan.findings) {
    issues.push({
      fixtureId: fixture.fixtureId,
      path: finding.path,
      code: 'forbidden_fixture_material',
      message: `Fixture public data contains forbidden material pattern ${finding.pattern}.`,
    });
  }

  const electionId = fixture.publicData.electionId;
  if (typeof electionId === 'string' && !electionId.startsWith('synthetic-')) {
    issues.push({
      fixtureId: fixture.fixtureId,
      path: 'publicData.electionId',
      code: 'real_election_identifier',
      message: 'Fixture election identifiers must be synthetic.',
    });
  }

  const organizationId = fixture.publicData.organizationId;
  if (
    typeof organizationId === 'string' &&
    !organizationId.startsWith('synthetic-') &&
    !organizationId.startsWith('fixture-')
  ) {
    issues.push({
      fixtureId: fixture.fixtureId,
      path: 'publicData.organizationId',
      code: 'real_organization_identifier',
      message: 'Fixture organization identifiers must be synthetic or fixture-scoped.',
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(fixture.publicData, 'publicTestVectorSecret') &&
    (!fixture.publicTestVector ||
      fixture.publicTestVectorSecretPolicy !== 'public_test_vector_only')
  ) {
    issues.push({
      fixtureId: fixture.fixtureId,
      path: 'publicData.publicTestVectorSecret',
      code: 'unmarked_public_test_vector_secret',
      message: 'Public test-vector secrets require explicit public fixture marking.',
    });
  }

  return issues;
}

export function validateMobileBenchmarkFixtureCatalogPrivacy(
  catalog = createMobileBenchmarkFixtureCatalog()
): MobileBenchmarkFixturePrivacyIssue[] {
  return catalog.flatMap((fixture) => validateMobileBenchmarkFixturePrivacy(fixture));
}

export function createMobileBenchmarkProtocolPackageCoverage(
  scenarioIds: MobileBenchmarkScenarioId[],
  catalog = createMobileBenchmarkFixtureCatalog()
): MobileBenchmarkSpCoverage[] {
  return scenarioIds.flatMap((scenarioId) =>
    getMobileBenchmarkSpCoverageForScenario(scenarioId, catalog)
  );
}

export function createPublicTestVectorSecretFixture(
  marked: boolean
): MobileBenchmarkFixtureCatalogEntry {
  return entry({
    fixtureId: marked
      ? 'public-test-vector-secret-marked'
      : 'public-test-vector-secret-unmarked',
    title: 'Public test-vector secret policy fixture',
    sourceFeature: 'FEAT-107',
    fixtureKind: 'primitive_crypto_public_vector',
    scenarioIds: ['scenario-02'],
    publicTestVector: marked,
    publicTestVectorSecretPolicy: marked ? 'public_test_vector_only' : 'no_secret_material',
    spCoverage: [coverage('SP-05', 'covered', 'public-test-vector-secret')],
    publicData: {
      syntheticElectionId: 'synthetic-election-public-vector',
      publicTestVectorSecret: 'fixed-public-vector-secret',
    },
    excludedPrivateMaterial: [],
  });
}

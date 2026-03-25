import {
  getGenerator,
  getIdentity,
  isIdentity,
  isOnCurve,
  pointToKey,
  scalarMul,
  type Point,
} from '../reactions/babyjubjub.ts';
import {
  addCiphertexts,
  decrypt,
  encrypt,
  rerandomizeVectorCiphertext,
  type VectorCiphertext,
} from '../reactions/elgamal.ts';
import {
  FEAT107_CIRCUIT_VERSION_BY_PROFILE,
  FEAT107_CURVE_ORDER,
  FEAT107_DECODE_TIERS,
  FEAT107_DETERMINISTIC_GENERATED_AT,
  FEAT107_FIXTURE_VERSION,
  FEAT107_SELECTION_COUNT,
} from './constants.ts';

export type ElectionProofProfile = 'DEV_SMOKE_PROFILE' | 'PRODUCTION_LIKE_PROFILE';
export type ElectionDecodeTier = 'DEV_SMOKE_TIER' | 'CLUB_ROLLOUT_TIER' | 'UPPER_SUPPORTED_TIER';

export interface SerializedElectionPoint {
  x: string;
  y: string;
}

export interface SerializedElectionVectorCiphertext {
  c1: SerializedElectionPoint[];
  c2: SerializedElectionPoint[];
}

export interface ControlledElectionBallotFixture {
  choiceIndex: number;
  selectionCount: number;
  ciphertext: SerializedElectionVectorCiphertext;
  nonces: string[];
  expectedPlaintextSlots: string[];
}

export interface ControlledElectionFixturePack {
  fixtureVersion: string;
  profile: ElectionProofProfile;
  decodeTier: ElectionDecodeTier;
  decodeBound: string;
  circuitVersion: string;
  deterministic: true;
  generatedAt: string;
  publicKey: SerializedElectionPoint;
  ballot: ControlledElectionBallotFixture;
  rerandomizedBallot: ControlledElectionBallotFixture;
  expectedAggregateTally: string[];
  testOnly: {
    seed: string;
    privateKey: string;
    encryptionNonceSeed: string;
    rerandomizationNonceSeed: string;
  };
}

export interface ControlledElectionKeyPair {
  privateKey: bigint;
  publicKey: Point;
}

export interface ControlledElectionFixtureOptions {
  seed: bigint;
  choiceIndex: number;
  profile?: ElectionProofProfile;
  decodeTier?: ElectionDecodeTier;
  selectionCount?: number;
  encryptionNonceSeed?: bigint;
  rerandomizationNonceSeed?: bigint;
}

export interface ControlledBallotEncryptionOptions {
  nonceSeed?: bigint;
  nonces?: bigint[];
  selectionCount?: number;
}

function mod(n: bigint, p: bigint): bigint {
  const result = n % p;
  return result >= 0n ? result : result + p;
}

export function normalizeControlledScalar(seed: bigint): bigint {
  return mod(seed, FEAT107_CURVE_ORDER - 1n) + 1n;
}

export function createControlledElectionKeyPair(seed: bigint): ControlledElectionKeyPair {
  const privateKey = normalizeControlledScalar(seed);
  const publicKey = scalarMul(getGenerator(), privateKey);

  return {
    privateKey,
    publicKey,
  };
}

export function createDeterministicNonceSequence(seed: bigint, count: number): bigint[] {
  assertPositiveCount(count, 'count');

  const start = normalizeControlledScalar(seed);
  return Array.from({ length: count }, (_, index) =>
    normalizeControlledScalar(start + BigInt(index))
  );
}

export function encryptOneHotElectionBallot(
  choiceIndex: number,
  publicKey: Point,
  options: ControlledBallotEncryptionOptions = {}
): { ciphertext: VectorCiphertext; nonces: bigint[]; expectedPlaintextSlots: bigint[] } {
  const selectionCount = options.selectionCount ?? FEAT107_SELECTION_COUNT;
  const nonces =
    options.nonces ?? createDeterministicNonceSequence(options.nonceSeed ?? 1n, selectionCount);

  assertValidPublicKey(publicKey);
  assertSelectionCount(selectionCount);
  assertChoiceIndex(choiceIndex, selectionCount);
  assertValidNonceList(nonces, selectionCount, 'encryption');

  const c1: Point[] = [];
  const c2: Point[] = [];
  const expectedPlaintextSlots: bigint[] = [];

  for (let index = 0; index < selectionCount; index++) {
    const value = index === choiceIndex ? 1n : 0n;
    const ciphertext = encrypt(value, publicKey, nonces[index]);
    c1.push(ciphertext.c1);
    c2.push(ciphertext.c2);
    expectedPlaintextSlots.push(value);
  }

  return {
    ciphertext: { c1, c2 },
    nonces,
    expectedPlaintextSlots,
  };
}

export function rerandomizeElectionBallot(
  ciphertext: VectorCiphertext,
  publicKey: Point,
  options: ControlledBallotEncryptionOptions = {}
): { ciphertext: VectorCiphertext; nonces: bigint[] } {
  const slotCount = ciphertext.c1.length;
  const nonces =
    options.nonces ?? createDeterministicNonceSequence(options.nonceSeed ?? 1000n, slotCount);

  assertValidPublicKey(publicKey);
  assertVectorCiphertextShape(ciphertext);
  assertValidNonceList(nonces, slotCount, 'rerandomization');

  return rerandomizeVectorCiphertext(ciphertext, publicKey, nonces);
}

export function decryptControlledElectionBallot(
  ciphertext: VectorCiphertext,
  privateKey: bigint
): bigint[] {
  assertVectorCiphertextShape(ciphertext);

  return ciphertext.c1.map((_, index) => {
    const decryptedPoint = decrypt(
      {
        c1: ciphertext.c1[index],
        c2: ciphertext.c2[index],
      },
      privateKey
    );

    if (isIdentity(decryptedPoint)) {
      return 0n;
    }

    if (pointToKey(decryptedPoint) === pointToKey(getGenerator())) {
      return 1n;
    }

    throw new Error(
      `Controlled ballot slot ${index} decrypted to an unsupported point outside the 0/1 test harness`
    );
  });
}

export function accumulateElectionBallots(ballots: VectorCiphertext[]): VectorCiphertext {
  if (ballots.length === 0) {
    throw new Error('At least one ballot is required to accumulate an election tally');
  }

  const selectionCount = ballots[0].c1.length;
  ballots.forEach(assertVectorCiphertextShape);

  return ballots.reduce<VectorCiphertext>(
    (aggregate, ballot) => {
      if (ballot.c1.length !== selectionCount) {
        throw new Error('All ballots must have the same selection count');
      }

      return {
        c1: aggregate.c1.map((point, index) => addCiphertexts(
          { c1: point, c2: aggregate.c2[index] },
          { c1: ballot.c1[index], c2: ballot.c2[index] }
        ).c1),
        c2: aggregate.c2.map((point, index) => addCiphertexts(
          { c1: aggregate.c1[index], c2: point },
          { c1: ballot.c1[index], c2: ballot.c2[index] }
        ).c2),
      };
    },
    {
      c1: Array.from({ length: selectionCount }, () => getIdentity()),
      c2: Array.from({ length: selectionCount }, () => getIdentity()),
    }
  );
}

export function buildControlledElectionFixturePack(
  options: ControlledElectionFixtureOptions
): ControlledElectionFixturePack {
  const profile = options.profile ?? 'DEV_SMOKE_PROFILE';
  const decodeTier = options.decodeTier ?? 'DEV_SMOKE_TIER';
  const selectionCount = options.selectionCount ?? FEAT107_SELECTION_COUNT;
  const encryptionNonceSeed = options.encryptionNonceSeed ?? 101n;
  const rerandomizationNonceSeed = options.rerandomizationNonceSeed ?? 1001n;
  const keyPair = createControlledElectionKeyPair(options.seed);
  const encryptedBallot = encryptOneHotElectionBallot(options.choiceIndex, keyPair.publicKey, {
    nonceSeed: encryptionNonceSeed,
    selectionCount,
  });
  const rerandomizedBallot = rerandomizeElectionBallot(
    encryptedBallot.ciphertext,
    keyPair.publicKey,
    {
      nonceSeed: rerandomizationNonceSeed,
    }
  );
  const expectedPlaintextSlots = decryptControlledElectionBallot(
    encryptedBallot.ciphertext,
    keyPair.privateKey
  );

  return {
    fixtureVersion: FEAT107_FIXTURE_VERSION,
    profile,
    decodeTier,
    decodeBound: FEAT107_DECODE_TIERS[decodeTier].toString(),
    circuitVersion: FEAT107_CIRCUIT_VERSION_BY_PROFILE[profile],
    deterministic: true,
    generatedAt: FEAT107_DETERMINISTIC_GENERATED_AT,
    publicKey: serializePoint(keyPair.publicKey),
    ballot: serializeBallotFixture({
      choiceIndex: options.choiceIndex,
      selectionCount,
      ciphertext: encryptedBallot.ciphertext,
      nonces: encryptedBallot.nonces,
      expectedPlaintextSlots,
    }),
    rerandomizedBallot: serializeBallotFixture({
      choiceIndex: options.choiceIndex,
      selectionCount,
      ciphertext: rerandomizedBallot.ciphertext,
      nonces: rerandomizedBallot.nonces,
      expectedPlaintextSlots,
    }),
    expectedAggregateTally: expectedPlaintextSlots.map((slot) => slot.toString()),
    testOnly: {
      seed: normalizeControlledScalar(options.seed).toString(),
      privateKey: keyPair.privateKey.toString(),
      encryptionNonceSeed: normalizeControlledScalar(encryptionNonceSeed).toString(),
      rerandomizationNonceSeed: normalizeControlledScalar(rerandomizationNonceSeed).toString(),
    },
  };
}

export function generateControlledElectionFixtureJson(
  options: ControlledElectionFixtureOptions
): string {
  return JSON.stringify(buildControlledElectionFixturePack(options), null, 2);
}

export function serializePoint(point: Point): SerializedElectionPoint {
  return {
    x: point.x.toString(),
    y: point.y.toString(),
  };
}

export function serializeVectorCiphertext(
  ciphertext: VectorCiphertext
): SerializedElectionVectorCiphertext {
  assertVectorCiphertextShape(ciphertext);

  return {
    c1: ciphertext.c1.map(serializePoint),
    c2: ciphertext.c2.map(serializePoint),
  };
}

function serializeBallotFixture(ballot: {
  choiceIndex: number;
  selectionCount: number;
  ciphertext: VectorCiphertext;
  nonces: bigint[];
  expectedPlaintextSlots: bigint[];
}): ControlledElectionBallotFixture {
  return {
    choiceIndex: ballot.choiceIndex,
    selectionCount: ballot.selectionCount,
    ciphertext: serializeVectorCiphertext(ballot.ciphertext),
    nonces: ballot.nonces.map((nonce) => nonce.toString()),
    expectedPlaintextSlots: ballot.expectedPlaintextSlots.map((slot) => slot.toString()),
  };
}

function assertPositiveCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected ${label} to be a positive integer, received '${value}'`);
  }
}

function assertSelectionCount(selectionCount: number): void {
  assertPositiveCount(selectionCount, 'selectionCount');
}

function assertChoiceIndex(choiceIndex: number, selectionCount: number): void {
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= selectionCount) {
    throw new Error(
      `Choice index '${choiceIndex}' must be an integer between 0 and ${selectionCount - 1}`
    );
  }
}

function assertValidPublicKey(publicKey: Point): void {
  if (!isOnCurve(publicKey) || isIdentity(publicKey)) {
    throw new Error('Controlled election public key must be a non-identity point on the curve');
  }
}

function assertVectorCiphertextShape(ciphertext: VectorCiphertext): void {
  if (ciphertext.c1.length === 0 || ciphertext.c1.length !== ciphertext.c2.length) {
    throw new Error('Vector ciphertext must have matching non-zero c1 and c2 lengths');
  }

  for (const point of [...ciphertext.c1, ...ciphertext.c2]) {
    if (!isOnCurve(point)) {
      throw new Error('Vector ciphertext contains a point that is not on the curve');
    }
  }
}

function assertValidNonceList(nonces: bigint[], expectedCount: number, label: string): void {
  if (nonces.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} ${label} nonces, received ${nonces.length}`);
  }

  const seen = new Set<string>();

  for (const nonce of nonces) {
    if (nonce <= 0n || nonce >= FEAT107_CURVE_ORDER) {
      throw new Error(
        `${label} nonce '${nonce.toString()}' must be greater than 0 and below the curve order`
      );
    }

    const nonceKey = nonce.toString();
    if (seen.has(nonceKey)) {
      throw new Error(`Duplicate ${label} nonce '${nonceKey}' is not allowed in the controlled harness`);
    }

    seen.add(nonceKey);
  }
}

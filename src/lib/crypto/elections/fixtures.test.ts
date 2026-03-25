import { describe, expect, it } from 'vitest';

import { CIRCUIT } from '../reactions/constants';
import { getGenerator, getIdentity, pointToKey, type Point } from '../reactions';
import {
  FEAT107_CIRCUIT_VERSION_BY_PROFILE,
  FEAT107_DEPRECATED_FIXTURE_VERSION,
  FEAT107_DETERMINISTIC_GENERATED_AT,
  FEAT107_FIXTURE_VERSION,
  FEAT107_VULNERABLE_FIXTURE_VERSION,
  buildControlledElectionFixturePack,
  createControlledElectionKeyPair,
  createDeterministicNonceSequence,
  decryptControlledElectionBallot,
  encryptOneHotElectionBallot,
  generateControlledElectionFixtureJson,
  rerandomizeElectionBallot,
} from './index';

describe('FEAT-107 election fixture helpers', () => {
  it('creates the same deterministic key pair for the same seed', () => {
    const firstKeyPair = createControlledElectionKeyPair(17n);
    const secondKeyPair = createControlledElectionKeyPair(17n);

    expect(firstKeyPair.privateKey).toBe(secondKeyPair.privateKey);
    expect(pointToKey(firstKeyPair.publicKey)).toBe(pointToKey(secondKeyPair.publicKey));
  });

  it('encrypts and decrypts a controlled one-hot ballot without the full UI shell', () => {
    const keyPair = createControlledElectionKeyPair(101n);
    const encryptedBallot = encryptOneHotElectionBallot(2, keyPair.publicKey, {
      nonces: [11n, 12n, 13n, 14n, 15n, 16n],
    });

    expect(decryptControlledElectionBallot(encryptedBallot.ciphertext, keyPair.privateKey)).toEqual([
      0n,
      0n,
      1n,
      0n,
      0n,
      0n,
    ]);
  });

  it('does not recover the original meaning with the wrong private key', () => {
    const correctKeyPair = createControlledElectionKeyPair(111n);
    const wrongKeyPair = createControlledElectionKeyPair(222n);
    const encryptedBallot = encryptOneHotElectionBallot(2, correctKeyPair.publicKey, {
      nonces: [17n, 18n, 19n, 20n, 21n, 22n],
    });

    expect(() =>
      decryptControlledElectionBallot(encryptedBallot.ciphertext, wrongKeyPair.privateKey)
    ).toThrow(/unsupported point outside the 0\/1 test harness/);
  });

  it('rerandomizes a ballot while preserving one-hot semantics', () => {
    const keyPair = createControlledElectionKeyPair(202n);
    const encryptedBallot = encryptOneHotElectionBallot(4, keyPair.publicKey, {
      nonces: [21n, 22n, 23n, 24n, 25n, 26n],
    });
    const rerandomizedBallot = rerandomizeElectionBallot(encryptedBallot.ciphertext, keyPair.publicKey, {
      nonces: [121n, 122n, 123n, 124n, 125n, 126n],
    });

    expect(
      pointToKey(rerandomizedBallot.ciphertext.c1[4])
    ).not.toBe(pointToKey(encryptedBallot.ciphertext.c1[4]));
    expect(
      pointToKey(rerandomizedBallot.ciphertext.c2[4])
    ).not.toBe(pointToKey(encryptedBallot.ciphertext.c2[4]));
    expect(decryptControlledElectionBallot(rerandomizedBallot.ciphertext, keyPair.privateKey)).toEqual([
      0n,
      0n,
      0n,
      0n,
      1n,
      0n,
    ]);
  });

  it('encrypts the same ballot meaning with different randomness into different ciphertexts', () => {
    const keyPair = createControlledElectionKeyPair(211n);
    const firstBallot = encryptOneHotElectionBallot(2, keyPair.publicKey, {
      nonces: [31n, 32n, 33n, 34n, 35n, 36n],
    });
    const secondBallot = encryptOneHotElectionBallot(2, keyPair.publicKey, {
      nonces: [41n, 42n, 43n, 44n, 45n, 46n],
    });

    expect(pointToKey(firstBallot.ciphertext.c1[2])).not.toBe(pointToKey(secondBallot.ciphertext.c1[2]));
    expect(pointToKey(firstBallot.ciphertext.c2[2])).not.toBe(pointToKey(secondBallot.ciphertext.c2[2]));
    expect(decryptControlledElectionBallot(firstBallot.ciphertext, keyPair.privateKey)).toEqual([
      0n,
      0n,
      1n,
      0n,
      0n,
      0n,
    ]);
    expect(decryptControlledElectionBallot(secondBallot.ciphertext, keyPair.privateKey)).toEqual([
      0n,
      0n,
      1n,
      0n,
      0n,
      0n,
    ]);
  });

  it('builds a deterministic fixture pack with version and profile metadata', () => {
    const fixturePack = buildControlledElectionFixturePack({
      seed: 303n,
      choiceIndex: 1,
      profile: 'PRODUCTION_LIKE_PROFILE',
      decodeTier: 'CLUB_ROLLOUT_TIER',
    });

    expect(fixturePack.fixtureVersion).toBe(FEAT107_FIXTURE_VERSION);
    expect(fixturePack.profile).toBe('PRODUCTION_LIKE_PROFILE');
    expect(fixturePack.decodeTier).toBe('CLUB_ROLLOUT_TIER');
    expect(fixturePack.decodeBound).toBe('5000');
    expect(fixturePack.circuitVersion).toBe(CIRCUIT.version);
    expect(fixturePack.generatedAt).toBe(FEAT107_DETERMINISTIC_GENERATED_AT);
    expect(fixturePack.expectedAggregateTally).toEqual(['0', '1', '0', '0', '0', '0']);
    expect(fixturePack.testOnly.privateKey).not.toBe('0');
  });

  it('allows explicit supported, deprecated, and vulnerable fixture policy tags', () => {
    expect(
      buildControlledElectionFixturePack({
        seed: 307n,
        choiceIndex: 0,
        fixtureVersion: FEAT107_DEPRECATED_FIXTURE_VERSION,
      }).fixtureVersion
    ).toBe(FEAT107_DEPRECATED_FIXTURE_VERSION);

    expect(
      buildControlledElectionFixturePack({
        seed: 308n,
        choiceIndex: 0,
        fixtureVersion: FEAT107_VULNERABLE_FIXTURE_VERSION,
      }).fixtureVersion
    ).toBe(FEAT107_VULNERABLE_FIXTURE_VERSION);

    expect(() =>
      buildControlledElectionFixturePack({
        seed: 309n,
        choiceIndex: 0,
        fixtureVersion: 'feat-107.experimental',
      })
    ).toThrow(
      "Controlled fixture version 'feat-107.experimental' is not part of the FEAT-107 interoperability policy"
    );
  });

  it.each([
    ['DEV_SMOKE_PROFILE', 'DEV_SMOKE_PROFILE'],
    ['PRODUCTION_LIKE_PROFILE', 'PRODUCTION_LIKE_PROFILE'],
  ] as const)('keeps rerandomized fixture semantics stable for %s', (_, profile) => {
    const fixturePack = buildControlledElectionFixturePack({
      seed: 333n,
      choiceIndex: 5,
      profile,
    });
    const originalCiphertext = fixturePack.ballot.ciphertext;
    const rerandomizedCiphertext = fixturePack.rerandomizedBallot.ciphertext;

    expect(FEAT107_CIRCUIT_VERSION_BY_PROFILE[profile]).toBe(fixturePack.circuitVersion);
    expect(rerandomizedCiphertext.c1[5].x).not.toBe(originalCiphertext.c1[5].x);
    expect(rerandomizedCiphertext.c2[5].y).not.toBe(originalCiphertext.c2[5].y);
    expect(fixturePack.rerandomizedBallot.expectedPlaintextSlots).toEqual(
      fixturePack.ballot.expectedPlaintextSlots
    );
    expect(fixturePack.expectedAggregateTally).toEqual(['0', '0', '0', '0', '0', '1']);
  });

  it('generates deterministic fixture JSON for the script-first path', () => {
    const fixtureJson = generateControlledElectionFixtureJson({
      seed: 404n,
      choiceIndex: 3,
      profile: 'DEV_SMOKE_PROFILE',
    });

    const parsed = JSON.parse(fixtureJson) as {
      fixtureVersion: string;
      profile: string;
      circuitVersion: string;
      ballot: { expectedPlaintextSlots: string[] };
    };

    expect(parsed.fixtureVersion).toBe(FEAT107_FIXTURE_VERSION);
    expect(parsed.profile).toBe('DEV_SMOKE_PROFILE');
    expect(parsed.circuitVersion).toBe(FEAT107_CIRCUIT_VERSION_BY_PROFILE.DEV_SMOKE_PROFILE);
    expect(parsed.ballot.expectedPlaintextSlots).toEqual(['0', '0', '0', '1', '0', '0']);
  });

  it('rejects an out-of-range choice index', () => {
    const keyPair = createControlledElectionKeyPair(505n);

    expect(() => encryptOneHotElectionBallot(6, keyPair.publicKey)).toThrow(
      "Choice index '6' must be an integer between 0 and 5"
    );
  });

  it('rejects invalid public keys before crypto operations run', () => {
    expect(() =>
      encryptOneHotElectionBallot(0, {
        x: getIdentity().x,
        y: getIdentity().y,
      })
    ).toThrow('Controlled election public key must be a non-identity point on the curve');

    const invalidPoint: Point = {
      x: getGenerator().x,
      y: getGenerator().y + 1n,
    };

    expect(() => encryptOneHotElectionBallot(0, invalidPoint)).toThrow(
      'Controlled election public key must be a non-identity point on the curve'
    );
  });

  it('rejects unsafe nonce inputs in the controlled harness', () => {
    const keyPair = createControlledElectionKeyPair(606n);

    expect(() =>
      encryptOneHotElectionBallot(0, keyPair.publicKey, {
        nonces: [0n, 12n, 13n, 14n, 15n, 16n],
      })
    ).toThrow("encryption nonce '0' must be greater than 0 and below the curve order");

    expect(() =>
      rerandomizeElectionBallot(
        encryptOneHotElectionBallot(1, keyPair.publicKey, {
          nonces: [31n, 32n, 33n, 34n, 35n, 36n],
        }).ciphertext,
        keyPair.publicKey,
        {
          nonces: [91n, 92n, 93n, 94n, 95n, 95n],
        }
      )
    ).toThrow("Duplicate rerandomization nonce '95' is not allowed in the controlled harness");
  });

  it('creates stable deterministic nonce sequences for fixed seeds', () => {
    expect(createDeterministicNonceSequence(707n, 4)).toEqual([709n, 710n, 711n, 712n]);
  });
});

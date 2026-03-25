import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from '../src/lib/crypto/vendor/circomlibjs-poseidon/buildPoseidon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BABYJUBJUB = {
  a: 168700n,
  d: 168696n,
  p: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
  generator: {
    x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
    y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n,
  },
};

const IDENTITY = { x: 0n, y: 1n };
const CIRCUIT_VERSION = 'omega-v1.0.0';
const TREE_DEPTH = 20;
const DOMAIN_NULLIFIER = 1213481800n;

function mod(a, p = BABYJUBJUB.p) {
  const result = a % p;
  return result >= 0n ? result : result + p;
}

function modInverse(a, p = BABYJUBJUB.p) {
  let oldR = a;
  let r = p;
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  return mod(oldS, p);
}

function addPoints(p1, p2) {
  const { a, d, p } = BABYJUBJUB;
  const x1y2 = mod(p1.x * p2.y);
  const y1x2 = mod(p1.y * p2.x);
  const y1y2 = mod(p1.y * p2.y);
  const x1x2 = mod(p1.x * p2.x);
  const dxy = mod(d * mod(p1.x * p2.x) * mod(p1.y * p2.y));

  const x3Num = mod(x1y2 + y1x2);
  const x3Den = mod(1n + dxy);
  const x3 = mod(x3Num * modInverse(x3Den, p));

  const y3Num = mod(y1y2 - mod(a * x1x2));
  const y3Den = mod(1n - dxy);
  const y3 = mod(y3Num * modInverse(y3Den, p));

  return { x: x3, y: y3 };
}

function doublePoint(point) {
  return addPoints(point, point);
}

function scalarMul(point, scalar) {
  if (scalar === 0n) {
    return { ...IDENTITY };
  }

  if (scalar < 0n) {
    return scalarMul({ x: mod(-point.x), y: point.y }, -scalar);
  }

  let result = { ...IDENTITY };
  let current = { ...point };
  let k = scalar;

  while (k > 0n) {
    if (k & 1n) {
      result = addPoints(result, current);
    }
    current = doublePoint(current);
    k >>= 1n;
  }

  return result;
}

function getGenerator() {
  return { ...BABYJUBJUB.generator };
}

function getIdentity() {
  return { ...IDENTITY };
}

function encrypt(message, publicKey, nonce) {
  const c1 = scalarMul(getGenerator(), nonce);
  const mG = message === 0n ? getIdentity() : scalarMul(getGenerator(), message);
  const rPk = scalarMul(publicKey, nonce);
  const c2 = addPoints(mG, rPk);
  return { c1, c2 };
}

let poseidonInstancePromise = null;

async function poseidonHash(inputs) {
  if (!poseidonInstancePromise) {
    poseidonInstancePromise = buildPoseidon();
  }

  const poseidon = await poseidonInstancePromise;
  const result = poseidon(inputs);
  return poseidon.F.toObject(result);
}

async function computeCommitment(userSecret) {
  return poseidonHash([userSecret]);
}

async function computeNullifier(userSecret, messageId, feedId) {
  return poseidonHash([userSecret, messageId, feedId, DOMAIN_NULLIFIER]);
}

async function buildMerkleProof(leaf) {
  const pathElements = [];
  const pathIndices = [];
  let current = leaf;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const sibling = BigInt(level + 1);
    pathElements.push(sibling);
    pathIndices.push(level % 2);
    current =
      level % 2 === 0
        ? await poseidonHash([current, sibling])
        : await poseidonHash([sibling, current]);
  }

  return {
    root: current,
    pathElements,
    pathIndices,
  };
}

async function createFixture(kind) {
  const emojiIndex = kind === 'update' ? 1 : 0;
  const nonces =
    kind === 'update'
      ? [21n, 22n, 23n, 24n, 25n, 26n]
      : [11n, 12n, 13n, 14n, 15n, 16n];

  const userSecret = 123456789n;
  const authorSecret = 987654321n;
  const reactionScopeId = 222222222222222222n;
  const feedPrivateKey = 333333333333333333n;
  const feedPublicKey = scalarMul(getGenerator(), feedPrivateKey);
  const userCommitment = await computeCommitment(userSecret);
  const authorCommitment = await computeCommitment(authorSecret);
  const merkleProof = await buildMerkleProof(userCommitment);
  const ciphertexts = nonces.map((nonce, index) =>
    encrypt(index === emojiIndex ? 1n : 0n, feedPublicKey, nonce)
  );
  const nullifier = await computeNullifier(userSecret, reactionScopeId, reactionScopeId);

  return {
    label: kind,
    inputs: {
      nullifier: nullifier.toString(),
      ciphertext_c1: ciphertexts.map((ciphertext) => [
        ciphertext.c1.x.toString(),
        ciphertext.c1.y.toString(),
      ]),
      ciphertext_c2: ciphertexts.map((ciphertext) => [
        ciphertext.c2.x.toString(),
        ciphertext.c2.y.toString(),
      ]),
      message_id: reactionScopeId.toString(),
      feed_id: reactionScopeId.toString(),
      feed_pk: [feedPublicKey.x.toString(), feedPublicKey.y.toString()],
      members_root: merkleProof.root.toString(),
      author_commitment: authorCommitment.toString(),
      user_secret: userSecret.toString(),
      emoji_index: emojiIndex.toString(),
      encryption_nonce: nonces.map((nonce) => nonce.toString()),
      merkle_path: merkleProof.pathElements.map((element) => element.toString()),
      merkle_indices: merkleProof.pathIndices,
    },
    summary: {
      nullifier: nullifier.toString(),
      membersRoot: merkleProof.root.toString(),
      emojiIndex,
      merkleDepth: merkleProof.pathElements.length,
    },
  };
}

function resolveArtifacts(workspaceRoot, circuitVersion) {
  const basePath = path.join(workspaceRoot, 'public', 'circuits', circuitVersion);
  return {
    wasmPath: path.join(basePath, 'reaction.wasm'),
    zkeyPath: path.join(basePath, 'reaction.zkey'),
  };
}

async function sha256(filePath) {
  const file = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(file).digest('hex').toUpperCase();
}

async function assertFileExists(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} circuit artifact not found at '${filePath}'`);
  }
}

function parseArgs(argv) {
  const args = {
    fixture: 'first',
    inputPath: null,
    workspaceRoot: path.resolve(__dirname, '..'),
    circuitVersion: CIRCUIT_VERSION,
    outputPath: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--fixture') {
      args.fixture = argv[++i] ?? args.fixture;
    } else if (arg === '--input') {
      args.inputPath = argv[++i] ?? null;
    } else if (arg === '--workspace-root') {
      args.workspaceRoot = path.resolve(argv[++i]);
    } else if (arg === '--circuit-version') {
      args.circuitVersion = argv[++i] ?? args.circuitVersion;
    } else if (arg === '--output') {
      args.outputPath = path.resolve(argv[++i]);
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/benchmark-reaction-proof.mjs [options]

Options:
  --fixture <first|update>       Use built-in deterministic fixture (default: first)
  --input <path>                 Load inputs JSON instead of built-in fixture
  --workspace-root <path>        Repo root containing public/circuits (default: hush-web-client root)
  --circuit-version <version>    Circuit version to load (default: ${CIRCUIT_VERSION})
  --output <path>                Write proof result JSON to a file
  --help                         Show this help
`);
}

async function loadInputs(args) {
  if (args.inputPath) {
    const raw = JSON.parse(await fs.readFile(args.inputPath, 'utf8'));
    return {
      label: path.basename(args.inputPath),
      inputs: raw.inputs ?? raw,
      summary: {
        nullifier: raw.inputs?.nullifier ?? raw.nullifier ?? '<unknown>',
        membersRoot: raw.inputs?.members_root ?? raw.members_root ?? '<unknown>',
        emojiIndex: raw.inputs?.emoji_index ?? raw.emoji_index ?? '<unknown>',
        merkleDepth: raw.inputs?.merkle_path?.length ?? raw.merkle_path?.length ?? '<unknown>',
      },
    };
  }

  return createFixture(args.fixture);
}

async function main() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv);
  const fixture = await loadInputs(args);
  const artifacts = resolveArtifacts(args.workspaceRoot, args.circuitVersion);

  await assertFileExists(artifacts.wasmPath, 'WASM');
  await assertFileExists(artifacts.zkeyPath, 'zkey');

  const wasmSha256 = await sha256(artifacts.wasmPath);
  const zkeySha256 = await sha256(artifacts.zkeyPath);

  console.log('=== Reaction Proof Harness ===');
  console.log(`Fixture: ${fixture.label}`);
  console.log(`Circuit version: ${args.circuitVersion}`);
  console.log(`WASM path: ${artifacts.wasmPath}`);
  console.log(`WASM sha256: ${wasmSha256}`);
  console.log(`zkey path: ${artifacts.zkeyPath}`);
  console.log(`zkey sha256: ${zkeySha256}`);
  console.log(
    `Input summary: emojiIndex=${fixture.summary.emojiIndex}, merkleDepth=${fixture.summary.merkleDepth}, nullifier=${String(fixture.summary.nullifier).slice(0, 32)}..., membersRoot=${String(fixture.summary.membersRoot).slice(0, 32)}...`
  );

  const witnessPath = path.join(args.workspaceRoot, '.tmp-reaction-proof-harness.wtns');

  try {
    const witnessStartedAt = Date.now();
    await snarkjs.wtns.calculate(fixture.inputs, artifacts.wasmPath, witnessPath);
    console.log(`Witness generation: ${Date.now() - witnessStartedAt}ms`);

    const proveStartedAt = Date.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      fixture.inputs,
      artifacts.wasmPath,
      artifacts.zkeyPath
    );
    console.log(`fullProve: ${Date.now() - proveStartedAt}ms`);
    console.log(`Public signals count: ${publicSignals.length}`);
    console.log(`Public signal[0]/nullifier: ${publicSignals[0]}`);

    if (args.outputPath) {
      await fs.writeFile(
        args.outputPath,
        JSON.stringify(
          {
            fixture: fixture.label,
            circuitVersion: args.circuitVersion,
            wasmSha256,
            zkeySha256,
            publicSignals,
            proof,
          },
          null,
          2
        )
      );
      console.log(`Wrote proof output to: ${args.outputPath}`);
    }

    console.log(`Total harness time: ${Date.now() - startedAt}ms`);
  } finally {
    await fs.rm(witnessPath, { force: true });
  }
}

await main().catch((error) => {
  console.error('Harness failed:', error);
  process.exit(1);
});

process.exit(0);

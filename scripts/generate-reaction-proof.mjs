import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import snarkjs from 'snarkjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [, , inputPath, outputPath, circuitVersionArg] = process.argv;

  if (!inputPath || !outputPath) {
    process.stderr.write('Usage: node scripts/generate-reaction-proof.mjs <inputs.json> <output.json> [circuitVersion]\n');
    process.exit(2);
  }

  const workspaceRoot = path.resolve(__dirname, '..');
  const circuitVersion = circuitVersionArg ?? 'omega-v1.0.0';
  const inputs = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const artifacts = resolveHeadlessArtifacts(workspaceRoot, circuitVersion);
  await assertFileExists(artifacts.wasmPath, 'WASM');
  await assertFileExists(artifacts.zkeyPath, 'zkey');

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    artifacts.wasmPath,
    artifacts.zkeyPath
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        circuitVersion,
        publicSignals,
        proof: Buffer.from(packGroth16Proof(proof)).toString('base64'),
      },
      null,
      2
    )
  );
}

function resolveHeadlessArtifacts(workspaceRoot, circuitVersion) {
  const basePath = path.join(workspaceRoot, 'public', 'circuits', circuitVersion);
  return {
    wasmPath: path.join(basePath, 'reaction.wasm'),
    zkeyPath: path.join(basePath, 'reaction.zkey'),
  };
}

async function assertFileExists(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} circuit artifact not found at '${filePath}'`);
  }
}

function packGroth16Proof(proof) {
  const buffer = new ArrayBuffer(256);
  let offset = 0;

  for (let i = 0; i < 2; i++) {
    const bytes = bigintToBytes32(BigInt(proof.pi_a[i]));
    new Uint8Array(buffer, offset, 32).set(bytes);
    offset += 32;
  }

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const bytes = bigintToBytes32(BigInt(proof.pi_b[i][j]));
      new Uint8Array(buffer, offset, 32).set(bytes);
      offset += 32;
    }
  }

  for (let i = 0; i < 2; i++) {
    const bytes = bigintToBytes32(BigInt(proof.pi_c[i]));
    new Uint8Array(buffer, offset, 32).set(bytes);
    offset += 32;
  }

  return new Uint8Array(buffer);
}

function bigintToBytes32(n) {
  const bytes = new Uint8Array(32);
  let temp = n;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  return bytes;
}

await main();

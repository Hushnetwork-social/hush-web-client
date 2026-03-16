import fs from 'node:fs/promises';
import path from 'node:path';
import { CIRCUIT } from '../crypto/reactions/constants';
import { getApprovedCircuitArtifacts } from './artifactManifest';
import { packGroth16Proof } from './proofPacking';
import type { CircuitInputs, Groth16Proof, ProofResult } from './types';

type SnarkJsGroth16 = {
  fullProve(
    input: CircuitInputs,
    wasmFile: string,
    zkeyFile: string
  ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
};

type SnarkJsModule = {
  groth16: SnarkJsGroth16;
};

export interface HeadlessProverOptions {
  workspaceRoot?: string;
  circuitVersion?: string;
}

export async function generateHeadlessProof(
  inputs: CircuitInputs,
  options: HeadlessProverOptions = {}
): Promise<ProofResult> {
  const circuitVersion = options.circuitVersion ?? CIRCUIT.version;
  const workspaceRoot = options.workspaceRoot ?? resolveWorkspaceRootFromCurrentFile();
  const artifacts = resolveHeadlessArtifacts(workspaceRoot, circuitVersion);
  const snarkjs = await loadSnarkJs();

  await assertFileExists(artifacts.wasmPath, 'WASM');
  await assertFileExists(artifacts.zkeyPath, 'zkey');

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    artifacts.wasmPath,
    artifacts.zkeyPath
  );

  return {
    proof: packGroth16Proof(proof),
    publicSignals,
    circuitVersion,
  };
}

export function resolveHeadlessArtifacts(workspaceRoot: string, circuitVersion: string) {
  const artifacts = getApprovedCircuitArtifacts(circuitVersion);
  const basePath = path.join(workspaceRoot, 'hush-web-client', 'public');

  return {
    wasmPath: path.join(basePath, artifacts.wasmPath.replace(/^\//, '')),
    zkeyPath: path.join(basePath, artifacts.zkeyPath.replace(/^\//, '')),
  };
}

async function loadSnarkJs(): Promise<SnarkJsModule> {
  try {
    return (await import('snarkjs')) as SnarkJsModule;
  } catch (nativeImportError) {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier);') as (
        specifier: string
      ) => Promise<unknown>;
      return (await dynamicImport('snarkjs')) as SnarkJsModule;
    } catch (fallbackError) {
      const detail =
        fallbackError instanceof Error
          ? fallbackError.message
          : nativeImportError instanceof Error
            ? nativeImportError.message
            : String(fallbackError);

      throw new Error(`snarkjs is required for headless non-dev proof generation: ${detail}`);
    }
  }
}

async function assertFileExists(filePath: string, label: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} circuit artifact not found at '${filePath}'`);
  }
}

function resolveWorkspaceRootFromCurrentFile(): string {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

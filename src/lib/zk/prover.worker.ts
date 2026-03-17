import { getApprovedCircuitArtifacts } from './artifactManifest';
import type { CircuitInputs, Groth16Proof, WorkerMessage } from './types';

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

// Circuit artifact paths (approved and browser-accessible)
let wasmPath: string | null = null;
let zkeyPath: string | null = null;

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
      throw new Error(`snarkjs is required for browser proof generation: ${detail}`);
    }
  }
}

/**
 * Handle messages from the main thread
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      await handleInit(payload as { circuitVersion: string });
      break;

    case 'prove':
      await handleProve(payload as { inputs: CircuitInputs });
      break;
  }
};

/**
 * Initialize the worker with circuit files
 */
async function handleInit(payload: { circuitVersion: string }): Promise<void> {
  const { circuitVersion } = payload;

  try {
    const artifacts = getApprovedCircuitArtifacts(circuitVersion);

    // Try to load circuit files
    const wasmResponse = await fetch(artifacts.wasmPath);
    const zkeyResponse = await fetch(artifacts.zkeyPath);

    if (wasmResponse.ok && zkeyResponse.ok) {
      wasmPath = artifacts.wasmPath;
      zkeyPath = artifacts.zkeyPath;
      console.log(`[ZkWorker] Loaded circuit ${circuitVersion}`);
    } else {
      self.postMessage({
        type: 'error',
        payload: {
          message: `Circuit files not found for ${circuitVersion}. Refusing to generate placeholder proofs.`,
        },
      });
      return;
    }

    // Signal ready
    self.postMessage({ type: 'ready' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        message: error instanceof Error
          ? `Failed to load circuit files: ${error.message}`
          : 'Failed to load circuit files',
      },
    });
  }
}

/**
 * Generate a proof for the given inputs
 */
async function handleProve(payload: { inputs: CircuitInputs }): Promise<void> {
  try {
    if (!wasmPath || !zkeyPath) {
      throw new Error('Real circuit artifacts are not loaded. Placeholder proofs are disabled.');
    }

    const startedAt = performance.now();
    const snarkjs = await loadSnarkJs();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      payload.inputs,
      wasmPath,
      zkeyPath
    );
    console.log(
      `[ZkWorker] fullProve completed in ${Math.round(performance.now() - startedAt)}ms, publicSignals=${publicSignals.length}`
    );

    self.postMessage({
      type: 'proof',
      payload: {
        proof,
        publicSignals,
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

// Export for TypeScript module compatibility
export {};

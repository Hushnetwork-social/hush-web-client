/**
 * ZK Prover Web Worker
 *
 * Runs proof generation in a separate thread to avoid blocking the UI.
 *
 * NOTE: This worker fails closed until real proof generation is wired.
 * Placeholder proofs were removed because they create a false sense of privacy/security.
 *
 * TODO: When ready, add snarkjs:
 *   npm install snarkjs
 *
 * And add circuit files to:
 *   public/circuits/{version}/reaction.wasm
 *   public/circuits/{version}/reaction.zkey
 */

import { getApprovedCircuitArtifacts } from './artifactManifest';
import type { CircuitInputs, WorkerMessage } from './types';

// Circuit file buffers (loaded on init)
let wasmBuffer: ArrayBuffer | null = null;
let zkeyBuffer: ArrayBuffer | null = null;

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
      wasmBuffer = await wasmResponse.arrayBuffer();
      zkeyBuffer = await zkeyResponse.arrayBuffer();
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
    // Touch the payload so lint/build stay honest while the real proof path is still fail-closed.
    void payload.inputs;

    if (!wasmBuffer || !zkeyBuffer) {
      throw new Error('Real circuit artifacts are not loaded. Placeholder proofs are disabled.');
    }

    // Real proof generation with snarkjs is not wired into this worker yet.
    // Fail closed instead of generating fake proofs that look valid to callers.
    throw new Error(
      'Real ZK proof generation is not enabled in this build. Refusing to generate placeholder proofs.'
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

// Export for TypeScript module compatibility
export {};

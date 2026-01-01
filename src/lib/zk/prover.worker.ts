/**
 * ZK Prover Web Worker
 *
 * Runs proof generation in a separate thread to avoid blocking the UI.
 *
 * NOTE: This is a placeholder that will work once snarkjs is installed
 * and circuit files are generated. For now, it provides the worker structure.
 *
 * TODO: When ready, add snarkjs:
 *   npm install snarkjs
 *
 * And add circuit files to:
 *   public/circuits/{version}/reaction.wasm
 *   public/circuits/{version}/reaction.zkey
 */

import type { CircuitInputs, WorkerMessage } from './types';

// Circuit file buffers (loaded on init)
let wasmBuffer: ArrayBuffer | null = null;
let zkeyBuffer: ArrayBuffer | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let currentVersion: string | null = null;

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
    // Check if circuit files exist
    const baseUrl = `/circuits/${circuitVersion}`;

    // Try to load circuit files
    // In production, these would be real circuit files
    // For now, we'll check if they exist and handle gracefully
    const wasmResponse = await fetch(`${baseUrl}/reaction.wasm`);
    const zkeyResponse = await fetch(`${baseUrl}/reaction.zkey`);

    if (wasmResponse.ok && zkeyResponse.ok) {
      wasmBuffer = await wasmResponse.arrayBuffer();
      zkeyBuffer = await zkeyResponse.arrayBuffer();
      currentVersion = circuitVersion;
      console.log(`[ZkWorker] Loaded circuit ${circuitVersion}`);
    } else {
      // Circuit files not found - use placeholder mode
      console.warn(`[ZkWorker] Circuit files not found for ${circuitVersion}, using placeholder mode`);
      wasmBuffer = null;
      zkeyBuffer = null;
      currentVersion = circuitVersion;
    }

    // Signal ready
    self.postMessage({ type: 'ready' });
  } catch (error) {
    console.warn('[ZkWorker] Failed to load circuit files:', error);
    // Still signal ready - we'll use placeholder proofs
    wasmBuffer = null;
    zkeyBuffer = null;
    currentVersion = payload.circuitVersion;
    self.postMessage({ type: 'ready' });
  }
}

/**
 * Generate a proof for the given inputs
 */
async function handleProve(payload: { inputs: CircuitInputs }): Promise<void> {
  const { inputs } = payload;

  try {
    if (wasmBuffer && zkeyBuffer) {
      // Real proof generation with snarkjs
      // TODO: Uncomment when snarkjs is installed:
      //
      // const { groth16 } = await import('snarkjs');
      // const { proof, publicSignals } = await groth16.fullProve(
      //   inputs,
      //   new Uint8Array(wasmBuffer),
      //   new Uint8Array(zkeyBuffer)
      // );
      //
      // self.postMessage({
      //   type: 'proof',
      //   payload: { proof, publicSignals }
      // });

      // For now, generate a placeholder proof
      const placeholderResult = generatePlaceholderProof(inputs);
      self.postMessage({
        type: 'proof',
        payload: placeholderResult,
      });
    } else {
      // Placeholder mode - generate fake proof
      console.warn('[ZkWorker] Generating placeholder proof (circuit not loaded)');
      const placeholderResult = generatePlaceholderProof(inputs);
      self.postMessage({
        type: 'proof',
        payload: placeholderResult,
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

/**
 * Generate a placeholder proof for development/testing
 *
 * WARNING: This is NOT a real ZK proof and provides NO privacy guarantees!
 * It should only be used during development before the real circuit is ready.
 */
function generatePlaceholderProof(inputs: CircuitInputs): {
  proof: {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
} {
  // Generate deterministic but fake proof values based on inputs
  const hash = simpleHash(JSON.stringify(inputs));

  return {
    proof: {
      pi_a: [
        (BigInt(hash) % (2n ** 254n)).toString(),
        ((BigInt(hash) * 2n) % (2n ** 254n)).toString(),
        '1',
      ],
      pi_b: [
        [
          ((BigInt(hash) * 3n) % (2n ** 254n)).toString(),
          ((BigInt(hash) * 4n) % (2n ** 254n)).toString(),
        ],
        [
          ((BigInt(hash) * 5n) % (2n ** 254n)).toString(),
          ((BigInt(hash) * 6n) % (2n ** 254n)).toString(),
        ],
        ['1', '0'],
      ],
      pi_c: [
        ((BigInt(hash) * 7n) % (2n ** 254n)).toString(),
        ((BigInt(hash) * 8n) % (2n ** 254n)).toString(),
        '1',
      ],
      protocol: 'groth16',
      curve: 'bn128',
    },
    publicSignals: [
      inputs.nullifier,
      inputs.members_root,
      inputs.message_id,
      inputs.feed_id,
    ],
  };
}

/**
 * Simple hash function for placeholder proof generation
 */
function simpleHash(str: string): string {
  let hash = 0n;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31n + BigInt(str.charCodeAt(i))) % (2n ** 256n);
  }
  return hash.toString();
}

// Export for TypeScript module compatibility
export {};

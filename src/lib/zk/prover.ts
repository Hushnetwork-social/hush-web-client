/**
 * ZK Proof Generator for Protocol Omega
 *
 * Uses a Web Worker to generate Groth16 proofs without blocking the main thread.
 * Proof generation takes 4-8 seconds on mobile devices.
 */

import { CIRCUIT } from '../crypto/reactions/constants';
import type {
  CircuitInputs,
  ProofResult,
  Groth16Proof,
  WorkerMessage,
} from './types';

/**
 * ZK Prover class - manages Web Worker for proof generation
 */
class ZkProver {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private currentCircuitVersion: string = CIRCUIT.version;

  // Pending proof requests
  private pendingProof: {
    resolve: (result: ProofResult) => void;
    reject: (error: Error) => void;
  } | null = null;

  /**
   * Initialize the prover and load circuit files
   */
  async initialize(circuitVersion?: string): Promise<void> {
    if (this.isReady && circuitVersion === this.currentCircuitVersion) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize(circuitVersion || CIRCUIT.version);
    return this.initPromise;
  }

  private async _initialize(circuitVersion: string): Promise<void> {
    // Terminate existing worker if any
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create Web Worker
        this.worker = new Worker(
          new URL('./prover.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const { type, payload } = event.data;

          switch (type) {
            case 'ready':
              this.isReady = true;
              this.currentCircuitVersion = circuitVersion;
              console.log(`[ZkProver] Ready with circuit ${circuitVersion}`);
              resolve();
              break;

            case 'proof':
              if (this.pendingProof) {
                const proofPayload = payload as {
                  proof: Groth16Proof;
                  publicSignals: string[];
                };
                const result: ProofResult = {
                  proof: this.packProof(proofPayload.proof),
                  publicSignals: proofPayload.publicSignals,
                  circuitVersion: this.currentCircuitVersion,
                };
                this.pendingProof.resolve(result);
                this.pendingProof = null;
              }
              break;

            case 'error':
              const errorPayload = payload as { message: string };
              console.error('[ZkProver] Worker error:', errorPayload.message);
              if (this.pendingProof) {
                this.pendingProof.reject(new Error(errorPayload.message));
                this.pendingProof = null;
              }
              break;
          }
        };

        this.worker.onerror = (error) => {
          console.error('[ZkProver] Worker error:', error);
          reject(new Error(`Worker error: ${error.message}`));
        };

        // Send init message
        this.worker.postMessage({
          type: 'init',
          payload: { circuitVersion },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate a ZK proof for the given inputs
   */
  async generateProof(inputs: CircuitInputs): Promise<ProofResult> {
    if (!this.isReady || !this.worker) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingProof = { resolve, reject };

      this.worker!.postMessage({
        type: 'prove',
        payload: { inputs },
      });
    });
  }

  /**
   * Pack a Groth16 proof into bytes for transmission
   */
  private packProof(proof: Groth16Proof): Uint8Array {
    // Groth16 proof consists of:
    // - pi_a: 2 field elements (64 bytes)
    // - pi_b: 4 field elements (128 bytes)
    // - pi_c: 2 field elements (64 bytes)
    // Total: 256 bytes

    const buffer = new ArrayBuffer(256);
    const view = new DataView(buffer);
    let offset = 0;

    // Pack pi_a (skip the third element, it's always 1)
    for (let i = 0; i < 2; i++) {
      const bytes = this.bigintToBytes32(BigInt(proof.pi_a[i]));
      new Uint8Array(buffer, offset, 32).set(bytes);
      offset += 32;
    }

    // Pack pi_b (2x2 matrix, skip third row)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const bytes = this.bigintToBytes32(BigInt(proof.pi_b[i][j]));
        new Uint8Array(buffer, offset, 32).set(bytes);
        offset += 32;
      }
    }

    // Pack pi_c (skip the third element)
    for (let i = 0; i < 2; i++) {
      const bytes = this.bigintToBytes32(BigInt(proof.pi_c[i]));
      new Uint8Array(buffer, offset, 32).set(bytes);
      offset += 32;
    }

    return new Uint8Array(buffer);
  }

  /**
   * Convert a bigint to 32-byte big-endian array
   */
  private bigintToBytes32(n: bigint): Uint8Array {
    const bytes = new Uint8Array(32);
    let temp = n;
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(temp & 0xffn);
      temp >>= 8n;
    }
    return bytes;
  }

  /**
   * Check if prover is ready
   */
  isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Get current circuit version
   */
  getCircuitVersion(): string {
    return this.currentCircuitVersion;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }

    if (this.pendingProof) {
      this.pendingProof.reject(new Error('Prover terminated'));
      this.pendingProof = null;
    }
  }
}

// Singleton instance
export const zkProver = new ZkProver();

/**
 * Convenience function for proof generation
 */
export async function generateProof(inputs: CircuitInputs): Promise<ProofResult> {
  return zkProver.generateProof(inputs);
}

/**
 * ZK Proof Generator for Protocol Omega
 *
 * Uses a Web Worker to generate Groth16 proofs without blocking the main thread.
 * Proof generation takes 4-8 seconds on mobile devices.
 */

import { CIRCUIT } from '../crypto/reactions/constants';
import { buildApiUrl } from '../api-config';
import type {
  CircuitInputs,
  ProofResult,
  Groth16Proof,
  WorkerMessage,
} from './types';
import { packGroth16Proof } from './proofPacking';

type ProverMode = 'browser' | 'server';

type ServerProofResponse = {
  success: boolean;
  proof?: Groth16Proof;
  publicSignals?: string[];
  circuitVersion?: string;
  message?: string;
};

/**
 * ZK Prover class - manages Web Worker for proof generation
 */
class ZkProver {
  private static readonly PROOF_TIMEOUT_MS = 30_000;
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private currentCircuitVersion: string = CIRCUIT.version;
  private pendingInitReject: ((error: Error) => void) | null = null;

  // Pending proof requests
  private pendingProof: {
    resolve: (result: ProofResult) => void;
    reject: (error: Error) => void;
  } | null = null;

  private getProverMode(): ProverMode {
    // Browser is the canonical FEAT-087 E2E mode.
    // Forcing server mode routes proof generation through /api/reactions/prove, which can
    // time out in Docker and prevents the test from exercising the actual submitted-proof path.
    return process.env.NEXT_PUBLIC_REACTION_PROVER_MODE === 'server' ? 'server' : 'browser';
  }

  private static isMissingCircuitArtifactsMessage(message: string): boolean {
    return (
      message.includes('Circuit files not found') ||
      message.includes('Failed to load circuit files')
    );
  }

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
    if (this.getProverMode() === 'server') {
      this.isReady = true;
      this.currentCircuitVersion = circuitVersion;
      this.initPromise = null;
      this.pendingInitReject = null;
      console.log(`[ZkProver] Ready with server prover mode for circuit ${circuitVersion}`);
      return;
    }

    // Terminate existing worker if any
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      this.pendingInitReject = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        this.isReady = false;
        this.initPromise = null;
        this.pendingInitReject = null;

        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }

        reject(error);
      };

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
              if (settled) {
                break;
              }

              settled = true;
              this.isReady = true;
              this.currentCircuitVersion = circuitVersion;
              this.initPromise = null;
              this.pendingInitReject = null;
              console.log(`[ZkProver] Ready with circuit ${circuitVersion}`);
              resolve();
              break;

            case 'proof':
              if (this.pendingProof) {
                const proofPayload = payload as {
                  proof: Groth16Proof;
                  publicSignals: string[];
                };
                console.log(
                  `[ZkProver] generateProof done: circuit=${this.currentCircuitVersion}, publicSignals=${proofPayload.publicSignals.length}`
                );
                const result: ProofResult = {
                  proof: packGroth16Proof(proofPayload.proof),
                  publicSignals: proofPayload.publicSignals,
                  circuitVersion: this.currentCircuitVersion,
                  proofJson: proofPayload.proof,
                };
                this.pendingProof.resolve(result);
                this.pendingProof = null;
              }
              break;

            case 'error':
              const errorPayload = payload as { message: string };
              const isInitArtifactError =
                !this.isReady && ZkProver.isMissingCircuitArtifactsMessage(errorPayload.message);

              if (isInitArtifactError) {
                console.warn('[ZkProver] Circuit artifacts unavailable:', errorPayload.message);
              } else {
                console.error('[ZkProver] Worker error:', errorPayload.message);
              }

              if (this.pendingProof) {
                this.pendingProof.reject(new Error(errorPayload.message));
                this.pendingProof = null;
              }
              if (!this.isReady) {
                this.pendingInitReject?.(new Error(errorPayload.message));
              }
              break;
          }
        };

        this.worker.onerror = (error) => {
          console.error('[ZkProver] Worker error:', error);
          const workerError = new Error(`Worker error: ${error.message}`);

          if (this.pendingProof) {
            this.pendingProof.reject(workerError);
            this.pendingProof = null;
          }

          this.pendingInitReject?.(workerError);
        };

        // Send init message
        this.worker.postMessage({
          type: 'init',
          payload: { circuitVersion },
        });
      } catch (error) {
        this.initPromise = null;
        this.pendingInitReject = null;
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

    if (this.getProverMode() === 'server') {
      return this.generateProofViaServer(inputs);
    }

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      console.log(
        `[ZkProver] generateProof start: circuit=${this.currentCircuitVersion}, nullifier=${inputs.nullifier.substring(0, 24)}...`
      );
      const timeoutHandle = setTimeout(() => {
        if (!this.pendingProof) {
          return;
        }

        console.error(
          `[ZkProver] generateProof timed out after ${ZkProver.PROOF_TIMEOUT_MS}ms`
        );
        this.pendingProof.reject(
          new Error(
            `ZK proof generation timed out after ${ZkProver.PROOF_TIMEOUT_MS}ms`
          )
        );
        this.pendingProof = null;
      }, ZkProver.PROOF_TIMEOUT_MS);

      this.pendingProof = {
        resolve: (result) => {
          clearTimeout(timeoutHandle);
          console.log(
            `[ZkProver] generateProof completed in ${Math.round(performance.now() - startedAt)}ms`
          );
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
      };

      this.worker!.postMessage({
        type: 'prove',
        payload: { inputs },
      });
      });
  }

  private async generateProofViaServer(inputs: CircuitInputs): Promise<ProofResult> {
    console.log(
      `[ZkProver] generateProof start via server: circuit=${this.currentCircuitVersion}, nullifier=${inputs.nullifier.substring(0, 24)}...`
    );
    const startedAt = performance.now();

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), ZkProver.PROOF_TIMEOUT_MS);

    try {
      const response = await fetch(buildApiUrl('/api/reactions/prove'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          circuitVersion: this.currentCircuitVersion,
          inputs,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as ServerProofResponse;

      if (!response.ok || !payload.success || !payload.proof || !payload.publicSignals) {
        throw new Error(payload.message || `Server prover request failed with ${response.status}`);
      }

      const circuitVersion = payload.circuitVersion ?? this.currentCircuitVersion;
      console.log(
        `[ZkProver] generateProof via server completed in ${Math.round(performance.now() - startedAt)}ms for circuit=${circuitVersion}, publicSignals=${payload.publicSignals.length}`
      );

      return {
        proof: packGroth16Proof(payload.proof),
        publicSignals: payload.publicSignals,
        circuitVersion,
        proofJson: payload.proof,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(
          `ZK proof generation timed out after ${ZkProver.PROOF_TIMEOUT_MS}ms`
        );
      }

      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeoutHandle);
    }
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

    if (this.pendingInitReject) {
      const reject = this.pendingInitReject;
      this.pendingInitReject = null;
      this.initPromise = null;
      reject(new Error('Prover terminated'));
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

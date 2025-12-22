/**
 * ZK Proof Module for Protocol Omega
 */

// Types
export type {
  CircuitInputs,
  ProofResult,
  Groth16Proof,
  MerkleProofData,
  WorkerMessage,
} from './types';

// Prover
export { zkProver, generateProof } from './prover';

// Circuit Manager
export { circuitManager } from './circuitManager';

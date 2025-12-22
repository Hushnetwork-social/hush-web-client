/**
 * ZK Proof Types for Protocol Omega
 */

/**
 * Circuit inputs for reaction proof generation
 */
export interface CircuitInputs {
  // Public inputs (verified by the circuit)
  nullifier: string;                    // Poseidon hash as decimal string
  ciphertext_c1: [string, string][];    // 6 points as [x, y] decimal strings
  ciphertext_c2: [string, string][];    // 6 points as [x, y] decimal strings
  message_id: string;                   // UUID as decimal string
  feed_id: string;                      // UUID as decimal string
  feed_pk: [string, string];            // Public key as [x, y] decimal strings
  members_root: string;                 // Merkle root as decimal string
  author_commitment: string;            // Author's commitment as decimal string

  // Private inputs (witness, known only to prover)
  user_secret: string;                  // User's secret as decimal string
  emoji_index: string;                  // 0-5 as decimal string
  encryption_nonces: string[];          // 6 random nonces as decimal strings
  merkle_path: string[];                // Sibling hashes as decimal strings
  merkle_indices: number[];             // Left(0)/Right(1) path indicators
}

/**
 * Result of proof generation
 */
export interface ProofResult {
  // Packed Groth16 proof
  proof: Uint8Array;

  // Public signals from the circuit
  publicSignals: string[];

  // Circuit version used
  circuitVersion: string;
}

/**
 * Groth16 proof structure (from snarkjs)
 */
export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
}

/**
 * Worker message types
 */
export type WorkerMessageType = 'init' | 'prove' | 'ready' | 'proof' | 'error';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: unknown;
}

export interface InitMessage extends WorkerMessage {
  type: 'init';
  payload: {
    circuitVersion: string;
  };
}

export interface ProveMessage extends WorkerMessage {
  type: 'prove';
  payload: {
    inputs: CircuitInputs;
  };
}

export interface ReadyMessage extends WorkerMessage {
  type: 'ready';
}

export interface ProofMessage extends WorkerMessage {
  type: 'proof';
  payload: {
    proof: Groth16Proof;
    publicSignals: string[];
  };
}

export interface ErrorMessage extends WorkerMessage {
  type: 'error';
  payload: {
    message: string;
  };
}

/**
 * Merkle proof data for membership verification
 */
export interface MerkleProofData {
  root: bigint;
  pathElements: bigint[];
  pathIndices: boolean[];
  depth: number;
  rootBlockHeight: number;
}

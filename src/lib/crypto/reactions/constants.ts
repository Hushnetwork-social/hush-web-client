/**
 * Protocol Omega Constants
 *
 * Baby JubJub curve parameters and domain separators.
 * These must match the ZK circuit parameters exactly.
 */

// Baby JubJub curve parameters (twisted Edwards curve)
// Curve equation: a*x^2 + y^2 = 1 + d*x^2*y^2
export const BABYJUBJUB = {
  // Curve coefficients
  a: 168700n,
  d: 168696n,

  // Prime field modulus (same as BN254 scalar field)
  p: 21888242871839275222246405745257275088548364400416034343698204186575808495617n,

  // Subgroup order (for scalar operations)
  order: 21888242871839275222246405745257275088614511777268538073601725287587578984328n,

  // Cofactor
  cofactor: 8n,

  // Generator point (base point for scalar multiplication)
  generator: {
    x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
    y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n,
  },
} as const;

// Identity element on Baby JubJub (neutral element for addition)
// This is (0, 1), NOT the point at infinity
export const IDENTITY = {
  x: 0n,
  y: 1n,
} as const;

// Emoji configuration
export const EMOJI_COUNT = 6;
export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'] as const;
export type EmojiType = typeof EMOJIS[number];

// Domain separators for hash functions (must match ZK circuit)
export const DOMAIN_SEPARATORS = {
  // Nullifier: Poseidon(user_secret, message_id, feed_id, DOMAIN)
  NULLIFIER: 0x48555348n, // "HUSH" as hex

  // Backup key: Poseidon(user_secret, message_id, BACKUP_DOMAIN)
  BACKUP: 0x4241434B5550n, // "BACKUP" as hex

  // Commitment: Poseidon(user_secret, COMMITMENT_DOMAIN)
  COMMITMENT: 0x434F4D4D4954n, // "COMMIT" as hex
} as const;

// ZK Circuit configuration
export const CIRCUIT = {
  // Current circuit version
  version: 'omega-v1.0.0',

  // Merkle tree depth (2^20 = ~1M members per feed)
  treeDepth: 20,

  // Number of recent roots to accept (grace period)
  gracePeriodRoots: 3,
} as const;

// BSGS configuration for discrete log solving
export const BSGS = {
  // Maximum count we can solve (2^20 = ~1M reactions)
  maxValue: 1048576n, // 2^20

  // Table size (sqrt of maxValue)
  tableSize: 1024, // 2^10

  // Cache key for IndexedDB
  cacheKey: 'bsgs-table-v1',

  // URL to fetch precomputed table
  tableUrl: '/crypto/bsgs-table.bin',
} as const;

// Feed key derivation domain separator
export const FEED_KEY_DOMAIN = 'hush-feed-elgamal-v1' as const;

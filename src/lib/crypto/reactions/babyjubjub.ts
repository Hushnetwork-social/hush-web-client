/**
 * Baby JubJub Curve Operations
 *
 * Twisted Edwards curve used for ElGamal encryption in Protocol Omega.
 * Curve equation: a*x^2 + y^2 = 1 + d*x^2*y^2
 *
 * This implementation matches the circom/snarkjs BabyJubJub parameters.
 */

import { BABYJUBJUB, IDENTITY } from './constants';

/**
 * Point on the Baby JubJub curve
 */
export interface Point {
  x: bigint;
  y: bigint;
}

/**
 * Modular arithmetic helper: (a mod p), always positive
 */
function mod(a: bigint, p: bigint = BABYJUBJUB.p): bigint {
  const result = a % p;
  return result >= 0n ? result : result + p;
}

/**
 * Modular inverse using extended Euclidean algorithm
 */
function modInverse(a: bigint, p: bigint = BABYJUBJUB.p): bigint {
  let [old_r, r] = [a, p];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  return mod(old_s, p);
}

/**
 * Check if a point is the identity element (0, 1)
 */
export function isIdentity(p: Point): boolean {
  return p.x === 0n && p.y === 1n;
}

/**
 * Check if a point lies on the Baby JubJub curve
 */
export function isOnCurve(p: Point): boolean {
  const { a, d } = BABYJUBJUB;
  const x2 = mod(p.x * p.x);
  const y2 = mod(p.y * p.y);

  // a*x^2 + y^2 = 1 + d*x^2*y^2
  const lhs = mod(a * x2 + y2);
  const rhs = mod(1n + d * x2 * y2);

  return lhs === rhs;
}

/**
 * Add two points on the Baby JubJub curve (twisted Edwards addition)
 *
 * Formula for twisted Edwards curves:
 * x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
 * y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)
 */
export function addPoints(p1: Point, p2: Point): Point {
  const { a, d, p } = BABYJUBJUB;

  const x1y2 = mod(p1.x * p2.y);
  const y1x2 = mod(p1.y * p2.x);
  const y1y2 = mod(p1.y * p2.y);
  const x1x2 = mod(p1.x * p2.x);

  // Compute d * x1 * x2 * y1 * y2
  const dxy = mod(d * mod(p1.x * p2.x) * mod(p1.y * p2.y));

  const x3Num = mod(x1y2 + y1x2);
  const x3Den = mod(1n + dxy);
  const x3 = mod(x3Num * modInverse(x3Den, p));

  const y3Num = mod(y1y2 - mod(a * x1x2));
  const y3Den = mod(1n - dxy);
  const y3 = mod(y3Num * modInverse(y3Den, p));

  return { x: x3, y: y3 };
}

/**
 * Negate a point (reflect over x-axis in twisted Edwards)
 */
export function negatePoint(p: Point): Point {
  return { x: mod(-p.x), y: p.y };
}

/**
 * Subtract two points: p1 - p2 = p1 + (-p2)
 */
export function subPoints(p1: Point, p2: Point): Point {
  return addPoints(p1, negatePoint(p2));
}

/**
 * Double a point (p + p)
 */
export function doublePoint(p: Point): Point {
  return addPoints(p, p);
}

/**
 * Scalar multiplication using double-and-add algorithm
 * Returns scalar * point
 */
export function scalarMul(point: Point, scalar: bigint): Point {
  // Handle edge cases
  if (scalar === 0n) {
    return { ...IDENTITY };
  }

  if (scalar < 0n) {
    return scalarMul(negatePoint(point), -scalar);
  }

  // Double-and-add algorithm
  let result: Point = { ...IDENTITY };
  let current: Point = { ...point };
  let k = scalar;

  while (k > 0n) {
    if (k & 1n) {
      result = addPoints(result, current);
    }
    current = doublePoint(current);
    k >>= 1n;
  }

  return result;
}

/**
 * Get the generator point
 */
export function getGenerator(): Point {
  return { ...BABYJUBJUB.generator };
}

/**
 * Get the identity point
 */
export function getIdentity(): Point {
  return { ...IDENTITY };
}

/**
 * Convert a point to a unique string key (for Map/Set)
 */
export function pointToKey(p: Point): string {
  return `${p.x.toString(16)}:${p.y.toString(16)}`;
}

/**
 * Parse a point from its string key
 */
export function keyToPoint(key: string): Point {
  const [xHex, yHex] = key.split(':');
  return {
    x: BigInt('0x' + xHex),
    y: BigInt('0x' + yHex),
  };
}

/**
 * Convert point coordinates to byte arrays (big-endian, 32 bytes each)
 */
export function pointToBytes(p: Point): { x: Uint8Array; y: Uint8Array } {
  return {
    x: bigintToBytes(p.x),
    y: bigintToBytes(p.y),
  };
}

/**
 * Convert byte arrays to a point
 */
export function bytesToPoint(x: Uint8Array, y: Uint8Array): Point {
  return {
    x: bytesToBigint(x),
    y: bytesToBigint(y),
  };
}

/**
 * Convert bigint to 32-byte big-endian Uint8Array
 */
export function bigintToBytes(n: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let temp = n;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }
  return bytes;
}

/**
 * Convert big-endian Uint8Array to bigint
 */
export function bytesToBigint(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/**
 * Convert point to base64 encoded strings (for gRPC)
 */
export function pointToBase64(p: Point): { X: string; Y: string } {
  const xBytes = bigintToBytes(p.x);
  const yBytes = bigintToBytes(p.y);
  return {
    X: btoa(String.fromCharCode(...xBytes)),
    Y: btoa(String.fromCharCode(...yBytes)),
  };
}

/**
 * Convert base64 encoded strings to point
 */
export function base64ToPoint(encoded: { X: string; Y: string }): Point {
  const xStr = atob(encoded.X);
  const yStr = atob(encoded.Y);
  const xBytes = new Uint8Array(xStr.length);
  const yBytes = new Uint8Array(yStr.length);
  for (let i = 0; i < xStr.length; i++) xBytes[i] = xStr.charCodeAt(i);
  for (let i = 0; i < yStr.length; i++) yBytes[i] = yStr.charCodeAt(i);
  return bytesToPoint(xBytes, yBytes);
}

/**
 * Generate a random scalar in the valid range
 */
export function randomScalar(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let scalar = bytesToBigint(bytes);
  // Ensure scalar is in valid range [1, order-1]
  scalar = (scalar % (BABYJUBJUB.order - 1n)) + 1n;
  return scalar;
}

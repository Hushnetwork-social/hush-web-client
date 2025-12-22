/**
 * Type declarations for circomlibjs
 *
 * circomlibjs provides JavaScript implementations of circom cryptographic primitives.
 */

declare module 'circomlibjs' {
  /**
   * Finite field interface
   */
  export interface F {
    toObject(element: unknown): bigint;
    e(n: bigint | number | string): unknown;
    add(a: unknown, b: unknown): unknown;
    sub(a: unknown, b: unknown): unknown;
    mul(a: unknown, b: unknown): unknown;
    div(a: unknown, b: unknown): unknown;
    neg(a: unknown): unknown;
    inv(a: unknown): unknown;
    eq(a: unknown, b: unknown): boolean;
    isZero(a: unknown): boolean;
    zero: unknown;
    one: unknown;
    p: bigint;
  }

  /**
   * Poseidon hash function interface
   */
  export interface Poseidon {
    (inputs: (bigint | number | string)[]): unknown;
    F: F;
  }

  /**
   * Build Poseidon hash function
   */
  export function buildPoseidon(): Promise<Poseidon>;

  /**
   * Baby JubJub curve point
   */
  export type BabyJubPoint = [bigint, bigint];

  /**
   * Baby JubJub curve interface
   */
  export interface BabyJub {
    F: F;
    Generator: BabyJubPoint;
    Base8: BabyJubPoint;
    order: bigint;
    subOrder: bigint;
    p: bigint;
    addPoint(p1: BabyJubPoint, p2: BabyJubPoint): BabyJubPoint;
    mulPointEscalar(base: BabyJubPoint, scalar: bigint): BabyJubPoint;
    inSubgroup(p: BabyJubPoint): boolean;
    inCurve(p: BabyJubPoint): boolean;
    packPoint(p: BabyJubPoint): Uint8Array;
    unpackPoint(buff: Uint8Array): BabyJubPoint;
  }

  /**
   * Build Baby JubJub curve
   */
  export function buildBabyjub(): Promise<BabyJub>;

  /**
   * EdDSA signature interface
   */
  export interface EdDSA {
    prv2pub(prv: Uint8Array): BabyJubPoint;
    signPoseidon(prv: Uint8Array, msg: bigint): { R8: BabyJubPoint; S: bigint };
    verifyPoseidon(msg: bigint, sig: { R8: BabyJubPoint; S: bigint }, pubKey: BabyJubPoint): boolean;
    packSignature(sig: { R8: BabyJubPoint; S: bigint }): Uint8Array;
    unpackSignature(sigBuff: Uint8Array): { R8: BabyJubPoint; S: bigint };
  }

  /**
   * Build EdDSA signer
   */
  export function buildEddsa(): Promise<EdDSA>;

  /**
   * Pedersen hash
   */
  export function buildPedersenHash(): Promise<{
    hash(data: Uint8Array): BabyJubPoint;
  }>;

  /**
   * Mimc7 hash
   */
  export function buildMimc7(): Promise<{
    hash(left: bigint, right: bigint, k?: bigint): bigint;
    multiHash(arr: bigint[], k?: bigint): bigint;
  }>;

  /**
   * MimcSponge hash
   */
  export function buildMimcSponge(): Promise<{
    hash(left: bigint, right: bigint, k?: bigint): bigint;
    multiHash(arr: bigint[], k?: bigint, numOutputs?: number): bigint[];
  }>;
}

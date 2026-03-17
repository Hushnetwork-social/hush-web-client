import type { Groth16Proof } from './types';

export function packGroth16Proof(proof: Groth16Proof): Uint8Array {
  const buffer = new ArrayBuffer(256);
  let offset = 0;

  for (let i = 0; i < 2; i++) {
    const bytes = bigintToBytes32(BigInt(proof.pi_a[i]));
    new Uint8Array(buffer, offset, 32).set(bytes);
    offset += 32;
  }

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const bytes = bigintToBytes32(BigInt(proof.pi_b[i][j]));
      new Uint8Array(buffer, offset, 32).set(bytes);
      offset += 32;
    }
  }

  for (let i = 0; i < 2; i++) {
    const bytes = bigintToBytes32(BigInt(proof.pi_c[i]));
    new Uint8Array(buffer, offset, 32).set(bytes);
    offset += 32;
  }

  return new Uint8Array(buffer);
}

function bigintToBytes32(n: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let temp = n;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  return bytes;
}

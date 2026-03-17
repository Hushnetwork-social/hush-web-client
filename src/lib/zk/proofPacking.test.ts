import { describe, expect, it } from 'vitest';
import { packGroth16Proof } from './proofPacking';
import type { Groth16Proof } from './types';

describe('packGroth16Proof', () => {
  it('packs the browser/headless proof format into 256 bytes', () => {
    const proof: Groth16Proof = {
      pi_a: ['1', '2', '1'],
      pi_b: [
        ['3', '4'],
        ['5', '6'],
        ['1', '0'],
      ],
      pi_c: ['7', '8', '1'],
      protocol: 'groth16',
      curve: 'bn128',
    };

    const packed = packGroth16Proof(proof);

    expect(packed).toHaveLength(256);
    expect(packed[31]).toBe(1);
    expect(packed[63]).toBe(2);
    expect(packed[95]).toBe(3);
    expect(packed[127]).toBe(4);
    expect(packed[159]).toBe(5);
    expect(packed[191]).toBe(6);
    expect(packed[223]).toBe(7);
    expect(packed[255]).toBe(8);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./prover', () => ({
  zkProver: {
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

import { CIRCUIT } from '../crypto/reactions/constants';
import { circuitManager } from './circuitManager';
import { zkProver } from './prover';

describe('circuitManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes the prover with the approved FEAT-087 circuit version', async () => {
    await circuitManager.initialize();

    expect(zkProver.initialize).toHaveBeenCalledWith(CIRCUIT.version);
    expect(circuitManager.getArtifactBasePath()).toBe(`/circuits/${CIRCUIT.version}`);
  });

  it('rejects proof results that do not match the approved client version', () => {
    expect(() => circuitManager.ensureProofResultVersion('omega-v9.9.9')).toThrow(
      "Circuit version 'omega-v9.9.9' is not part of the approved FEAT-087 artifact set."
    );
  });

  it('rejects malformed version identifiers', () => {
    expect(() => circuitManager.ensureProofResultVersion('dev-mode-v1')).toThrow(
      "Circuit version 'dev-mode-v1' has an invalid format."
    );
  });

  it('keeps the explicit allowlist narrow for FEAT-087', () => {
    expect(circuitManager.isVersionSupported(CIRCUIT.version)).toBe(true);
    expect(circuitManager.isVersionSupported('omega-v1.0.1')).toBe(false);
  });
});

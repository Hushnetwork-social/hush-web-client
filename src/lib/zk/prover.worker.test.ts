import { beforeEach, describe, expect, it, vi } from 'vitest';

const getApprovedCircuitArtifactsMock = vi.fn();
const fullProveMock = vi.fn();

vi.mock('./artifactManifest', () => ({
  getApprovedCircuitArtifacts: getApprovedCircuitArtifactsMock,
}));

vi.mock('snarkjs', () => ({
  groth16: {
    fullProve: fullProveMock,
  },
}));

describe('prover.worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getApprovedCircuitArtifactsMock.mockReturnValue({
      version: 'omega-v1.0.0',
      basePath: '/circuits/omega-v1.0.0',
      wasmPath: '/circuits/omega-v1.0.0/reaction.wasm',
      zkeyPath: '/circuits/omega-v1.0.0/reaction.zkey',
      wasmSha256: '71D1EE45D944313BB2C86A1851F3B09A481481675FA80DDFD3205D99D7613F8B',
      zkeySha256: '65620ABC5030404403C19B22B623E115807EB2603CB5953F195959A76BA91B5C',
      installGuidePath: '/circuits/omega-v1.0.0/README.md',
      provenance: 'FEAT-087 approved artifact set',
    });
    fullProveMock.mockReset();
  });

  it('posts a worker error when browser fullProve throws', async () => {
    const postMessageMock = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      });
    fullProveMock.mockRejectedValueOnce(
      new Error('Assert Failed. Error in template ReactionCircuit_230 line: 51')
    );

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('self', {
      postMessage: postMessageMock,
      onmessage: null,
    } as unknown as typeof self);

    await import('./prover.worker');

    await self.onmessage?.({
      data: { type: 'init', payload: { circuitVersion: 'omega-v1.0.0' } },
    } as MessageEvent);
    await self.onmessage?.({
      data: {
        type: 'prove',
        payload: {
          inputs: { nullifier: '123' },
        },
      },
    } as MessageEvent);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: 'error',
      payload: {
        message: 'Assert Failed. Error in template ReactionCircuit_230 line: 51',
      },
    });
  });

  it('posts a proof result when browser fullProve succeeds', async () => {
    const postMessageMock = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      });
    fullProveMock.mockResolvedValueOnce({
      proof: {
        pi_a: ['1', '2', '1'],
        pi_b: [
          ['3', '4'],
          ['5', '6'],
          ['1', '0'],
        ],
        pi_c: ['7', '8', '1'],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: ['sig-1', 'sig-2'],
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('self', {
      postMessage: postMessageMock,
      onmessage: null,
    } as unknown as typeof self);

    await import('./prover.worker');

    await self.onmessage?.({
      data: { type: 'init', payload: { circuitVersion: 'omega-v1.0.0' } },
    } as MessageEvent);
    await self.onmessage?.({
      data: {
        type: 'prove',
        payload: {
          inputs: { nullifier: '123' },
        },
      },
    } as MessageEvent);

    expect(postMessageMock).toHaveBeenLastCalledWith({
      type: 'proof',
      payload: {
        proof: {
          pi_a: ['1', '2', '1'],
          pi_b: [
            ['3', '4'],
            ['5', '6'],
            ['1', '0'],
          ],
          pi_c: ['7', '8', '1'],
          protocol: 'groth16',
          curve: 'bn128',
        },
        publicSignals: ['sig-1', 'sig-2'],
      },
    });
  });
});

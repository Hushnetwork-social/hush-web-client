import { beforeEach, describe, expect, it, vi } from 'vitest';

const accessMock = vi.fn<(path: string) => Promise<void>>();
const mkdirMock = vi.fn<(path: string, options?: object) => Promise<void>>();
const writeFileMock = vi.fn<(path: string, data: string) => Promise<void>>();
const fullProveMock = vi.fn();

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    access: accessMock,
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    default: {
      ...((actual as unknown as { default?: object }).default ?? {}),
      access: accessMock,
      mkdir: mkdirMock,
      writeFile: writeFileMock,
    },
  };
});

vi.mock('snarkjs', () => ({
  groth16: {
    fullProve: fullProveMock,
  },
}));

describe('POST /api/reactions/prove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REACTION_PROVE_CAPTURE_INPUTS;
    accessMock.mockResolvedValue(undefined);
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    fullProveMock.mockResolvedValue({
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
      publicSignals: ['sig-1'],
    });
  });

  it('returns 400 when inputs are missing', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/reactions/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuitVersion: 'omega-v1.0.0' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'inputs are required',
    });
    expect(fullProveMock).not.toHaveBeenCalled();
  });

  it('invokes snarkjs fullProve with the approved runtime artifact paths', async () => {
    const { POST } = await import('./route');
    const inputs = {
      nullifier: '123',
      ciphertext_c1: Array.from({ length: 6 }, () => ['1', '2']),
      ciphertext_c2: Array.from({ length: 6 }, () => ['3', '4']),
      message_id: '5',
      feed_id: '6',
      feed_pk: ['7', '8'],
      members_root: '9',
      author_commitment: '10',
      user_secret: '11',
      emoji_index: '1',
      encryption_nonce: ['1', '2', '3', '4', '5', '6'],
      merkle_path: ['7', '8', '9'],
      merkle_indices: [1, 0, 1],
    };

    const response = await POST(
      new Request('http://localhost/api/reactions/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuitVersion: 'omega-v1.0.0', inputs }),
      })
    );

    expect(response.status).toBe(200);
    expect(fullProveMock).toHaveBeenCalledWith(
      inputs,
      expect.stringContaining('reaction.wasm'),
      expect.stringContaining('reaction.zkey')
    );
  });

  it('returns 502 when the circuit artifacts are missing', async () => {
    accessMock.mockRejectedValueOnce(new Error('missing wasm'));
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/reactions/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuitVersion: 'omega-v1.0.0',
          inputs: {
            nullifier: '123',
          },
        }),
      })
    );

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('WASM circuit artifact not found');
    expect(fullProveMock).not.toHaveBeenCalled();
  });

  it('returns 502 when snarkjs fullProve throws', async () => {
    fullProveMock.mockRejectedValueOnce(
      new Error('Assert Failed. Error in template ReactionCircuit_230 line: 35')
    );
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/reactions/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuitVersion: 'omega-v1.0.0',
          inputs: {
            nullifier: '123',
          },
        }),
      })
    );

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.message).toContain('Assert Failed');
  });

  it('captures the exact prove request payload when REACTION_PROVE_CAPTURE_INPUTS is enabled', async () => {
    process.env.REACTION_PROVE_CAPTURE_INPUTS = 'true';
    const { POST } = await import('./route');
    const inputs = {
      nullifier: '123',
      ciphertext_c1: Array.from({ length: 6 }, () => ['1', '2']),
      ciphertext_c2: Array.from({ length: 6 }, () => ['3', '4']),
      message_id: '5',
      feed_id: '6',
      feed_pk: ['7', '8'],
      members_root: '9',
      author_commitment: '10',
      user_secret: '11',
      emoji_index: '1',
      encryption_nonce: ['1', '2', '3', '4', '5', '6'],
      merkle_path: ['7', '8', '9'],
      merkle_indices: [1, 0, 1],
    };

    const response = await POST(
      new Request('http://localhost/api/reactions/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuitVersion: 'omega-v1.0.0', inputs }),
      })
    );

    expect(response.status).toBe(200);
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [capturePath, captureBody] = writeFileMock.mock.calls[0];
    expect(capturePath).toContain('.tmp');
    expect(capturePath).toContain('prove-captures');
    expect(capturePath).toContain('prove-');
    const parsedBody = JSON.parse(captureBody);
    expect(parsedBody.circuitVersion).toBe('omega-v1.0.0');
    expect(parsedBody.inputs).toEqual(inputs);
    expect(parsedBody.wasmSha256).toBe('71D1EE45D944313BB2C86A1851F3B09A481481675FA80DDFD3205D99D7613F8B');
    expect(parsedBody.zkeySha256).toBe('65620ABC5030404403C19B22B623E115807EB2603CB5953F195959A76BA91B5C');
  });
});

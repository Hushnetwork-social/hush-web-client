import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class InitErrorWorkerMock {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((error: ErrorEvent) => void) | null = null;

  postMessage(message: { type: string }) {
    if (message.type === 'init') {
      queueMicrotask(() => {
        this.onmessage?.(
          {
            data: {
              type: 'error',
              payload: { message: 'Circuit files not found for omega-v1.0.0.' },
            },
          } as MessageEvent
        );
      });
    }
  }

  terminate() {
    // No-op for tests.
  }
}

class ReadyAndProofWorkerMock {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((error: ErrorEvent) => void) | null = null;

  postMessage(message: { type: string }) {
    if (message.type === 'init') {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent);
      });
      return;
    }

    if (message.type === 'prove') {
      queueMicrotask(() => {
        this.onmessage?.(
          {
            data: {
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
                publicSignals: ['signal-1', 'signal-2'],
              },
            },
          } as MessageEvent
        );
      });
    }
  }

  terminate() {
    // No-op for tests.
  }
}

class ReadyThenErrorWorkerMock {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((error: ErrorEvent) => void) | null = null;

  postMessage(message: { type: string }) {
    if (message.type === 'init') {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent);
      });
      return;
    }

    if (message.type === 'prove') {
      queueMicrotask(() => {
        this.onmessage?.(
          {
            data: {
              type: 'error',
              payload: { message: 'Proof generation proxy failed: 502 upstream' },
            },
          } as MessageEvent
        );
      });
    }
  }

  terminate() {
    // No-op for tests.
  }
}

class ReadyThenSilentWorkerMock {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((error: ErrorEvent) => void) | null = null;

  postMessage(message: { type: string }) {
    if (message.type === 'init') {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: 'ready' } } as MessageEvent);
      });
    }
  }

  terminate() {
    // No-op for tests.
  }
}

describe('zkProver', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(async () => {
    const { zkProver } = await import('./prover');
    zkProver.terminate();
    vi.unstubAllGlobals();
  });

  it('rejects initialization when the worker reports an init error', async () => {
    vi.stubGlobal('Worker', InitErrorWorkerMock as unknown as typeof Worker);
    const { zkProver } = await import('./prover');

    await expect(zkProver.initialize()).rejects.toThrow(
      'Circuit files not found for omega-v1.0.0.'
    );
    expect(zkProver.isInitialized()).toBe(false);
  });

  it('resolves proofs from the browser worker path after initialization', async () => {
    vi.stubGlobal('Worker', ReadyAndProofWorkerMock as unknown as typeof Worker);
    const { zkProver } = await import('./prover');

    await zkProver.initialize();

    const result = await zkProver.generateProof({
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
    });

    expect(result.publicSignals).toEqual(['signal-1', 'signal-2']);
    expect(result.circuitVersion).toBe('omega-v1.0.0');
    expect(result.proof).toBeInstanceOf(Uint8Array);
    expect(result.proof.length).toBeGreaterThan(0);
  });

  it('rejects proof generation when the browser worker reports a prove-time error', async () => {
    vi.stubGlobal('Worker', ReadyThenErrorWorkerMock as unknown as typeof Worker);
    const { zkProver } = await import('./prover');

    await zkProver.initialize();

    await expect(
      zkProver.generateProof({
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
      })
    ).rejects.toThrow('Proof generation proxy failed: 502 upstream');
  });

  it('rejects proof generation when the browser worker never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', ReadyThenSilentWorkerMock as unknown as typeof Worker);

    try {
      const { zkProver } = await import('./prover');

      await zkProver.initialize();

      const proofPromise = zkProver.generateProof({
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
      });
      const proofExpectation = expect(proofPromise).rejects.toThrow(
        'ZK proof generation timed out after 30000ms'
      );

      await vi.advanceTimersByTimeAsync(30_000);
      await proofExpectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

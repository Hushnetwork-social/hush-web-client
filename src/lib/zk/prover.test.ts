import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class WorkerMock {
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

describe('zkProver', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('Worker', WorkerMock as unknown as typeof Worker);
  });

  afterEach(async () => {
    const { zkProver } = await import('./prover');
    zkProver.terminate();
    vi.unstubAllGlobals();
  });

  it('rejects initialization when the worker reports an init error', async () => {
    const { zkProver } = await import('./prover');

    await expect(zkProver.initialize()).rejects.toThrow(
      'Circuit files not found for omega-v1.0.0.'
    );
    expect(zkProver.isInitialized()).toBe(false);
  });
});

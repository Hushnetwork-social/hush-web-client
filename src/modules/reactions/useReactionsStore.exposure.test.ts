import { afterEach, describe, expect, it, vi } from 'vitest';

describe('useReactionsStore E2E exposure', () => {
  afterEach(() => {
    delete (window as unknown as { __zustand_stores?: Record<string, unknown> }).__zustand_stores;
    delete process.env.NEXT_PUBLIC_DEBUG_LOGGING;
    vi.resetModules();
  });

  it('exposes reactionsStore on window.__zustand_stores when debug logging is enabled', async () => {
    process.env.NEXT_PUBLIC_DEBUG_LOGGING = 'true';

    const reactionsModule = await import('./useReactionsStore');
    const stores = (window as unknown as { __zustand_stores?: Record<string, unknown> }).__zustand_stores;

    expect(stores?.reactionsStore).toBe(reactionsModule.useReactionsStore);
  });
});

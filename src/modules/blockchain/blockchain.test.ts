/**
 * Blockchain Module Tests
 *
 * Tests for:
 * 1. Block height updates via BlockHeightSyncable
 * 2. Store state management
 * 3. Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBlockchainStore } from './useBlockchainStore';
import { BlockHeightSyncable } from './BlockHeightSyncable';
import * as BlockchainService from './BlockchainService';

// Mock the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useBlockchainStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useBlockchainStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useBlockchainStore.getState();

    expect(state.blockHeight).toBe(0);
    expect(state.isConnected).toBe(false);
    expect(state.lastError).toBeNull();
    expect(state.lastSyncTime).toBeNull();
  });

  it('should update block height and mark as connected', () => {
    useBlockchainStore.getState().setBlockHeight(100);

    const state = useBlockchainStore.getState();
    expect(state.blockHeight).toBe(100);
    expect(state.isConnected).toBe(true);
    expect(state.lastError).toBeNull();
    expect(state.lastSyncTime).not.toBeNull();
  });

  it('should update block height incrementally', () => {
    useBlockchainStore.getState().setBlockHeight(100);
    expect(useBlockchainStore.getState().blockHeight).toBe(100);

    useBlockchainStore.getState().setBlockHeight(105);
    expect(useBlockchainStore.getState().blockHeight).toBe(105);
  });

  it('should handle error state', () => {
    useBlockchainStore.getState().setError('Connection failed');

    const state = useBlockchainStore.getState();
    expect(state.lastError).toBe('Connection failed');
    expect(state.isConnected).toBe(false);
  });

  it('should clear error when block height is set', () => {
    // Set error first
    useBlockchainStore.getState().setError('Connection failed');
    expect(useBlockchainStore.getState().lastError).toBe('Connection failed');

    // Setting block height should clear error
    useBlockchainStore.getState().setBlockHeight(100);
    expect(useBlockchainStore.getState().lastError).toBeNull();
    expect(useBlockchainStore.getState().isConnected).toBe(true);
  });

  it('should reset to initial state', () => {
    // Set some state
    useBlockchainStore.getState().setBlockHeight(100);
    useBlockchainStore.getState().setError('Some error');

    // Reset
    useBlockchainStore.getState().reset();

    const state = useBlockchainStore.getState();
    expect(state.blockHeight).toBe(0);
    expect(state.isConnected).toBe(false);
    expect(state.lastError).toBeNull();
  });
});

describe('BlockchainService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('fetchBlockHeight', () => {
    it('should fetch and return block height', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ height: 150 }),
      });

      const height = await BlockchainService.fetchBlockHeight();

      expect(height).toBe(150);
      expect(mockFetch).toHaveBeenCalledWith('/api/blockchain/height');
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(BlockchainService.fetchBlockHeight()).rejects.toThrow(
        'Failed to fetch block height: HTTP 500'
      );
    });

    it('should throw error on invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data' }),
      });

      await expect(BlockchainService.fetchBlockHeight()).rejects.toThrow(
        'Invalid response: missing height'
      );
    });
  });

  describe('submitTransaction', () => {
    it('should submit transaction successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ successful: true, message: 'OK' }),
      });

      const result = await BlockchainService.submitTransaction('signed-tx-json');

      expect(result.successful).toBe(true);
      expect(result.message).toBe('OK');
      expect(mockFetch).toHaveBeenCalledWith('/api/blockchain/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransaction: 'signed-tx-json' }),
      });
    });

    it('should handle failed transaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ successful: false, message: 'Insufficient funds' }),
      });

      const result = await BlockchainService.submitTransaction('signed-tx-json');

      expect(result.successful).toBe(false);
      expect(result.message).toBe('Insufficient funds');
    });
  });
});

describe('BlockHeightSyncable', () => {
  let syncable: BlockHeightSyncable;

  beforeEach(() => {
    syncable = new BlockHeightSyncable();
    useBlockchainStore.getState().reset();
    mockFetch.mockReset();
  });

  it('should have correct properties', () => {
    expect(syncable.name).toBe('BlockHeightSyncable');
    expect(syncable.requiresAuth).toBe(false);
  });

  it('should update store on successful sync', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ height: 200 }),
    });

    await syncable.syncTask();

    const state = useBlockchainStore.getState();
    expect(state.blockHeight).toBe(200);
    expect(state.isConnected).toBe(true);
  });

  it('should only update store when height changes', async () => {
    // First sync
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ height: 200 }),
    });
    await syncable.syncTask();

    // Get initial sync time
    const firstSyncTime = useBlockchainStore.getState().lastSyncTime;

    // Wait a bit to ensure time difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second sync with same height
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ height: 200 }),
    });
    await syncable.syncTask();

    // Sync time should not have changed (no update)
    expect(useBlockchainStore.getState().lastSyncTime).toEqual(firstSyncTime);
  });

  it('should update store when height increases', async () => {
    // First sync
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ height: 200 }),
    });
    await syncable.syncTask();

    // Second sync with higher height
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ height: 201 }),
    });
    await syncable.syncTask();

    expect(useBlockchainStore.getState().blockHeight).toBe(201);
  });

  it('should set error state on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    await expect(syncable.syncTask()).rejects.toThrow();

    const state = useBlockchainStore.getState();
    expect(state.lastError).toBe('Failed to fetch block height: HTTP 503');
    expect(state.isConnected).toBe(false);
  });
});

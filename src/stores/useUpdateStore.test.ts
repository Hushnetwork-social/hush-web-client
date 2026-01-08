/**
 * useUpdateStore Tests
 *
 * Tests for:
 * 1. Initial state is correct
 * 2. setStatus updates status correctly
 * 3. setUpdateInfo updates updateInfo correctly
 * 4. setProgress updates progress correctly
 * 5. setError updates error correctly
 * 6. setShowOverlay updates showOverlay correctly
 * 7. reset() returns all state to initial values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUpdateStore } from './useUpdateStore';

describe('useUpdateStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUpdateStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have idle status initially', () => {
      const { status } = useUpdateStore.getState();
      expect(status).toBe('idle');
    });

    it('should have null updateInfo initially', () => {
      const { updateInfo } = useUpdateStore.getState();
      expect(updateInfo).toBeNull();
    });

    it('should have null progress initially', () => {
      const { progress } = useUpdateStore.getState();
      expect(progress).toBeNull();
    });

    it('should have null error initially', () => {
      const { error } = useUpdateStore.getState();
      expect(error).toBeNull();
    });

    it('should have showOverlay false initially', () => {
      const { showOverlay } = useUpdateStore.getState();
      expect(showOverlay).toBe(false);
    });
  });

  describe('setStatus', () => {
    it('should update status to checking', () => {
      useUpdateStore.getState().setStatus('checking');
      expect(useUpdateStore.getState().status).toBe('checking');
    });

    it('should update status to available', () => {
      useUpdateStore.getState().setStatus('available');
      expect(useUpdateStore.getState().status).toBe('available');
    });

    it('should update status to downloading', () => {
      useUpdateStore.getState().setStatus('downloading');
      expect(useUpdateStore.getState().status).toBe('downloading');
    });

    it('should update status to ready', () => {
      useUpdateStore.getState().setStatus('ready');
      expect(useUpdateStore.getState().status).toBe('ready');
    });

    it('should update status to error', () => {
      useUpdateStore.getState().setStatus('error');
      expect(useUpdateStore.getState().status).toBe('error');
    });

    it('should update status back to idle', () => {
      useUpdateStore.getState().setStatus('downloading');
      useUpdateStore.getState().setStatus('idle');
      expect(useUpdateStore.getState().status).toBe('idle');
    });
  });

  describe('setUpdateInfo', () => {
    it('should set update info with all fields', () => {
      const updateInfo = {
        version: '1.2.0',
        currentVersion: '1.1.0',
        body: 'Bug fixes and improvements',
        date: '2025-01-08',
      };

      useUpdateStore.getState().setUpdateInfo(updateInfo);

      expect(useUpdateStore.getState().updateInfo).toEqual(updateInfo);
    });

    it('should set update info with minimal fields', () => {
      const updateInfo = {
        version: '1.2.0',
        currentVersion: '1.1.0',
      };

      useUpdateStore.getState().setUpdateInfo(updateInfo);

      expect(useUpdateStore.getState().updateInfo).toEqual(updateInfo);
    });

    it('should clear update info when set to null', () => {
      useUpdateStore.getState().setUpdateInfo({
        version: '1.2.0',
        currentVersion: '1.1.0',
      });
      useUpdateStore.getState().setUpdateInfo(null);

      expect(useUpdateStore.getState().updateInfo).toBeNull();
    });
  });

  describe('setProgress', () => {
    it('should set progress with downloaded and total', () => {
      const progress = {
        downloaded: 5000000,
        total: 10000000,
      };

      useUpdateStore.getState().setProgress(progress);

      expect(useUpdateStore.getState().progress).toEqual(progress);
    });

    it('should set progress with null total (unknown size)', () => {
      const progress = {
        downloaded: 5000000,
        total: null,
      };

      useUpdateStore.getState().setProgress(progress);

      expect(useUpdateStore.getState().progress).toEqual(progress);
    });

    it('should update progress incrementally', () => {
      useUpdateStore.getState().setProgress({ downloaded: 1000, total: 10000 });
      useUpdateStore.getState().setProgress({ downloaded: 5000, total: 10000 });

      expect(useUpdateStore.getState().progress?.downloaded).toBe(5000);
    });

    it('should clear progress when set to null', () => {
      useUpdateStore.getState().setProgress({ downloaded: 5000, total: 10000 });
      useUpdateStore.getState().setProgress(null);

      expect(useUpdateStore.getState().progress).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useUpdateStore.getState().setError('Network error');
      expect(useUpdateStore.getState().error).toBe('Network error');
    });

    it('should clear error when set to null', () => {
      useUpdateStore.getState().setError('Network error');
      useUpdateStore.getState().setError(null);

      expect(useUpdateStore.getState().error).toBeNull();
    });

    it('should overwrite previous error', () => {
      useUpdateStore.getState().setError('First error');
      useUpdateStore.getState().setError('Second error');

      expect(useUpdateStore.getState().error).toBe('Second error');
    });
  });

  describe('setShowOverlay', () => {
    it('should set showOverlay to true', () => {
      useUpdateStore.getState().setShowOverlay(true);
      expect(useUpdateStore.getState().showOverlay).toBe(true);
    });

    it('should set showOverlay to false', () => {
      useUpdateStore.getState().setShowOverlay(true);
      useUpdateStore.getState().setShowOverlay(false);

      expect(useUpdateStore.getState().showOverlay).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Set all state values
      useUpdateStore.getState().setStatus('downloading');
      useUpdateStore.getState().setUpdateInfo({
        version: '1.2.0',
        currentVersion: '1.1.0',
        body: 'Release notes',
      });
      useUpdateStore.getState().setProgress({ downloaded: 5000, total: 10000 });
      useUpdateStore.getState().setError('Some error');
      useUpdateStore.getState().setShowOverlay(true);

      // Reset
      useUpdateStore.getState().reset();

      // Verify all values are reset
      const state = useUpdateStore.getState();
      expect(state.status).toBe('idle');
      expect(state.updateInfo).toBeNull();
      expect(state.progress).toBeNull();
      expect(state.error).toBeNull();
      expect(state.showOverlay).toBe(false);
    });

    it('should allow setting new state after reset', () => {
      useUpdateStore.getState().setStatus('downloading');
      useUpdateStore.getState().reset();
      useUpdateStore.getState().setStatus('available');

      expect(useUpdateStore.getState().status).toBe('available');
    });
  });

  describe('Combined State Changes', () => {
    it('should maintain independent state fields', () => {
      // Set multiple fields
      useUpdateStore.getState().setStatus('available');
      useUpdateStore.getState().setShowOverlay(true);

      // Update one field shouldn't affect others
      useUpdateStore.getState().setStatus('downloading');

      expect(useUpdateStore.getState().status).toBe('downloading');
      expect(useUpdateStore.getState().showOverlay).toBe(true);
    });

    it('should handle typical update flow', () => {
      // 1. Check for updates
      useUpdateStore.getState().setStatus('checking');
      expect(useUpdateStore.getState().status).toBe('checking');

      // 2. Update found
      useUpdateStore.getState().setStatus('available');
      useUpdateStore.getState().setUpdateInfo({
        version: '1.2.0',
        currentVersion: '1.1.0',
        body: 'New features',
      });
      useUpdateStore.getState().setShowOverlay(true);
      expect(useUpdateStore.getState().status).toBe('available');
      expect(useUpdateStore.getState().showOverlay).toBe(true);

      // 3. User clicks download
      useUpdateStore.getState().setStatus('downloading');
      useUpdateStore.getState().setProgress({ downloaded: 0, total: 10000000 });
      expect(useUpdateStore.getState().status).toBe('downloading');

      // 4. Progress updates
      useUpdateStore.getState().setProgress({ downloaded: 5000000, total: 10000000 });
      expect(useUpdateStore.getState().progress?.downloaded).toBe(5000000);

      // 5. Download complete
      useUpdateStore.getState().setStatus('ready');
      expect(useUpdateStore.getState().status).toBe('ready');
    });

    it('should handle error during download', () => {
      // Start download
      useUpdateStore.getState().setStatus('downloading');
      useUpdateStore.getState().setProgress({ downloaded: 1000, total: 10000 });

      // Error occurs
      useUpdateStore.getState().setStatus('error');
      useUpdateStore.getState().setError('Download failed: connection lost');

      expect(useUpdateStore.getState().status).toBe('error');
      expect(useUpdateStore.getState().error).toBe('Download failed: connection lost');
      // Progress should still be there (not automatically cleared)
      expect(useUpdateStore.getState().progress?.downloaded).toBe(1000);
    });
  });
});

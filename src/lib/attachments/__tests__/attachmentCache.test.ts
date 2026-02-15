/**
 * FEAT-066 / F2-011 & F2-012: Client cache stores downloaded attachments and LRU eviction.
 * Tests cache store/retrieve roundtrip, usage tracking, LRU eviction, and has/delete.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttachmentCache, MemoryBackend } from '../attachmentCache';

function createBytes(size: number): Uint8Array {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) data[i] = i % 256;
  return data;
}

describe('AttachmentCache (FEAT-066)', () => {
  let cache: AttachmentCache;
  let backend: MemoryBackend;

  beforeEach(() => {
    backend = new MemoryBackend();
    // Use 100 bytes max for easy testing of eviction
    cache = new AttachmentCache(backend, 100);
  });

  it('should store and retrieve round-trip', async () => {
    // Arrange
    const data = createBytes(30);

    // Act
    await cache.set('uuid-1', data);
    const retrieved = await cache.get('uuid-1');

    // Assert
    expect(retrieved).toEqual(data);
  });

  it('should report correct usage', async () => {
    // Arrange & Act
    await cache.set('a', createBytes(20));
    await cache.set('b', createBytes(30));

    // Assert
    expect(cache.getUsage()).toBe(50);
    expect(cache.getEntryCount()).toBe(2);
  });

  it('should evict oldest entries when cache exceeds limit (LRU)', async () => {
    // Arrange - fill cache to 90 bytes with 3 entries
    await cache.set('old', createBytes(30));  // accessed first (oldest)

    // Small delay to ensure different timestamps
    await cache.set('mid', createBytes(30));  // accessed second
    // Access 'mid' to make it more recent
    await cache.get('mid');

    await cache.set('new', createBytes(30));  // accessed third (newest)

    // Usage is now 90 bytes. Adding 20 more would exceed 100.

    // Act - add new entry that pushes past limit
    await cache.set('newest', createBytes(20));

    // Assert - 'old' should be evicted (oldest lastAccessed)
    expect(cache.has('old')).toBe(false);
    expect(cache.has('mid')).toBe(true);
    expect(cache.has('new')).toBe(true);
    expect(cache.has('newest')).toBe(true);
    expect(cache.getUsage()).toBeLessThanOrEqual(100);
  });

  it('should return false for non-cached UUID', () => {
    // Act & Assert
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('should return null for non-cached UUID get', async () => {
    // Act & Assert
    expect(await cache.get('nonexistent')).toBeNull();
  });

  it('should delete entry and reduce usage', async () => {
    // Arrange
    await cache.set('to-delete', createBytes(40));
    expect(cache.getUsage()).toBe(40);

    // Act
    await cache.delete('to-delete');

    // Assert
    expect(cache.has('to-delete')).toBe(false);
    expect(cache.getUsage()).toBe(0);
    expect(await cache.get('to-delete')).toBeNull();
  });

  it('should store thumbnail and original separately', async () => {
    // Arrange
    const original = createBytes(50);
    const thumb = createBytes(10);

    // Act
    await cache.set('uuid-1', original, 'original');
    await cache.set('uuid-1', thumb, 'thumbnail');

    // Assert
    const retrievedOriginal = await cache.get('uuid-1', 'original');
    const retrievedThumb = await cache.get('uuid-1', 'thumbnail');
    expect(retrievedOriginal).toEqual(original);
    expect(retrievedThumb).toEqual(thumb);
    expect(cache.getUsage()).toBe(60);
  });

  it('should clear all entries', async () => {
    // Arrange
    await cache.set('a', createBytes(10));
    await cache.set('b', createBytes(20));

    // Act
    await cache.clear();

    // Assert
    expect(cache.getUsage()).toBe(0);
    expect(cache.getEntryCount()).toBe(0);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
  });
});

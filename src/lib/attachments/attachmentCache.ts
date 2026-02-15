/**
 * FEAT-066: Client-side attachment cache with LRU eviction.
 *
 * Binary data is stored in IndexedDB (browser) or Tauri filesystem (desktop/mobile).
 * LRU metadata is tracked in memory and persisted to localStorage.
 * Maximum cache size: 100MB. Evicts least recently used entries when exceeded.
 */

import { MAX_CACHE_SIZE } from './types';
import type { CacheEntry } from './types';

const CACHE_METADATA_KEY = 'hush-attachment-cache-metadata';
const IDB_DB_NAME = 'hush-attachment-cache';
const IDB_STORE_NAME = 'attachments';

type CacheVariant = 'original' | 'thumbnail';

function cacheKey(attachmentId: string, variant: CacheVariant): string {
  return variant === 'thumbnail' ? `${attachmentId}_thumb` : attachmentId;
}

/** Interface for platform-specific binary storage. */
export interface IAttachmentCacheBackend {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, data: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** IndexedDB backend for browser environments. */
class IndexedDBBackend implements IAttachmentCacheBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(IDB_DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(IDB_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/** In-memory backend for testing. */
export class MemoryBackend implements IAttachmentCacheBackend {
  private store = new Map<string, Uint8Array>();

  async get(key: string): Promise<Uint8Array | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    this.store.set(key, data);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export class AttachmentCache {
  private metadata: Map<string, CacheEntry> = new Map();
  private backend: IAttachmentCacheBackend;
  private maxSize: number;

  constructor(backend?: IAttachmentCacheBackend, maxSize?: number) {
    this.backend = backend ?? new IndexedDBBackend();
    this.maxSize = maxSize ?? MAX_CACHE_SIZE;
    this.loadMetadata();
  }

  /** Check if an attachment variant is in the cache. */
  has(attachmentId: string, variant: CacheVariant = 'original'): boolean {
    const key = cacheKey(attachmentId, variant);
    return this.metadata.has(key);
  }

  /** Get cached attachment bytes. Returns null if not cached. */
  async get(attachmentId: string, variant: CacheVariant = 'original'): Promise<Uint8Array | null> {
    const key = cacheKey(attachmentId, variant);
    const entry = this.metadata.get(key);
    if (!entry) return null;

    const data = await this.backend.get(key);
    if (!data) {
      // Stale metadata - remove it
      this.metadata.delete(key);
      this.saveMetadata();
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    this.saveMetadata();

    return data;
  }

  /** Store attachment bytes in the cache, evicting LRU entries if needed. */
  async set(attachmentId: string, data: Uint8Array, variant: CacheVariant = 'original'): Promise<void> {
    const key = cacheKey(attachmentId, variant);
    const size = data.byteLength;

    // Evict until there's room
    await this.evictIfNeeded(size);

    // Store binary data
    await this.backend.set(key, data);

    // Update metadata
    const existing = this.metadata.get(attachmentId);
    this.metadata.set(key, {
      attachmentId,
      lastAccessed: Date.now(),
      size,
      hasThumbnail: variant === 'thumbnail' ? true : (existing?.hasThumbnail ?? false),
    });

    this.saveMetadata();
  }

  /** Delete an attachment from the cache (both original and thumbnail). */
  async delete(attachmentId: string): Promise<void> {
    const origKey = cacheKey(attachmentId, 'original');
    const thumbKey = cacheKey(attachmentId, 'thumbnail');

    await this.backend.delete(origKey);
    await this.backend.delete(thumbKey);
    this.metadata.delete(origKey);
    this.metadata.delete(thumbKey);
    this.saveMetadata();
  }

  /** Clear entire cache. */
  async clear(): Promise<void> {
    await this.backend.clear();
    this.metadata.clear();
    this.saveMetadata();
  }

  /** Get total cache usage in bytes. */
  getUsage(): number {
    let total = 0;
    for (const entry of this.metadata.values()) {
      total += entry.size;
    }
    return total;
  }

  /** Get number of entries in the cache. */
  getEntryCount(): number {
    return this.metadata.size;
  }

  private async evictIfNeeded(incomingSize: number): Promise<void> {
    const currentUsage = this.getUsage();
    if (currentUsage + incomingSize <= this.maxSize) return;

    // Sort entries by lastAccessed (oldest first)
    const sorted = [...this.metadata.entries()]
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    let freed = 0;
    const needed = currentUsage + incomingSize - this.maxSize;

    for (const [key, entry] of sorted) {
      if (freed >= needed) break;

      await this.backend.delete(key);
      this.metadata.delete(key);
      freed += entry.size;
    }

    this.saveMetadata();
  }

  private loadMetadata(): void {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem(CACHE_METADATA_KEY);
      if (stored) {
        const entries: [string, CacheEntry][] = JSON.parse(stored);
        this.metadata = new Map(entries);
      }
    } catch {
      // Corrupted metadata - start fresh
      this.metadata.clear();
    }
  }

  private saveMetadata(): void {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      const entries = [...this.metadata.entries()];
      localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(entries));
    } catch {
      // localStorage full - non-critical, metadata will be rebuilt
    }
  }
}

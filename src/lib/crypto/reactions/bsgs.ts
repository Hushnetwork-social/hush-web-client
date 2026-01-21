/**
 * Baby-Step Giant-Step (BSGS) Discrete Log Solver
 *
 * Used to decrypt reaction tallies by solving:
 *   Given M = m * G, find m
 *
 * For small values of m (reaction counts), BSGS is efficient:
 * - Time: O(sqrt(max_m))
 * - Space: O(sqrt(max_m))
 *
 * The precomputed table is cached in IndexedDB for fast subsequent loads.
 */

import {
  Point,
  addPoints,
  subPoints,
  scalarMul,
  getGenerator,
  isIdentity,
  pointToKey,
} from './babyjubjub';
import { BSGS } from './constants';
import { buildAssetUrl } from '@/lib/api-config';

// Size of the small-value fast lookup table
// Covers most reaction counts (typically 0-100)
const SMALL_VALUE_TABLE_SIZE = 256;

/**
 * BSGS Manager - handles table loading and discrete log solving
 */
class BSGSManager {
  private table: Map<string, number> | null = null;
  private giantStep: Point | null = null;
  private tableSize: number = BSGS.tableSize;
  private loadPromise: Promise<void> | null = null;

  // Fast lookup table for small values (0 to SMALL_VALUE_TABLE_SIZE-1)
  // Most reaction counts fall in this range, making lookup O(1)
  private smallValueTable: Map<string, number> | null = null;

  // Diagnostic counters for optimization tracking
  private smallTableHits = 0;
  private fullBsgsHits = 0;

  /**
   * Ensure the BSGS table is loaded
   */
  async ensureLoaded(): Promise<void> {
    if (this.table) return;

    if (!this.loadPromise) {
      this.loadPromise = this.load();
    }

    await this.loadPromise;
  }

  /**
   * Check if table is loaded
   */
  isLoaded(): boolean {
    return this.table !== null;
  }

  /**
   * Load the BSGS table from cache or compute it
   */
  private async load(): Promise<void> {
    // Try IndexedDB cache first
    const cached = await this.loadFromCache();
    if (cached) {
      this.initializeFromBuffer(cached);
      return;
    }

    // Try fetching precomputed table
    try {
      const tableUrl = buildAssetUrl(BSGS.tableUrl);
      const response = await fetch(tableUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        this.initializeFromBuffer(new Uint8Array(buffer));
        // Cache for next time
        this.saveToCache(buffer).catch(console.warn);
        return;
      }
    } catch (err) {
      console.warn('[BSGS] Failed to fetch from server:', err);
    }

    // Fallback: compute table locally
    this.computeTable();
  }

  /**
   * Compute the baby-step table locally
   */
  private computeTable(): void {
    const G = getGenerator();
    this.table = new Map();
    this.tableSize = BSGS.tableSize;

    // Baby steps: store i -> i*G for i in [0, n)
    let current: Point = { x: 0n, y: 1n }; // Identity
    for (let i = 0; i < this.tableSize; i++) {
      const key = pointToKey(current);
      this.table.set(key, i);
      current = addPoints(current, G);
    }

    // Giant step: n * G
    this.giantStep = scalarMul(G, BigInt(this.tableSize));

    // Build small-value table for fast O(1) lookup of common reaction counts
    this.buildSmallValueTable();
  }

  /**
   * Build a fast lookup table for small values (0 to SMALL_VALUE_TABLE_SIZE-1)
   * This covers most reaction counts and provides O(1) lookup
   */
  private buildSmallValueTable(): void {
    const G = getGenerator();
    this.smallValueTable = new Map();

    let current: Point = { x: 0n, y: 1n }; // Identity = 0
    for (let i = 0; i < SMALL_VALUE_TABLE_SIZE; i++) {
      const key = pointToKey(current);
      this.smallValueTable.set(key, i);
      current = addPoints(current, G);
    }

  }

  /**
   * Initialize from a precomputed binary buffer
   */
  private initializeFromBuffer(data: Uint8Array): void {
    const view = new DataView(data.buffer, data.byteOffset);

    // First 4 bytes: table size
    const count = view.getUint32(0, true);
    this.tableSize = count;
    this.table = new Map();

    let offset = 4;
    for (let i = 0; i < count; i++) {
      // 32 bytes x, 32 bytes y, 4 bytes value
      const x = this.readBigInt256(view, offset);
      offset += 32;
      const y = this.readBigInt256(view, offset);
      offset += 32;
      const value = view.getUint32(offset, true);
      offset += 4;

      const key = `${x.toString(16)}:${y.toString(16)}`;
      this.table.set(key, value);
    }

    // Compute giant step
    const G = getGenerator();
    this.giantStep = scalarMul(G, BigInt(count));

    // Build small-value table for fast O(1) lookup of common reaction counts
    this.buildSmallValueTable();
  }

  /**
   * Read a 256-bit big-endian integer from DataView
   */
  private readBigInt256(view: DataView, offset: number): bigint {
    let result = 0n;
    for (let i = 0; i < 32; i++) {
      result = (result << 8n) | BigInt(view.getUint8(offset + i));
    }
    return result;
  }

  /**
   * Solve discrete log: find k such that target = k * G
   *
   * Uses a two-phase approach:
   * 1. Fast O(1) lookup for small values (0-255) - covers most reaction counts
   * 2. Full BSGS algorithm for larger values
   *
   * @param target - The point to solve
   * @returns The discrete log k, or null if not found
   */
  solve(target: Point): number | null {
    if (!this.table || !this.giantStep) {
      throw new Error('BSGS table not loaded');
    }

    // Handle identity (count = 0)
    if (isIdentity(target)) {
      return 0;
    }

    // Fast path: check small-value table first (O(1) lookup)
    // Most reaction counts are small (< 256), so this handles the common case
    if (this.smallValueTable) {
      const key = pointToKey(target);
      const smallValue = this.smallValueTable.get(key);
      if (smallValue !== undefined) {
        this.smallTableHits++;
        return smallValue;
      }
    }

    // Slow path: full BSGS algorithm for larger values
    const n = this.tableSize;
    let current = target;

    // Giant steps: subtract j * (n * G) and look up in baby-step table
    for (let j = 0; j < n; j++) {
      const key = pointToKey(current);

      if (this.table.has(key)) {
        const i = this.table.get(key)!;
        this.fullBsgsHits++;
        return j * n + i;
      }

      // current = current - (n * G)
      current = subPoints(current, this.giantStep);
    }

    // Not found (count > maxValue)
    return null;
  }

  /**
   * Load table from IndexedDB cache
   */
  private async loadFromCache(): Promise<Uint8Array | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('bsgs', 'readonly');
        const store = tx.objectStore('bsgs');
        const request = store.get(BSGS.cacheKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Save table to IndexedDB cache
   */
  private async saveToCache(buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('bsgs', 'readwrite');
        const store = tx.objectStore('bsgs');
        const request = store.put(new Uint8Array(buffer), BSGS.cacheKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[BSGS] Failed to cache table:', err);
    }
  }

  /**
   * Open IndexedDB for BSGS cache
   */
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('hush-crypto', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('bsgs')) {
          db.createObjectStore('bsgs');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get the maximum value this solver can handle
   */
  getMaxValue(): number {
    return this.tableSize * this.tableSize;
  }

  /**
   * Get and reset diagnostic stats
   */
  getAndResetStats(): { smallTableHits: number; fullBsgsHits: number } {
    const stats = {
      smallTableHits: this.smallTableHits,
      fullBsgsHits: this.fullBsgsHits,
    };
    this.smallTableHits = 0;
    this.fullBsgsHits = 0;
    return stats;
  }

  /**
   * Clear the cached table (for testing)
   */
  async clearCache(): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('bsgs', 'readwrite');
        const store = tx.objectStore('bsgs');
        const request = store.delete(BSGS.cacheKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Ignore errors
    }

    this.table = null;
    this.giantStep = null;
    this.loadPromise = null;
    this.smallValueTable = null;
  }
}

// Singleton instance
export const bsgsManager = new BSGSManager();

/**
 * Convenience function to solve discrete log
 */
export async function solveDiscreteLog(target: Point): Promise<number | null> {
  await bsgsManager.ensureLoaded();
  return bsgsManager.solve(target);
}

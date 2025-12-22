/**
 * Circuit Version Manager
 *
 * Manages ZK circuit versions for upgrades and vulnerability fixes.
 * The server may reject proofs from outdated circuit versions.
 */

import { CIRCUIT } from '../crypto/reactions/constants';
import { zkProver } from './prover';

/**
 * Circuit version info from server
 */
export interface CircuitVersionInfo {
  currentVersion: string;
  minimumVersion: string;
  deprecatedVersions: string[];
}

/**
 * Circuit Manager - handles version checking and updates
 */
class CircuitManager {
  private currentVersion: string = CIRCUIT.version;
  private minimumVersion: string = CIRCUIT.version;
  private isInitialized = false;

  /**
   * Initialize circuit manager and check for updates
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // TODO: Fetch current version from server
    // const versionInfo = await this.fetchVersionInfo();
    // this.currentVersion = versionInfo.currentVersion;
    // this.minimumVersion = versionInfo.minimumVersion;

    // Initialize the prover with current version
    await zkProver.initialize(this.currentVersion);
    this.isInitialized = true;

    console.log(`[CircuitManager] Initialized with version ${this.currentVersion}`);
  }

  /**
   * Fetch version info from server
   */
  private async fetchVersionInfo(): Promise<CircuitVersionInfo> {
    // TODO: Implement actual server call
    // const response = await grpcClient.getCircuitVersion();
    return {
      currentVersion: CIRCUIT.version,
      minimumVersion: CIRCUIT.version,
      deprecatedVersions: [],
    };
  }

  /**
   * Force update to a specific version
   */
  async forceUpdate(version: string): Promise<void> {
    console.log(`[CircuitManager] Forcing update to ${version}`);
    this.currentVersion = version;
    await zkProver.initialize(version);
  }

  /**
   * Check if current version is valid
   */
  isVersionValid(): boolean {
    return this.compareVersions(this.currentVersion, this.minimumVersion) >= 0;
  }

  /**
   * Get current circuit version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Get minimum required version
   */
  getMinimumVersion(): string {
    return this.minimumVersion;
  }

  /**
   * Compare version strings (semver-like)
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareVersions(a: string, b: string): number {
    // Extract version numbers from "omega-v1.0.0" format
    const parseVersion = (v: string): number[] => {
      const match = v.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (!match) return [0, 0, 0];
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    };

    const vA = parseVersion(a);
    const vB = parseVersion(b);

    for (let i = 0; i < 3; i++) {
      if (vA[i] < vB[i]) return -1;
      if (vA[i] > vB[i]) return 1;
    }

    return 0;
  }

  /**
   * Handle circuit version error from server
   */
  async handleVersionError(requiredVersion: string): Promise<void> {
    console.warn(`[CircuitManager] Server requires version ${requiredVersion}`);

    // Update to required version
    await this.forceUpdate(requiredVersion);
  }
}

// Singleton instance
export const circuitManager = new CircuitManager();

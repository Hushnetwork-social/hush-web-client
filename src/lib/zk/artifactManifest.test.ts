import { describe, expect, it } from 'vitest';

import { CIRCUIT } from '../crypto/reactions/constants';
import {
  getApprovedCircuitArtifacts,
  listApprovedCircuitVersions,
} from './artifactManifest';

describe('artifactManifest', () => {
  it('returns the approved FEAT-087 artifact set for the current circuit version', () => {
    expect(getApprovedCircuitArtifacts(CIRCUIT.version)).toEqual({
      version: CIRCUIT.version,
      basePath: `/circuits/${CIRCUIT.version}`,
      wasmPath: `/circuits/${CIRCUIT.version}/reaction.wasm`,
      zkeyPath: `/circuits/${CIRCUIT.version}/reaction.zkey`,
      provenance: 'FEAT-087 approved artifact set',
    });
  });

  it('lists the current circuit version as the only approved FEAT-087 artifact version', () => {
    expect(listApprovedCircuitVersions()).toEqual([CIRCUIT.version]);
  });

  it('rejects artifact requests for unapproved versions', () => {
    expect(() => getApprovedCircuitArtifacts('omega-v9.9.9')).toThrow(
      "Circuit version 'omega-v9.9.9' is not part of the approved FEAT-087 artifact set."
    );
  });
});

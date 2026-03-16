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
      wasmSha256: '71D1EE45D944313BB2C86A1851F3B09A481481675FA80DDFD3205D99D7613F8B',
      zkeySha256: '65620ABC5030404403C19B22B623E115807EB2603CB5953F195959A76BA91B5C',
      installGuidePath: `/circuits/${CIRCUIT.version}/README.md`,
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

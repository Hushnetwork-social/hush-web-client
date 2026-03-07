import { CIRCUIT } from '../crypto/reactions/constants';

export interface ApprovedCircuitArtifacts {
  version: string;
  basePath: string;
  wasmPath: string;
  zkeyPath: string;
  provenance: string;
}

const approvedArtifactsByVersion: Record<string, ApprovedCircuitArtifacts> = {
  [CIRCUIT.version]: {
    version: CIRCUIT.version,
    basePath: `/circuits/${CIRCUIT.version}`,
    wasmPath: `/circuits/${CIRCUIT.version}/reaction.wasm`,
    zkeyPath: `/circuits/${CIRCUIT.version}/reaction.zkey`,
    provenance: 'FEAT-087 approved artifact set',
  },
};

export function getApprovedCircuitArtifacts(version: string): ApprovedCircuitArtifacts {
  const artifacts = approvedArtifactsByVersion[version];
  if (!artifacts) {
    throw new Error(
      `Circuit version '${version}' is not part of the approved FEAT-087 artifact set.`
    );
  }

  return artifacts;
}

export function listApprovedCircuitVersions(): string[] {
  return Object.keys(approvedArtifactsByVersion);
}

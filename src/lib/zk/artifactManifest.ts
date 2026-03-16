import { CIRCUIT } from '../crypto/reactions/constants';

export interface ApprovedCircuitArtifacts {
  version: string;
  basePath: string;
  wasmPath: string;
  zkeyPath: string;
  wasmSha256: string;
  zkeySha256: string;
  installGuidePath: string;
  provenance: string;
}

const approvedArtifactsByVersion: Record<string, ApprovedCircuitArtifacts> = {
  [CIRCUIT.version]: {
    version: CIRCUIT.version,
    basePath: `/circuits/${CIRCUIT.version}`,
    wasmPath: `/circuits/${CIRCUIT.version}/reaction.wasm`,
    zkeyPath: `/circuits/${CIRCUIT.version}/reaction.zkey`,
    wasmSha256: '71D1EE45D944313BB2C86A1851F3B09A481481675FA80DDFD3205D99D7613F8B',
    zkeySha256: '65620ABC5030404403C19B22B623E115807EB2603CB5953F195959A76BA91B5C',
    installGuidePath: `/circuits/${CIRCUIT.version}/README.md`,
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

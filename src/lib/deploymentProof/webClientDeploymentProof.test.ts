import { describe, expect, it } from 'vitest';
import {
  WEBCLIENT_DEPLOYMENT_PROOF_HEADERS,
  normalizeWebClientDeploymentProofMetadata,
} from './webClientDeploymentProofContract';
import {
  getWebClientDeploymentProofHeaders,
  getWebClientDeploymentProofMetadata,
} from './webClientDeploymentProof';

const validMetadata = {
  schemaVersion: 'hush-webclient-deployment-proof-handshake-v1',
  componentId: 'hush-web-client',
  deploymentProofId: 'webclient-proof-v1',
  deploymentTarget: 'hush-prod',
  sourceRef: 'git:refs/tags/webclient-proof-v1',
  webArtifactHash: `sha256:${'a'.repeat(64)}`,
  clientBundleHash: `sha256:${'b'.repeat(64)}`,
  packageHash: `${'c'.repeat(64)}`,
  publicPackageRef: 'https://github.com/HushNetworkOrg/deployment-proofs/tree/webclient-proof-v1',
  deploymentProtocolVersion: 'hushvoting-deployment-protocol-v1',
  evidenceStatus: 'accepted',
  generatedAtUtc: '2026-05-26T12:00:00.000Z',
};

describe('WebClient deployment proof metadata', () => {
  it('normalizes public-safe metadata', () => {
    const result = normalizeWebClientDeploymentProofMetadata(validMetadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.deploymentProofId).toBe('webclient-proof-v1');
      expect(result.metadata.packageHash).toBe('c'.repeat(64));
    }
  });

  it('rejects private deployment provider material', () => {
    const result = normalizeWebClientDeploymentProofMetadata({
      ...validMetadata,
      publicPackageRef: 'aws:kms:eu-central-1:123456789012:key/private',
    });

    expect(result).toEqual({
      ok: false,
      code: 'webclient_proof_private_only',
      message: 'publicPackageRef contains restricted material',
    });
  });

  it('rejects governed outcome states as deployment proof metadata', () => {
    const result = normalizeWebClientDeploymentProofMetadata({
      ...validMetadata,
      evidenceStatus: 'finalized_with_anomaly',
    });

    expect(result).toEqual({
      ok: false,
      code: 'webclient_proof_unknown',
      message: 'Unsupported WebClient deployment proof evidence status.',
    });
  });

  it('exposes deterministic generated metadata from the browser bundle helper', () => {
    const metadata = getWebClientDeploymentProofMetadata();

    expect(metadata).toMatchObject({
      schemaVersion: 'hush-webclient-deployment-proof-handshake-v1',
      componentId: 'hush-web-client',
      deploymentProofId: 'local-dev-webclient-proof-not-claiming',
    });
  });

  it('projects generated metadata into FEAT-144 headers', () => {
    const headers = getWebClientDeploymentProofHeaders('election_query');

    expect(headers).toMatchObject({
      [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.schemaVersion]:
        'hush-webclient-deployment-proof-handshake-v1',
      [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.componentId]: 'hush-web-client',
      [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.observationScope]: 'election_query',
    });
  });
});

import { describe, expect, it } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToBase64, bytesToHex, hexToBytes } from '@/lib/crypto';
import {
  createTrusteeShareVaultEnvelope,
  decryptStoredTrusteeShareVaultEnvelope,
  deriveTrusteeCloseCountingShareMaterial,
  extractTrusteeCloseCountingShare,
  TRUSTEE_SHARE_VAULT_MESSAGE_TYPE,
  TRUSTEE_SHARE_VAULT_PAYLOAD_VERSION,
} from './trusteeShareVault';

const mnemonic = [
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'about',
];
const trusteeEncryptionPrivateKey = '1111111111111111111111111111111111111111111111111111111111111111';
const trusteeEncryptionPublicKey = bytesToHex(
  secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKey), true)
);

describe('trusteeShareVault', () => {
  it('creates a double-encrypted trustee vault envelope that roundtrips through stored ceremony bytes', async () => {
    const closeCountingShare = await deriveTrusteeCloseCountingShareMaterial({
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-1',
      trusteeUserAddress: 'trustee-a',
      mnemonic,
      shareVersion: 'share-v1',
    });
    const envelope = await createTrusteeShareVaultEnvelope({
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-1',
      trusteeUserAddress: 'trustee-a',
      trusteeEncryptionPublicKey,
      mnemonic,
      shareVersion: 'share-v1',
      material: {
        packageKind: 'trustee-ceremony-package',
        ceremonyMessageType: 'dkg-share-package',
        ceremonyPayloadVersion: 'omega-v1.0.0',
        ceremonyPayloadFingerprint: 'package-fingerprint',
        ceremonyEncryptedPayload: '{"packageKind":"trustee-ceremony-package"}',
        transportPublicKeyFingerprint: 'transport-fingerprint',
        protocolVersion: 'omega-v1.0.0',
        profileId: 'dkg-prod-3of5',
        versionNumber: 1,
        closeCountingShare,
      },
    });

    expect(envelope.messageType).toBe(TRUSTEE_SHARE_VAULT_MESSAGE_TYPE);
    expect(envelope.payloadVersion).toBe(TRUSTEE_SHARE_VAULT_PAYLOAD_VERSION);
    expect(envelope.payloadFingerprint).toHaveLength(64);

    const storedEnvelopePayload = bytesToBase64(
      new TextEncoder().encode(envelope.encryptedPayload)
    );
    const decrypted = await decryptStoredTrusteeShareVaultEnvelope(
      storedEnvelopePayload,
      trusteeEncryptionPrivateKey,
      mnemonic
    );

    expect(decrypted.electionId).toBe('election-1');
    expect(decrypted.ceremonyVersionId).toBe('ceremony-1');
    expect(decrypted.trusteeUserAddress).toBe('trustee-a');
    expect(decrypted.shareVersion).toBe('share-v1');
    expect(decrypted.material.ceremonyPayloadFingerprint).toBe('package-fingerprint');
    expect(decrypted.material.transportPublicKeyFingerprint).toBe('transport-fingerprint');
    expect(decrypted.material.closeCountingShare).toEqual(closeCountingShare);

    const resolvedShare = extractTrusteeCloseCountingShare(decrypted);
    expect(resolvedShare.shareVersion).toBe('share-v1');
    expect(resolvedShare.shareMaterial).toBe(closeCountingShare.scalarMaterial);
    expect(resolvedShare.shareMaterialHash).toBe(closeCountingShare.scalarMaterialHash);
  });

  it('rejects a stored envelope when the trustee derives the wrong inner vault key', async () => {
    const closeCountingShare = await deriveTrusteeCloseCountingShareMaterial({
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-1',
      trusteeUserAddress: 'trustee-a',
      mnemonic,
      shareVersion: 'share-v1',
    });
    const envelope = await createTrusteeShareVaultEnvelope({
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-1',
      trusteeUserAddress: 'trustee-a',
      trusteeEncryptionPublicKey,
      mnemonic,
      shareVersion: 'share-v1',
      material: {
        packageKind: 'trustee-ceremony-package',
        ceremonyMessageType: 'dkg-share-package',
        ceremonyPayloadVersion: 'omega-v1.0.0',
        ceremonyPayloadFingerprint: 'package-fingerprint',
        ceremonyEncryptedPayload: '{"packageKind":"trustee-ceremony-package"}',
        transportPublicKeyFingerprint: 'transport-fingerprint',
        protocolVersion: 'omega-v1.0.0',
        profileId: 'dkg-prod-3of5',
        versionNumber: 1,
        closeCountingShare,
      },
    });

    const storedEnvelopePayload = bytesToBase64(
      new TextEncoder().encode(envelope.encryptedPayload)
    );

    await expect(
      decryptStoredTrusteeShareVaultEnvelope(
        storedEnvelopePayload,
        trusteeEncryptionPrivateKey,
        ['legal', 'winner', 'thank', 'year', 'wave', 'sausage', 'worth', 'useful', 'legal', 'winner', 'thank', 'yellow']
      )
    ).rejects.toThrow();
  });

  it('derives the same trustee-local close-counting share for the same ceremony scope', async () => {
    const first = await deriveTrusteeCloseCountingShareMaterial({
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-1',
      trusteeUserAddress: 'trustee-a',
      mnemonic,
      shareVersion: 'share-v1',
    });
    const second = await deriveTrusteeCloseCountingShareMaterial({
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-1',
      trusteeUserAddress: 'trustee-a',
      mnemonic,
      shareVersion: 'share-v1',
    });

    expect(first).toEqual(second);
    expect(first.scalarMaterial).toMatch(/^[0-9]+$/);
    expect(first.scalarMaterialHash).toHaveLength(64);
  });
});

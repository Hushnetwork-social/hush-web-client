import {
  aesDecrypt,
  aesEncrypt,
  base64ToBytes,
  bytesToBase64,
  eciesDecrypt,
  eciesEncrypt,
} from '@/lib/crypto';
import { BABYJUBJUB } from '@/lib/crypto/reactions/constants';

export const TRUSTEE_SHARE_VAULT_MESSAGE_TYPE = 'trustee-share-vault-package';
export const TRUSTEE_SHARE_VAULT_PAYLOAD_VERSION = 'omega-trustee-share-vault-v1';
export const TRUSTEE_CLOSE_COUNTING_SHARE_FORMAT = 'omega-controlled-threshold-scalar-v1';

const TRUSTEE_SHARE_VAULT_INNER_VERSION = 'omega-trustee-share-vault-inner-v1';
const TRUSTEE_SHARE_VAULT_KEY_INFO = new TextEncoder().encode(
  'protocol_omega/trustee_share_vault/v1'
);
const TRUSTEE_CLOSE_COUNTING_SHARE_INFO = new TextEncoder().encode(
  'protocol_omega/trustee_close_counting_scalar/v1'
);

export type TrusteeShareVaultMaterialKind = 'ceremony-package';

export type TrusteeCloseCountingShareMaterial = {
  format: typeof TRUSTEE_CLOSE_COUNTING_SHARE_FORMAT;
  scalarMaterial: string;
  scalarMaterialHash: string;
};

export type TrusteeCeremonyVaultMaterial = {
  packageKind: 'trustee-ceremony-package';
  ceremonyMessageType: string;
  ceremonyPayloadVersion: string;
  ceremonyPayloadFingerprint: string;
  ceremonyEncryptedPayload: string;
  transportPublicKeyFingerprint: string;
  protocolVersion: string;
  profileId: string;
  versionNumber: number;
  closeCountingShare: TrusteeCloseCountingShareMaterial;
};

export type TrusteeShareVaultInnerPayload = {
  packageVersion: string;
  materialKind: TrusteeShareVaultMaterialKind;
  electionId: string;
  ceremonyVersionId: string;
  trusteeUserAddress: string;
  shareVersion: string;
  material: TrusteeCeremonyVaultMaterial;
};

type TrusteeShareVaultOuterEnvelope = {
  packageVersion: string;
  materialKind: TrusteeShareVaultMaterialKind;
  electionId: string;
  ceremonyVersionId: string;
  trusteeUserAddress: string;
  shareVersion: string;
  encryptedInnerPayload: string;
};

export type CreateTrusteeShareVaultEnvelopeParams = {
  electionId: string;
  ceremonyVersionId: string;
  trusteeUserAddress: string;
  trusteeEncryptionPublicKey: string;
  mnemonic: string[];
  shareVersion: string;
  material: TrusteeCeremonyVaultMaterial;
};

export type TrusteeShareVaultEnvelope = {
  messageType: string;
  payloadVersion: string;
  encryptedPayload: string;
  payloadFingerprint: string;
  shareVersion: string;
};

export type DeriveTrusteeCloseCountingShareMaterialParams = {
  electionId: string;
  ceremonyVersionId: string;
  trusteeUserAddress: string;
  mnemonic: string[];
  shareVersion: string;
};

export type TrusteeResolvedCloseCountingShare = {
  shareVersion: string;
  shareMaterial: string;
  shareMaterialHash: string;
  shareFormat: typeof TRUSTEE_CLOSE_COUNTING_SHARE_FORMAT;
};

function ensureNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmed;
}

async function deriveTrusteeShareVaultKey(
  mnemonic: string[],
  electionId: string,
  ceremonyVersionId: string,
  trusteeUserAddress: string,
  shareVersion: string
): Promise<string> {
  if (!mnemonic.length) {
    throw new Error('Trustee mnemonic is required to protect the share vault.');
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(mnemonic.join(' ')),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  const salt = encoder.encode(
    [
      'trustee-share-vault',
      ensureNonEmpty(electionId, 'ElectionId'),
      ensureNonEmpty(ceremonyVersionId, 'CeremonyVersionId'),
      ensureNonEmpty(trusteeUserAddress, 'TrusteeUserAddress'),
      ensureNonEmpty(shareVersion, 'ShareVersion'),
    ].join(':')
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: TRUSTEE_SHARE_VAULT_KEY_INFO,
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

async function computePayloadFingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function bytesToBigint(bytes: Uint8Array): bigint {
  let result = 0n;

  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }

  return result;
}

export async function deriveTrusteeCloseCountingShareMaterial(
  params: DeriveTrusteeCloseCountingShareMaterialParams
): Promise<TrusteeCloseCountingShareMaterial> {
  if (!params.mnemonic.length) {
    throw new Error('Trustee mnemonic is required to derive the close-counting share.');
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(params.mnemonic.join(' ')),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  const salt = encoder.encode(
    [
      'trustee-close-counting-share',
      ensureNonEmpty(params.electionId, 'ElectionId'),
      ensureNonEmpty(params.ceremonyVersionId, 'CeremonyVersionId'),
      ensureNonEmpty(params.trusteeUserAddress, 'TrusteeUserAddress'),
      ensureNonEmpty(params.shareVersion, 'ShareVersion'),
    ].join(':')
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: TRUSTEE_CLOSE_COUNTING_SHARE_INFO,
    },
    keyMaterial,
    256
  );
  const reduced = bytesToBigint(new Uint8Array(derivedBits)) % BABYJUBJUB.order;
  const scalarMaterial = (reduced === 0n ? 1n : reduced).toString(10);

  return {
    format: TRUSTEE_CLOSE_COUNTING_SHARE_FORMAT,
    scalarMaterial,
    scalarMaterialHash: await computePayloadFingerprint(scalarMaterial),
  };
}

export function extractTrusteeCloseCountingShare(
  payload: TrusteeShareVaultInnerPayload
): TrusteeResolvedCloseCountingShare {
  const share = payload.material.closeCountingShare;
  const shareMaterial = ensureNonEmpty(share?.scalarMaterial ?? '', 'ScalarMaterial');

  if (share?.format !== TRUSTEE_CLOSE_COUNTING_SHARE_FORMAT) {
    throw new Error(`Unsupported trustee close-counting share format '${share?.format ?? ''}'.`);
  }

  if (!/^[0-9]+$/.test(shareMaterial)) {
    throw new Error('Trustee close-counting share material must be a decimal scalar.');
  }

  return {
    shareVersion: payload.shareVersion,
    shareMaterial,
    shareMaterialHash: ensureNonEmpty(share.scalarMaterialHash, 'ScalarMaterialHash'),
    shareFormat: share.format,
  };
}

export async function createTrusteeShareVaultEnvelope(
  params: CreateTrusteeShareVaultEnvelopeParams
): Promise<TrusteeShareVaultEnvelope> {
  const electionId = ensureNonEmpty(params.electionId, 'ElectionId');
  const ceremonyVersionId = ensureNonEmpty(params.ceremonyVersionId, 'CeremonyVersionId');
  const trusteeUserAddress = ensureNonEmpty(params.trusteeUserAddress, 'TrusteeUserAddress');
  const shareVersion = ensureNonEmpty(params.shareVersion, 'ShareVersion');
  const trusteeEncryptionPublicKey = ensureNonEmpty(
    params.trusteeEncryptionPublicKey,
    'TrusteeEncryptionPublicKey'
  );

  const innerPayload: TrusteeShareVaultInnerPayload = {
    packageVersion: TRUSTEE_SHARE_VAULT_INNER_VERSION,
    materialKind: 'ceremony-package',
    electionId,
    ceremonyVersionId,
    trusteeUserAddress,
    shareVersion,
    material: params.material,
  };

  const vaultAesKey = await deriveTrusteeShareVaultKey(
    params.mnemonic,
    electionId,
    ceremonyVersionId,
    trusteeUserAddress,
    shareVersion
  );
  const encryptedInnerPayload = await aesEncrypt(
    JSON.stringify(innerPayload),
    vaultAesKey
  );
  const outerEnvelope: TrusteeShareVaultOuterEnvelope = {
    packageVersion: TRUSTEE_SHARE_VAULT_PAYLOAD_VERSION,
    materialKind: innerPayload.materialKind,
    electionId,
    ceremonyVersionId,
    trusteeUserAddress,
    shareVersion,
    encryptedInnerPayload,
  };
  const encryptedPayload = await eciesEncrypt(
    JSON.stringify(outerEnvelope),
    trusteeEncryptionPublicKey
  );

  return {
    messageType: TRUSTEE_SHARE_VAULT_MESSAGE_TYPE,
    payloadVersion: TRUSTEE_SHARE_VAULT_PAYLOAD_VERSION,
    encryptedPayload,
    payloadFingerprint: await computePayloadFingerprint(encryptedPayload),
    shareVersion,
  };
}

export async function decryptStoredTrusteeShareVaultEnvelope(
  storedEnvelopePayload: string,
  trusteeEncryptionPrivateKey: string,
  mnemonic: string[]
): Promise<TrusteeShareVaultInnerPayload> {
  const serializedCiphertext = new TextDecoder().decode(
    base64ToBytes(ensureNonEmpty(storedEnvelopePayload, 'StoredEnvelopePayload'))
  );
  const outerEnvelopeJson = await eciesDecrypt(
    serializedCiphertext,
    ensureNonEmpty(trusteeEncryptionPrivateKey, 'TrusteeEncryptionPrivateKey')
  );
  const outerEnvelope = JSON.parse(outerEnvelopeJson) as TrusteeShareVaultOuterEnvelope;

  if (outerEnvelope.packageVersion !== TRUSTEE_SHARE_VAULT_PAYLOAD_VERSION) {
    throw new Error(`Unsupported trustee share vault package version '${outerEnvelope.packageVersion}'.`);
  }

  const vaultAesKey = await deriveTrusteeShareVaultKey(
    mnemonic,
    outerEnvelope.electionId,
    outerEnvelope.ceremonyVersionId,
    outerEnvelope.trusteeUserAddress,
    outerEnvelope.shareVersion
  );
  const innerPayloadJson = await aesDecrypt(
    ensureNonEmpty(outerEnvelope.encryptedInnerPayload, 'EncryptedInnerPayload'),
    vaultAesKey
  );
  const innerPayload = JSON.parse(innerPayloadJson) as TrusteeShareVaultInnerPayload;

  if (innerPayload.packageVersion !== TRUSTEE_SHARE_VAULT_INNER_VERSION) {
    throw new Error(`Unsupported trustee share vault inner payload version '${innerPayload.packageVersion}'.`);
  }

  if (
    innerPayload.electionId !== outerEnvelope.electionId ||
    innerPayload.ceremonyVersionId !== outerEnvelope.ceremonyVersionId ||
    innerPayload.trusteeUserAddress !== outerEnvelope.trusteeUserAddress ||
    innerPayload.shareVersion !== outerEnvelope.shareVersion
  ) {
    throw new Error('Trustee share vault binding mismatch.');
  }

  return innerPayload;
}

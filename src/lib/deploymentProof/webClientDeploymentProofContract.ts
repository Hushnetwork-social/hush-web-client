export const WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION =
  'hush-webclient-deployment-proof-handshake-v1' as const;
export const WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID = 'hush-web-client' as const;
export const WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION =
  'hushvoting-deployment-protocol-v1' as const;

export const WEBCLIENT_DEPLOYMENT_PROOF_HEADERS = {
  schemaVersion: 'x-hush-webclient-proof-schema',
  componentId: 'x-hush-webclient-component-id',
  deploymentProofId: 'x-hush-webclient-proof-id',
  sourceRef: 'x-hush-webclient-source-ref',
  webArtifactHash: 'x-hush-webclient-web-artifact-hash',
  clientBundleHash: 'x-hush-webclient-bundle-hash',
  packageHash: 'x-hush-webclient-package-hash',
  publicPackageRef: 'x-hush-webclient-package-ref',
  deploymentTarget: 'x-hush-webclient-deployment-target',
  evidenceStatus: 'x-hush-webclient-proof-status',
  deploymentProtocolVersion: 'x-hush-webclient-deployment-protocol',
  generatedAtUtc: 'x-hush-webclient-generated-at-utc',
  observationScope: 'x-hush-webclient-observation-scope',
} as const;

export type WebClientDeploymentProofEvidenceStatus =
  | 'accepted'
  | 'accepted_with_limitations'
  | 'degraded'
  | 'missing'
  | 'stale'
  | 'superseded'
  | 'unknown';

export type WebClientDeploymentProofMetadata = {
  schemaVersion: typeof WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION;
  componentId: typeof WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID;
  deploymentProofId: string;
  deploymentTarget: string;
  sourceRef: string;
  webArtifactHash: string;
  clientBundleHash: string;
  packageHash?: string;
  publicPackageRef?: string;
  deploymentProtocolVersion: typeof WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION;
  evidenceStatus: WebClientDeploymentProofEvidenceStatus;
  generatedAtUtc: string;
};

export type WebClientDeploymentProofObservation =
  Partial<WebClientDeploymentProofMetadata> & {
    observationScope: string;
    evidenceStatus: WebClientDeploymentProofEvidenceStatus | 'private_only';
  };

export type WebClientDeploymentProofValidationResult =
  | { ok: true; metadata: WebClientDeploymentProofMetadata }
  | { ok: false; code: string; message: string };

const OPTIONAL_FIELDS = new Set<keyof WebClientDeploymentProofMetadata>([
  'packageHash',
  'publicPackageRef',
]);

const EVIDENCE_STATUSES = new Set<WebClientDeploymentProofEvidenceStatus>([
  'accepted',
  'accepted_with_limitations',
  'degraded',
  'missing',
  'stale',
  'superseded',
  'unknown',
]);

const HASH_PATTERN = /^(sha256:)?[a-fA-F0-9]{64}$/;
const PUBLIC_VALUE_PATTERN = /^[a-zA-Z0-9._:/@+?&=%#,\-[\]]+$/;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_VALUE_LENGTH = 512;
const MAX_TOTAL_HEADER_LENGTH = 4096;

const FORBIDDEN_PUBLIC_FRAGMENTS = [
  'private key',
  'begin private key',
  'kms:',
  'aws:kms',
  'kms alias',
  'password',
  'secret access key',
  'connection string',
  'raw log',
  'support log',
  'voter identity',
  'vote choice',
  'trustee share',
  'receipt secret',
  'nullifier',
  'credential',
  'session id',
  'user-agent',
  'ip address',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasForbiddenMaterial(value: string): boolean {
  const normalized = value.toLowerCase();
  return FORBIDDEN_PUBLIC_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function validatePublicField(
  fieldName: keyof WebClientDeploymentProofMetadata,
  value: string | undefined
): string | null {
  if (!value) {
    return OPTIONAL_FIELDS.has(fieldName) ? null : `${String(fieldName)} is required`;
  }

  if (value.length > MAX_VALUE_LENGTH) {
    return `${String(fieldName)} is too long`;
  }

  if (/[\r\n\t\0]/.test(value)) {
    return `${String(fieldName)} contains control characters`;
  }

  if (hasForbiddenMaterial(value)) {
    return `${String(fieldName)} contains restricted material`;
  }

  if (
    (fieldName === 'webArtifactHash' ||
      fieldName === 'clientBundleHash' ||
      fieldName === 'packageHash') &&
    !HASH_PATTERN.test(value)
  ) {
    return `${String(fieldName)} must be a sha256 hash`;
  }

  if (fieldName === 'generatedAtUtc' && !ISO_UTC_PATTERN.test(value)) {
    return `${String(fieldName)} must be an ISO UTC timestamp`;
  }

  if (
    fieldName !== 'generatedAtUtc' &&
    fieldName !== 'evidenceStatus' &&
    !PUBLIC_VALUE_PATTERN.test(value)
  ) {
    return `${String(fieldName)} contains unsupported public characters`;
  }

  return null;
}

export function normalizeWebClientDeploymentProofMetadata(
  value: unknown
): WebClientDeploymentProofValidationResult {
  const record = asRecord(value);
  if (!record) {
    return {
      ok: false,
      code: 'webclient_proof_missing',
      message: 'WebClient deployment proof metadata is missing.',
    };
  }

  const metadata: WebClientDeploymentProofMetadata = {
    schemaVersion: normalizeString(record.schemaVersion) as typeof WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION,
    componentId: normalizeString(record.componentId) as typeof WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID,
    deploymentProofId: normalizeString(record.deploymentProofId) ?? '',
    deploymentTarget: normalizeString(record.deploymentTarget) ?? '',
    sourceRef: normalizeString(record.sourceRef) ?? '',
    webArtifactHash: normalizeString(record.webArtifactHash) ?? '',
    clientBundleHash: normalizeString(record.clientBundleHash) ?? '',
    packageHash: normalizeString(record.packageHash),
    publicPackageRef: normalizeString(record.publicPackageRef),
    deploymentProtocolVersion: normalizeString(
      record.deploymentProtocolVersion
    ) as typeof WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION,
    evidenceStatus: normalizeString(record.evidenceStatus) as WebClientDeploymentProofEvidenceStatus,
    generatedAtUtc: normalizeString(record.generatedAtUtc) ?? '',
  };

  if (metadata.schemaVersion !== WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'webclient_proof_unknown',
      message: 'Unsupported WebClient deployment proof schema.',
    };
  }

  if (metadata.componentId !== WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID) {
    return {
      ok: false,
      code: 'webclient_proof_unknown',
      message: 'Unsupported WebClient deployment proof component.',
    };
  }

  if (metadata.deploymentProtocolVersion !== WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION) {
    return {
      ok: false,
      code: 'webclient_proof_unknown',
      message: 'Unsupported WebClient deployment proof protocol version.',
    };
  }

  if (!EVIDENCE_STATUSES.has(metadata.evidenceStatus)) {
    return {
      ok: false,
      code: 'webclient_proof_unknown',
      message: 'Unsupported WebClient deployment proof evidence status.',
    };
  }

  for (const [fieldName, fieldValue] of Object.entries(metadata) as Array<
    [keyof WebClientDeploymentProofMetadata, string | undefined]
  >) {
    const error = validatePublicField(fieldName, fieldValue);
    if (error) {
      return {
        ok: false,
        code: error.includes('restricted material')
          ? 'webclient_proof_private_only'
          : 'webclient_proof_unknown',
        message: error,
      };
    }
  }

  const totalLength = Object.values(metadata)
    .filter((item): item is string => typeof item === 'string')
    .reduce((sum, item) => sum + item.length, 0);
  if (totalLength > MAX_TOTAL_HEADER_LENGTH) {
    return {
      ok: false,
      code: 'webclient_proof_unknown',
      message: 'WebClient deployment proof metadata is too large.',
    };
  }

  return { ok: true, metadata };
}

export function getWebClientDeploymentProofHeadersFromMetadata(
  metadata: WebClientDeploymentProofMetadata,
  observationScope: string
): Record<string, string> {
  return {
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.schemaVersion]: metadata.schemaVersion,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.componentId]: metadata.componentId,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentProofId]: metadata.deploymentProofId,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.sourceRef]: metadata.sourceRef,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.webArtifactHash]: metadata.webArtifactHash,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.clientBundleHash]: metadata.clientBundleHash,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentTarget]: metadata.deploymentTarget,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.evidenceStatus]: metadata.evidenceStatus,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentProtocolVersion]:
      metadata.deploymentProtocolVersion,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.generatedAtUtc]: metadata.generatedAtUtc,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.observationScope]: observationScope,
    ...(metadata.packageHash
      ? { [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.packageHash]: metadata.packageHash }
      : {}),
    ...(metadata.publicPackageRef
      ? { [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.publicPackageRef]: metadata.publicPackageRef }
      : {}),
  };
}

export function getMissingWebClientDeploymentProofHeaders(
  observationScope: string
): Record<string, string> {
  return {
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.schemaVersion]:
      WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.componentId]:
      WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.evidenceStatus]: 'missing',
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentProtocolVersion]:
      WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION,
    [WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.observationScope]: observationScope,
  };
}

export function getWebClientDeploymentProofObservationFromHeaders(
  headers: Headers,
  fallbackObservationScope: string
): WebClientDeploymentProofObservation {
  const proofId = headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentProofId)?.trim();
  const status = headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.evidenceStatus)?.trim();
  const observationScope =
    headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.observationScope)?.trim() ||
    fallbackObservationScope;

  if (!proofId && !status) {
    return {
      schemaVersion: WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION,
      componentId: WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID,
      deploymentProtocolVersion: WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION,
      evidenceStatus: 'missing',
      observationScope,
    };
  }

  const schemaVersion = (
    headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.schemaVersion)?.trim()
  ) as typeof WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION;
  const componentId = (
    headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.componentId)?.trim()
  ) as typeof WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID;
  const deploymentProtocolVersion = (
    headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentProtocolVersion)?.trim() ??
    WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION
  ) as typeof WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION;

  return {
    schemaVersion,
    componentId,
    deploymentProofId: proofId ?? '',
    sourceRef: headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.sourceRef)?.trim() ?? '',
    webArtifactHash:
      headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.webArtifactHash)?.trim() ?? '',
    clientBundleHash:
      headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.clientBundleHash)?.trim() ?? '',
    packageHash: headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.packageHash)?.trim() ?? '',
    publicPackageRef:
      headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.publicPackageRef)?.trim() ?? '',
    deploymentTarget:
      headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.deploymentTarget)?.trim() ?? '',
    evidenceStatus: (status ?? 'unknown') as WebClientDeploymentProofEvidenceStatus,
    deploymentProtocolVersion,
    generatedAtUtc:
      headers.get(WEBCLIENT_DEPLOYMENT_PROOF_HEADERS.generatedAtUtc)?.trim() ?? '',
    observationScope,
  };
}

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  RawReadinessCatalog,
  RawReadinessCatalogEntry,
  RawReadinessManifest,
  RawReadinessRegister,
  ReadinessDashboardApiState,
  ReadinessDashboardSource,
} from './contracts';

export class ReadinessDashboardLoadError extends Error {
  readonly state: Exclude<
    ReadinessDashboardApiState,
    'ready' | 'superseded_or_blocked_register' | 'disabled' | 'production_blocked' | 'unauthorized'
  >;
  readonly code: string;
  readonly httpStatus: number;

  constructor(
    state: ReadinessDashboardLoadError['state'],
    code: string,
    message: string,
    httpStatus = 503
  ) {
    super(message);
    this.name = 'ReadinessDashboardLoadError';
    this.state = state;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface LoadReadinessDashboardSourceInput {
  root?: string | null;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'invalid_required_string',
      `Readiness register field ${label} is missing or invalid.`,
      500
    );
  }

  return value;
}

function assertCatalog(value: unknown): RawReadinessCatalog {
  const catalog = value as Partial<RawReadinessCatalog>;
  assertString(catalog.registerId, 'catalog.registerId');
  assertString(catalog.currentRegisterVersionId, 'catalog.currentRegisterVersionId');
  assertString(catalog.currentRegisterVersion, 'catalog.currentRegisterVersion');
  assertString(catalog.currentManifestHash, 'catalog.currentManifestHash');
  assertString(catalog.currentArchiveHash, 'catalog.currentArchiveHash');

  if (!Array.isArray(catalog.entries)) {
    throw new ReadinessDashboardLoadError(
      'missing_catalog',
      'catalog_entries_missing',
      'Readiness catalog has no entries.',
      503
    );
  }

  return catalog as RawReadinessCatalog;
}

function assertRegister(value: unknown): RawReadinessRegister {
  const register = value as Partial<RawReadinessRegister>;
  assertString(register.registerId, 'register.registerId');
  assertString(register.registerVersionId, 'register.registerVersionId');
  assertString(register.registerVersion, 'register.registerVersion');

  if (!register.score || typeof register.score.total !== 'number') {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'register_score_missing',
      'Readiness register score is missing.',
      500
    );
  }

  if (
    !Array.isArray(register.dimensions) ||
    !Array.isArray(register.claimLevels) ||
    !Array.isArray(register.blockers) ||
    !Array.isArray(register.evidenceItems)
  ) {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'register_sections_missing',
      'Readiness register sections are missing.',
      500
    );
  }

  return {
    ...register,
    exceptions: register.exceptions ?? [],
  } as RawReadinessRegister;
}

function assertManifest(value: unknown): RawReadinessManifest {
  const manifest = value as Partial<RawReadinessManifest>;
  assertString(manifest.registerId, 'manifest.registerId');
  assertString(manifest.registerVersionId, 'manifest.registerVersionId');
  assertString(manifest.manifestHash, 'manifest.manifestHash');

  return manifest as RawReadinessManifest;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'invalid_json',
      `Unable to parse readiness JSON at ${path.basename(filePath)}: ${message}`,
      500
    );
  }
}

function getCurrentCatalogEntry(catalog: RawReadinessCatalog): RawReadinessCatalogEntry {
  const entry = catalog.entries.find(
    (item) => item.registerVersionId === catalog.currentRegisterVersionId
  );

  if (!entry) {
    throw new ReadinessDashboardLoadError(
      'missing_register',
      'current_catalog_pointer_missing',
      `Current register pointer ${catalog.currentRegisterVersionId} is not present in the catalog.`,
      503
    );
  }

  return entry;
}

function resolveInsideRoot(root: string, relativePath: string): string {
  if (relativePath.includes('..')) {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'unsafe_version_path',
      'Readiness catalog version path is not safe.',
      500
    );
  }

  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'unsafe_version_path',
      'Readiness catalog version path escapes the configured root.',
      500
    );
  }

  return resolvedPath;
}

export async function loadReadinessDashboardSource(
  input: LoadReadinessDashboardSourceInput
): Promise<ReadinessDashboardSource> {
  const root = input.root?.trim();

  if (!root) {
    throw new ReadinessDashboardLoadError(
      'missing_catalog',
      'register_root_missing',
      'HUSHVOTING_READINESS_REGISTER_ROOT is not configured.',
      503
    );
  }

  const catalogPath = path.resolve(root, 'readiness-register-catalog.json');
  if (!existsSync(catalogPath)) {
    throw new ReadinessDashboardLoadError(
      'missing_catalog',
      'catalog_missing',
      'Readiness register catalog is missing.',
      503
    );
  }

  const catalog = assertCatalog(await readJsonFile<RawReadinessCatalog>(catalogPath));
  const currentEntry = getCurrentCatalogEntry(catalog);
  const versionRoot = resolveInsideRoot(root, currentEntry.versionPath);
  const registerPath = path.join(versionRoot, 'readiness-register.json');
  const manifestPath = path.join(versionRoot, 'readiness-register-manifest.json');
  const publicSafeSummaryPath = path.join(versionRoot, 'public-safe-summary.md');

  if (!existsSync(registerPath)) {
    throw new ReadinessDashboardLoadError(
      'missing_register',
      'register_missing',
      'Current readiness register JSON is missing.',
      503
    );
  }

  if (!existsSync(manifestPath) || !existsSync(publicSafeSummaryPath)) {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'register_support_files_missing',
      'Readiness register manifest or public-safe summary is missing.',
      500
    );
  }

  const register = assertRegister(await readJsonFile<RawReadinessRegister>(registerPath));
  const manifest = assertManifest(await readJsonFile<RawReadinessManifest>(manifestPath));
  const publicSafeSummary = await readFile(publicSafeSummaryPath, 'utf8');

  if (
    register.registerId !== catalog.registerId ||
    manifest.registerId !== catalog.registerId ||
    register.registerVersionId !== catalog.currentRegisterVersionId ||
    manifest.registerVersionId !== catalog.currentRegisterVersionId ||
    manifest.manifestHash !== catalog.currentManifestHash
  ) {
    throw new ReadinessDashboardLoadError(
      'invalid_register',
      'catalog_manifest_mismatch',
      'Readiness catalog, register, and manifest do not match.',
      500
    );
  }

  return {
    catalog,
    register,
    manifest,
    publicSafeSummary,
  };
}

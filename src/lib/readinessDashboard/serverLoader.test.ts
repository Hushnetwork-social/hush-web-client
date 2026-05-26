import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createReadinessDashboardFixtureSource } from './fixtures';
import {
  ReadinessDashboardLoadError,
  loadReadinessDashboardSource,
} from './serverLoader';

const tempRoots: string[] = [];

async function writeFixtureRoot() {
  const source = createReadinessDashboardFixtureSource();
  const root = await mkdtemp(path.join(os.tmpdir(), 'feat142-readiness-'));
  const versionRoot = path.join(root, 'v0.1.3');
  tempRoots.push(root);
  await mkdir(versionRoot, { recursive: true });
  await writeFile(
    path.join(root, 'readiness-register-catalog.json'),
    JSON.stringify(source.catalog, null, 2)
  );
  await writeFile(
    path.join(versionRoot, 'readiness-register.json'),
    JSON.stringify(source.register, null, 2)
  );
  await writeFile(
    path.join(versionRoot, 'readiness-register-manifest.json'),
    JSON.stringify(source.manifest, null, 2)
  );
  await writeFile(path.join(versionRoot, 'public-safe-summary.md'), source.publicSafeSummary);

  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('FEAT-142 server-only readiness loader', () => {
  it('loads the current catalog pointer from a server-only root', async () => {
    const root = await writeFixtureRoot();
    const source = await loadReadinessDashboardSource({ root });

    expect(source.catalog.currentRegisterVersionId).toBe('RDY-REG-v0.1.3');
    expect(source.register.score.total).toBe(60);
    expect(source.publicSafeSummary).toContain('HushVoting Public-Safe Readiness Summary');
  });

  it('fails closed when the register root is missing', async () => {
    await expect(loadReadinessDashboardSource({ root: null })).rejects.toMatchObject({
      state: 'missing_catalog',
      code: 'register_root_missing',
    } satisfies Partial<ReadinessDashboardLoadError>);
  });

  it('rejects catalog and manifest mismatch', async () => {
    const source = createReadinessDashboardFixtureSource();
    const root = await mkdtemp(path.join(os.tmpdir(), 'feat142-readiness-'));
    const versionRoot = path.join(root, 'v0.1.3');
    tempRoots.push(root);
    await mkdir(versionRoot, { recursive: true });
    await writeFile(
      path.join(root, 'readiness-register-catalog.json'),
      JSON.stringify(
        {
          ...source.catalog,
          currentManifestHash: 'wrong-hash',
        },
        null,
        2
      )
    );
    await writeFile(
      path.join(versionRoot, 'readiness-register.json'),
      JSON.stringify(source.register, null, 2)
    );
    await writeFile(
      path.join(versionRoot, 'readiness-register-manifest.json'),
      JSON.stringify(source.manifest, null, 2)
    );
    await writeFile(path.join(versionRoot, 'public-safe-summary.md'), source.publicSafeSummary);

    await expect(loadReadinessDashboardSource({ root })).rejects.toMatchObject({
      state: 'invalid_register',
      code: 'catalog_manifest_mismatch',
    });
  });
});

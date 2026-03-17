import { beforeEach, describe, expect, it, vi } from 'vitest';

const accessMock = vi.fn<(path: string) => Promise<void>>();

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    access: accessMock,
    default: {
      ...((actual as unknown as { default?: object }).default ?? {}),
      access: accessMock,
    },
  };
});

describe('GET /api/reactions/circuit-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports approved artifacts available when both wasm and zkey exist', async () => {
    accessMock.mockResolvedValue(undefined);

    const { GET } = await import('./route');
    const response = await GET();
    const payload = await response.json();

    expect(payload.currentVersion).toBe('omega-v1.0.0');
    expect(payload.minimumVersion).toBe('omega-v1.0.0');
    expect(payload.approvedVersions).toEqual([
      {
        version: 'omega-v1.0.0',
        proverArtifactsAvailable: true,
        wasmSha256: '71D1EE45D944313BB2C86A1851F3B09A481481675FA80DDFD3205D99D7613F8B',
        zkeySha256: '65620ABC5030404403C19B22B623E115807EB2603CB5953F195959A76BA91B5C',
        provenance: 'FEAT-087 approved artifact set',
      },
    ]);
    expect(accessMock).toHaveBeenCalledTimes(2);
  });

  it('reports approved artifacts unavailable when either wasm or zkey is missing', async () => {
    accessMock.mockImplementation(async (path: string) => {
      if (path.endsWith('reaction.zkey')) {
        throw new Error('missing');
      }
    });

    const { GET } = await import('./route');
    const response = await GET();
    const payload = await response.json();

    expect(payload.approvedVersions).toEqual([
      {
        version: 'omega-v1.0.0',
        proverArtifactsAvailable: false,
        wasmSha256: '71D1EE45D944313BB2C86A1851F3B09A481481675FA80DDFD3205D99D7613F8B',
        zkeySha256: '65620ABC5030404403C19B22B623E115807EB2603CB5953F195959A76BA91B5C',
        provenance: 'FEAT-087 approved artifact set',
      },
    ]);
  });
});

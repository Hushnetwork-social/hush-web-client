import { describe, expect, it } from 'vitest';
import { resolveHeadlessArtifacts } from './headlessProver';

describe('headless prover artifact resolution', () => {
  it('maps approved circuit assets into the repo public path', () => {
    const artifacts = resolveHeadlessArtifacts('C:\\repo', 'omega-v1.0.0');

    expect(artifacts.wasmPath).toContain('hush-web-client');
    expect(artifacts.wasmPath).toContain('public');
    expect(artifacts.wasmPath).toContain('circuits');
    expect(artifacts.wasmPath).toContain('omega-v1.0.0');
    expect(artifacts.wasmPath).toContain('reaction.wasm');
    expect(artifacts.zkeyPath).toContain('reaction.zkey');
  });
});

# Third-Party Licenses

This document tracks third-party components that are especially relevant to the Protocol Omega /
reaction proof stack in `hush-web-client`.

It is not a complete npm dependency inventory. It is the starting point for the components that:

- materially affect the cryptographic/proof path
- have licensing implications that must stay visible
- may be forked and patched by HushNetwork while upstream changes are pending

## Licensing Position

- HushNetwork original code in this repository is licensed under `Apache-2.0` unless otherwise stated.
- Third-party components keep their own original licenses.
- This repository includes or depends on third-party components under other licenses, including
  `GPL-3.0`.
- If HushNetwork forks and modifies a third-party component, that fork continues under the original
  third-party license unless there is a valid relicensing basis.

## Protocol Omega / Reaction Stack

| Component | Role In This Repo | Upstream | License Signal To Treat As Authoritative | Notes |
|-----------|-------------------|----------|------------------------------------------|-------|
| `circomlibjs` | Poseidon / Baby JubJub / Circom-compatible crypto helpers used by the web-client reaction stack | https://github.com/iden3/circomlibjs | Treat package metadata as `GPL-3.0` | Repo license presentation is unclear; package metadata must be treated seriously |
| `ffjavascript` | Finite-field arithmetic and helper dependency in the Circom/iden3 stack | https://github.com/iden3/ffjavascript | `GPL-3.0` | Transitive dependency via the Circom stack |
| `snarkjs` | zkSNARK tooling / proof ecosystem relevant to Circom-compatible proof flows | https://github.com/iden3/snarkjs | `GPL-3.0` | May not be a direct runtime dependency in every path, but is part of the proof toolchain discussion |

## Current Working Rule

Until a dependency is replaced or legal review says otherwise:

- `circomlibjs`, `ffjavascript`, and `snarkjs` must be treated as GPL-sensitive dependencies
- HushNetwork must not describe the full shipped product as `Apache-2.0 only` while these remain in
  the supported stack
- if HushNetwork forks and patches these components, the forks must preserve the original license
  obligations

## Planned Fork / Patch Workflow

When a third-party dependency requires security or maintenance fixes before upstream is ready:

1. Fork the upstream repository into `https://github.com/Hushnetwork-social`
2. Preserve the original license and notices in the fork
3. Make the required fixes in the fork
4. Open a pull request to the original upstream repository
5. Use the HushNetwork fork while the pull request is pending or if upstream is inactive
6. Switch back to upstream only after the upstream fix is accepted and released at an acceptable version

## Current Source References

### circomlibjs

- Upstream repo: https://github.com/iden3/circomlibjs
- Package metadata: https://raw.githubusercontent.com/iden3/circomlibjs/main/package.json

### ffjavascript

- Upstream repo: https://github.com/iden3/ffjavascript
- Package metadata: https://raw.githubusercontent.com/iden3/ffjavascript/master/package.json
- License file: https://github.com/iden3/ffjavascript/blob/master/LICENSE

### snarkjs

- Upstream repo: https://github.com/iden3/snarkjs
- Package metadata: https://raw.githubusercontent.com/iden3/snarkjs/master/package.json
- License file: https://github.com/iden3/snarkjs/blob/master/COPYING

## Future Expansion

This file should be expanded if any of the following happen:

- HushNetwork forks `circomlibjs`, `ffjavascript`, or `snarkjs`
- HushNetwork adopts `gnark` or another proof stack
- the supported binary distribution path for Tauri requires additional notice text
- a broader complete third-party inventory is generated for release packaging

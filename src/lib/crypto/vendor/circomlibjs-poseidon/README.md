This folder vendors the Poseidon-only implementation derived from `circomlibjs`.

Why it exists:
- `hush-web-client` only needs Poseidon hashing compatibility for Protocol Omega and reactions.
- Upstream `circomlibjs` currently ships unrelated modules that pull in `ethers@5`, which triggers Dependabot/npm audit findings.
- The vendored files keep the exact Poseidon implementation path we use while avoiding the unused dependency chain.

Source basis:
- `circomlibjs@0.1.7`
- files derived from `src/poseidon_wasm.js` and `src/poseidon_constants_opt.js`

When updating:
- compare against upstream `circomlibjs`
- keep the browser/runtime behavior compatible with the server and the relevant circuits
- rerun the Poseidon/reaction proof tests, full web test suite, build, lint, and `npm audit`

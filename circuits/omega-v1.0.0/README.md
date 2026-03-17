FEAT-087 Reaction Circuit Source

This directory contains the source-side circuit materials for `omega-v1.0.0`.

Files:
- `reaction.circom`
- `merkleproof.circom`

Build prerequisites:
- `circom` CLI
- `snarkjs`
- `circomlib` circuit includes available to the compiler
- a trusted setup file (`.ptau`)

Build entrypoint:
- `hush-web-client/scripts/build-feat087-circuit.ps1`

Runtime outputs are not written here.

Runtime output locations:
- `hush-web-client/public/circuits/omega-v1.0.0/reaction.wasm`
- `hush-web-client/public/circuits/omega-v1.0.0/reaction.zkey`
- `hush-server-node/Node/HushServerNode/circuits/omega-v1.0.0/verification_key.json`

Current implementation notes:
- `omega-v1.0.0` is the approved non-dev FEAT-087 reaction circuit used by the browser prover and the server verifier.
- Current circuit shape:
  - `EMOJI_COUNT = 6`
  - Merkle tree depth `20`
  - `31` public signals
- Current runtime artifact sizes:
  - `reaction.wasm` = `2,877,397` bytes
  - `reaction.zkey` = `27,806,424` bytes

Measured desktop observations from the real non-dev FEAT-087 manual validation on 2026-03-17:
- browser proof generation: about `1.4s`
- server Groth16 verification: about `0.6s`
- reaction visibility: reached on the next block cycle, about `3s`
- prior `8s` to `10s` figures were broader Playwright/E2E timing in a different environment and should not be reused as the per-reaction protocol cost on this desktop setup

Product implication:
- Desktop real-proof reaction latency is materially better than the earlier coarse E2E estimate suggested.
- Remaining performance risk is now about weaker hardware, mobile browsers, and benchmark-grade scale evidence rather than this desktop non-dev proof path being inherently unusable.
- Reactions should still move toward a smaller or cheaper non-dev circuit in a future Protocol Omega revision instead of assuming current desktop measurements generalize to all devices.

Current optimization direction to track:
- reduce emoji-slot count
- reduce Merkle depth where the product allows it
- consider a cheaper reaction encoding than one encrypted slot per emoji

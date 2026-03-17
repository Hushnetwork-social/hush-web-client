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

Measured browser proving observations from the green FEAT-087 E2E run on desktop:
- first proof after warm-up-sensitive startup: about `19.0s`
- subsequent proofs: about `8.3s` to `9.5s`
- server submit and verification round trip: about `1.6s` to `5.6s`

Product implication:
- This is currently too slow for casual social reactions, and mobile devices are expected to be slower than the measured desktop run.
- This may still be acceptable for higher-friction flows such as private polls or e-voting, but even there the target should remain below roughly `10s`.
- Reactions should move toward a smaller or cheaper non-dev circuit in a future Protocol Omega revision instead of assuming the current browser proving path is fast enough.

Current optimization direction to track:
- reduce emoji-slot count
- reduce Merkle depth where the product allows it
- consider a cheaper reaction encoding than one encrypted slot per emoji

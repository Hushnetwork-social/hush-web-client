FEAT-087 approved client circuit drop location.

Required files for a real non-dev proof path:
- `reaction.wasm`
- `reaction.zkey`

Do not place placeholder files here.

Install only the approved artifact drop that matches:
- circuit version: `omega-v1.0.0`
- server verification key: `hush-server-node/Node/HushServerNode/circuits/omega-v1.0.0/verification_key.json`

Before running FEAT-087 Playwright or non-dev benchmark flows:
1. copy the approved client artifacts into this directory
2. verify `npm install` has installed `snarkjs` in `hush-web-client/node_modules`
3. run the proof-path unit tests
4. run `/api/reactions/circuit-status` or the FEAT-087 browser preflight

If `reaction.wasm` or `reaction.zkey` is missing, the correct behavior is fail-closed.

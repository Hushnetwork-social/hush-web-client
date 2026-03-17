pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template HashLeftRight() {
    signal input left;
    signal input right;
    signal output out;

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    out <== h.out;
}

template MerkleProof(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal hashes[depth + 1];
    signal leftInputs[depth];
    signal rightInputs[depth];
    signal leftFromHash[depth];
    signal leftFromPath[depth];
    signal rightFromHash[depth];
    signal rightFromPath[depth];
    hashes[0] <== leaf;

    component levelHash[depth];

    for (var i = 0; i < depth; i++) {
        levelHash[i] = HashLeftRight();

        leftFromHash[i] <== hashes[i] * (1 - pathIndices[i]);
        leftFromPath[i] <== pathElements[i] * pathIndices[i];
        rightFromHash[i] <== hashes[i] * pathIndices[i];
        rightFromPath[i] <== pathElements[i] * (1 - pathIndices[i]);

        leftInputs[i] <== leftFromHash[i] + leftFromPath[i];
        rightInputs[i] <== rightFromHash[i] + rightFromPath[i];

        levelHash[i].left <== leftInputs[i];
        levelHash[i].right <== rightInputs[i];
        hashes[i + 1] <== levelHash[i].out;
    }

    hashes[depth] === root;
}

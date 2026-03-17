pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/babyjub.circom";
include "circomlib/circuits/escalarmulany.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "./merkleproof.circom";

template ReactionCircuit(merkle_depth) {
    signal input nullifier;
    signal input ciphertext_c1[6][2];
    signal input ciphertext_c2[6][2];
    signal input message_id;
    signal input feed_id;
    signal input feed_pk[2];
    signal input members_root;
    signal input author_commitment;

    signal input user_secret;
    signal input emoji_index;
    signal input encryption_nonce[6];
    signal input merkle_path[merkle_depth];
    signal input merkle_indices[merkle_depth];

    var Gx = 5299619240641551281634865583518297030282874472190772894086521144482721001553;
    var Gy = 16950150798460657717958625567821834550301663161624707787222815936182638968203;
    var DOMAIN_SEPARATOR = 1213481800;

    component nullifier_hash = Poseidon(4);
    nullifier_hash.inputs[0] <== user_secret;
    nullifier_hash.inputs[1] <== message_id;
    nullifier_hash.inputs[2] <== feed_id;
    nullifier_hash.inputs[3] <== DOMAIN_SEPARATOR;
    nullifier_hash.out === nullifier;

    component user_commitment = Poseidon(1);
    user_commitment.inputs[0] <== user_secret;

    component merkle_verifier = MerkleProof(merkle_depth);
    merkle_verifier.leaf <== user_commitment.out;
    merkle_verifier.root <== members_root;
    for (var i = 0; i < merkle_depth; i++) {
        merkle_verifier.pathElements[i] <== merkle_path[i];
        merkle_verifier.pathIndices[i] <== merkle_indices[i];
    }

    component author_check = IsEqual();
    author_check.in[0] <== user_commitment.out;
    author_check.in[1] <== author_commitment;
    author_check.out === 0;

    component emoji_range = LessThan(8);
    emoji_range.in[0] <== emoji_index;
    emoji_range.in[1] <== 7;
    emoji_range.out === 1;

    component is_selected[6];
    component c1_mult[6];
    component msg_mult[6];
    component pk_mult[6];
    component c2_add[6];
    signal msg_values[6];
    component nonce_bits[6];
    component msg_bits[6];

    for (var j = 0; j < 6; j++) {
        is_selected[j] = IsEqual();
        is_selected[j].in[0] <== emoji_index;
        is_selected[j].in[1] <== j;
        msg_values[j] <== is_selected[j].out;

        nonce_bits[j] = Num2Bits(254);
        nonce_bits[j].in <== encryption_nonce[j];

        msg_bits[j] = Num2Bits(254);
        msg_bits[j].in <== msg_values[j];

        c1_mult[j] = EscalarMulAny(254);
        c1_mult[j].p[0] <== Gx;
        c1_mult[j].p[1] <== Gy;
        for (var k = 0; k < 254; k++) {
            c1_mult[j].e[k] <== nonce_bits[j].out[k];
        }
        c1_mult[j].out[0] === ciphertext_c1[j][0];
        c1_mult[j].out[1] === ciphertext_c1[j][1];

        msg_mult[j] = EscalarMulAny(254);
        msg_mult[j].p[0] <== Gx;
        msg_mult[j].p[1] <== Gy;
        for (var m = 0; m < 254; m++) {
            msg_mult[j].e[m] <== msg_bits[j].out[m];
        }

        pk_mult[j] = EscalarMulAny(254);
        pk_mult[j].p[0] <== feed_pk[0];
        pk_mult[j].p[1] <== feed_pk[1];
        for (var n = 0; n < 254; n++) {
            pk_mult[j].e[n] <== nonce_bits[j].out[n];
        }

        c2_add[j] = BabyAdd();
        c2_add[j].x1 <== msg_mult[j].out[0];
        c2_add[j].y1 <== msg_mult[j].out[1];
        c2_add[j].x2 <== pk_mult[j].out[0];
        c2_add[j].y2 <== pk_mult[j].out[1];

        c2_add[j].xout === ciphertext_c2[j][0];
        c2_add[j].yout === ciphertext_c2[j][1];
    }
}

component main {public [
    nullifier,
    ciphertext_c1,
    ciphertext_c2,
    message_id,
    feed_id,
    feed_pk,
    members_root,
    author_commitment
]} = ReactionCircuit(20);

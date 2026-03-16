import { NextRequest, NextResponse } from "next/server";
import {
  encodeBytes,
  grpcCall,
  parseVarint,
} from "@/lib/grpc/grpc-web-helper";
import {
  computeCommitment,
  deriveAddressMembershipSecret,
  bigintToBytes,
} from "@/lib/crypto/reactions";
import { parseMembershipProofResponse } from "./parser";

type MembershipAction = "is-registered" | "register" | "proof" | "derive-global";

type MembershipRequestBody = {
  action?: MembershipAction;
  feedId?: string;
  userCommitment?: string;
  publicAddress?: string;
};

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }

  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function buildMembershipRequest(feedIdBase64: string, userCommitmentBase64: string): Uint8Array {
  return new Uint8Array([
    ...encodeBytes(1, base64ToBytes(feedIdBase64)),
    ...encodeBytes(2, base64ToBytes(userCommitmentBase64)),
  ]);
}

function extractGrpcMessage(responseBytes: Uint8Array): Uint8Array | null {
  let offset = 0;

  while (offset + 5 <= responseBytes.length) {
    const flag = responseBytes[offset];
    const messageLength =
      (responseBytes[offset + 1] << 24) |
      (responseBytes[offset + 2] << 16) |
      (responseBytes[offset + 3] << 8) |
      responseBytes[offset + 4];
    offset += 5;

    if (flag === 0) {
      return responseBytes.slice(offset, offset + messageLength);
    }

    offset += messageLength;
  }

  return null;
}

function parseIsRegisteredResponse(messageBytes: Uint8Array): boolean {
  let offset = 0;

  while (offset < messageBytes.length) {
    const { value: tag, bytesRead: tagBytes } = parseVarint(messageBytes, offset);
    offset += tagBytes;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      const { value, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;
      if (fieldNumber === 1) {
        return value !== 0;
      }
      continue;
    }

    if (wireType === 2) {
      const { value: length, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead + length;
      continue;
    }

    break;
  }

  return false;
}

function parseRegisterResponse(messageBytes: Uint8Array) {
  let offset = 0;
  let success = false;
  let alreadyRegistered = false;
  let newMerkleRoot = "";

  while (offset < messageBytes.length) {
    const { value: tag, bytesRead: tagBytes } = parseVarint(messageBytes, offset);
    offset += tagBytes;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      const { value, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;
      if (fieldNumber === 1) {
        success = value !== 0;
      } else if (fieldNumber === 3) {
        alreadyRegistered = value !== 0;
      }
      continue;
    }

    if (wireType === 2) {
      const { value: length, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;
      if (fieldNumber === 2) {
        newMerkleRoot = bytesToBase64(messageBytes.slice(offset, offset + length));
      }
      offset += length;
      continue;
    }

    break;
  }

  return { success, alreadyRegistered, newMerkleRoot };
}

function bigintToHex(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MembershipRequestBody;
    const action = body.action;
    const feedId = body.feedId?.trim() ?? "";
    const userCommitment = body.userCommitment?.trim() ?? "";
    const publicAddress = body.publicAddress?.trim() ?? "";

    if (action === "derive-global") {
      if (!publicAddress) {
        return NextResponse.json(
          { success: false, message: "publicAddress is required for derive-global" },
          { status: 400 }
        );
      }

      const userSecret = await deriveAddressMembershipSecret(publicAddress);
      const commitment = await computeCommitment(userSecret);

      return NextResponse.json({
        success: true,
        globalMembership: {
          userSecretHex: bigintToHex(userSecret),
          userCommitmentHex: bigintToHex(commitment),
          userCommitmentBase64: bytesToBase64(bigintToBytes(commitment)),
        },
      });
    }

    if (!action || !feedId || !userCommitment) {
      return NextResponse.json(
        { success: false, message: "action, feedId, and userCommitment are required" },
        { status: 400 }
      );
    }

    const methodName =
      action === "is-registered"
        ? "IsCommitmentRegistered"
        : action === "register"
          ? "RegisterCommitment"
          : "GetMembershipProof";

    const requestBytes = buildMembershipRequest(feedId, userCommitment);
    const responseBytes = await grpcCall("rpcHush.HushMembership", methodName, requestBytes);
    const messageBytes = extractGrpcMessage(responseBytes);

    if (!messageBytes) {
      return NextResponse.json(
        { success: false, message: `No membership response payload for ${action}` },
        { status: 502 }
      );
    }

    if (action === "is-registered") {
      return NextResponse.json({
        success: true,
        isRegistered: parseIsRegisteredResponse(messageBytes),
      });
    }

    if (action === "register") {
      const parsed = parseRegisterResponse(messageBytes);
      return NextResponse.json({
        success: true,
        registerCommitment: {
          success: parsed.success,
          alreadyRegistered: parsed.alreadyRegistered,
          newMerkleRoot: parsed.newMerkleRoot,
        },
      });
    }

    const parsed = parseMembershipProofResponse(messageBytes);
    return NextResponse.json({
      success: true,
      membershipProof: {
        isMember: parsed.isMember,
        merkleRoot: parsed.merkleRoot,
        pathElements: parsed.pathElements,
        pathIndices: parsed.pathIndices,
        treeDepth: parsed.treeDepth,
        rootBlockHeight: parsed.rootBlockHeight,
      },
    });
  } catch (error) {
    console.error("[API] Membership proxy failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to resolve membership request" },
      { status: 502 }
    );
  }
}

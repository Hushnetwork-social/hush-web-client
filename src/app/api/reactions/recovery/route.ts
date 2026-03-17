import { NextRequest, NextResponse } from "next/server";
import {
  encodeBytes,
  grpcCall,
  parseGrpcResponse,
  parseVarint,
} from "@/lib/grpc/grpc-web-helper";

type RecoveryAction = "backup" | "nullifier-exists";

type RecoveryRequestBody = {
  action?: RecoveryAction;
  nullifier?: string;
};

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function buildNullifierRequest(nullifierBase64: string): Uint8Array {
  return new Uint8Array(encodeBytes(1, base64ToBytes(nullifierBase64)));
}

function parseNullifierExistsResponse(messageBytes: Uint8Array): boolean {
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

function parseGetReactionBackupResponse(messageBytes: Uint8Array) {
  let offset = 0;
  let exists = false;
  let encryptedEmojiBackup = "";

  while (offset < messageBytes.length) {
    const { value: tag, bytesRead: tagBytes } = parseVarint(messageBytes, offset);
    offset += tagBytes;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      const { value, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;
      if (fieldNumber === 1) {
        exists = value !== 0;
      }
      continue;
    }

    if (wireType === 2) {
      const { value: length, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;
      if (fieldNumber === 2) {
        encryptedEmojiBackup = bytesToBase64(messageBytes.slice(offset, offset + length));
      }
      offset += length;
      continue;
    }

    break;
  }

  return { exists, encryptedEmojiBackup };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RecoveryRequestBody;
    const action = body.action;
    const nullifier = body.nullifier?.trim() ?? "";

    if (!action || !nullifier) {
      return NextResponse.json(
        { success: false, message: "action and nullifier are required" },
        { status: 400 }
      );
    }

    const methodName = action === "backup" ? "GetReactionBackup" : "NullifierExists";
    const requestBytes = buildNullifierRequest(nullifier);
    const responseBytes = await grpcCall("rpcHush.HushReactions", methodName, requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      if (action === "backup") {
        return NextResponse.json({
          success: true,
          backup: {
            exists: false,
            encryptedEmojiBackup: "",
          },
        });
      }

      return NextResponse.json({
        success: true,
        nullifierExists: false,
      });
    }

    if (action === "backup") {
      const parsed = parseGetReactionBackupResponse(messageBytes);
      return NextResponse.json({
        success: true,
        backup: {
          exists: parsed.exists,
          encryptedEmojiBackup: parsed.encryptedEmojiBackup,
        },
      });
    }

    return NextResponse.json({
      success: true,
      nullifierExists: parseNullifierExistsResponse(messageBytes),
    });
  } catch (error) {
    console.error("[API] Reaction recovery proxy failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to resolve reaction recovery request" },
      { status: 502 }
    );
  }
}

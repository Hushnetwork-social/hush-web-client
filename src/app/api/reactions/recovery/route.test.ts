import { describe, expect, it, vi, beforeEach } from "vitest";

const grpcCallMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/grpc/grpc-web-helper", async () => {
  const actual = await vi.importActual<typeof import("@/lib/grpc/grpc-web-helper")>(
    "@/lib/grpc/grpc-web-helper"
  );
  return {
    ...actual,
    grpcCall: grpcCallMock,
  };
});

import { POST } from "./route";

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value >>> 0;

  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }

  bytes.push(remaining);
  return bytes;
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeBool(fieldNumber: number, value: boolean): number[] {
  return [...encodeTag(fieldNumber, 0), ...encodeVarint(value ? 1 : 0)];
}

function encodeBytes(fieldNumber: number, value: Uint8Array): number[] {
  return [...encodeTag(fieldNumber, 2), ...encodeVarint(value.length), ...value];
}

function frameMessage(messageBytes: Uint8Array): Uint8Array {
  return new Uint8Array([
    0,
    (messageBytes.length >> 24) & 0xff,
    (messageBytes.length >> 16) & 0xff,
    (messageBytes.length >> 8) & 0xff,
    messageBytes.length & 0xff,
    ...messageBytes,
  ]);
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

describe("POST /api/reactions/recovery", () => {
  beforeEach(() => {
    grpcCallMock.mockReset();
  });

  it("returns backup payload when GetReactionBackup succeeds", async () => {
    const messageBytes = new Uint8Array([
      ...encodeBool(1, true),
      ...encodeBytes(2, ascii("enc-backup")),
    ]);
    grpcCallMock.mockResolvedValue(frameMessage(messageBytes));

    const response = await POST(
      new Request("http://localhost/api/reactions/recovery", {
        method: "POST",
        body: JSON.stringify({
          action: "backup",
          nullifier: Buffer.from("nullifier").toString("base64"),
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      backup: {
        exists: true,
        encryptedEmojiBackup: Buffer.from("enc-backup").toString("base64"),
      },
    });
  });

  it("returns nullifierExists when NullifierExists succeeds", async () => {
    const messageBytes = new Uint8Array([...encodeBool(1, true)]);
    grpcCallMock.mockResolvedValue(frameMessage(messageBytes));

    const response = await POST(
      new Request("http://localhost/api/reactions/recovery", {
        method: "POST",
        body: JSON.stringify({
          action: "nullifier-exists",
          nullifier: Buffer.from("nullifier").toString("base64"),
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      nullifierExists: true,
    });
  });

  it("returns 400 when action or nullifier is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/reactions/recovery", {
        method: "POST",
        body: JSON.stringify({ action: "backup" }),
      }) as never
    );

    expect(response.status).toBe(400);
  });
});

import { describe, expect, it } from "vitest";

import { parseMembershipProofResponse } from "./parser";

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

function encodeInt(fieldNumber: number, value: number): number[] {
  return [...encodeTag(fieldNumber, 0), ...encodeVarint(value)];
}

function encodeBytes(fieldNumber: number, value: Uint8Array): number[] {
  return [...encodeTag(fieldNumber, 2), ...encodeVarint(value.length), ...value];
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

describe("parseMembershipProofResponse", () => {
  it("parses packed pathIndices values", () => {
    const bytes = new Uint8Array([
      ...encodeBool(1, true),
      ...encodeBytes(2, ascii("root-bytes")),
      ...encodeBytes(3, ascii("path-a")),
      ...encodeBytes(3, ascii("path-b")),
      ...encodeTag(4, 2),
      ...encodeVarint(4),
      1, 0, 1, 1,
      ...encodeInt(5, 20),
      ...encodeInt(6, 321),
    ]);

    const parsed = parseMembershipProofResponse(bytes);

    expect(parsed).toEqual({
      isMember: true,
      merkleRoot: Buffer.from("root-bytes").toString("base64"),
      pathElements: [
        Buffer.from("path-a").toString("base64"),
        Buffer.from("path-b").toString("base64"),
      ],
      pathIndices: [true, false, true, true],
      treeDepth: 20,
      rootBlockHeight: 321,
    });
  });

  it("parses unpacked pathIndices values", () => {
    const bytes = new Uint8Array([
      ...encodeBool(1, true),
      ...encodeBytes(2, ascii("root")),
      ...encodeBytes(3, ascii("path-only")),
      ...encodeBool(4, false),
      ...encodeBool(4, true),
      ...encodeBool(4, false),
      ...encodeInt(5, 3),
      ...encodeInt(6, 99),
    ]);

    const parsed = parseMembershipProofResponse(bytes);

    expect(parsed.pathIndices).toEqual([false, true, false]);
    expect(parsed.treeDepth).toBe(3);
    expect(parsed.rootBlockHeight).toBe(99);
  });
});

import { parseVarint } from "@/lib/grpc/grpc-web-helper";

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

export function parseMembershipProofResponse(messageBytes: Uint8Array) {
  let offset = 0;
  let isMember = false;
  let merkleRoot = "";
  const pathElements: string[] = [];
  const pathIndices: boolean[] = [];
  let treeDepth = 0;
  let rootBlockHeight = 0;

  while (offset < messageBytes.length) {
    const { value: tag, bytesRead: tagBytes } = parseVarint(messageBytes, offset);
    offset += tagBytes;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      const { value, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;

      if (fieldNumber === 1) {
        isMember = value !== 0;
      } else if (fieldNumber === 4) {
        pathIndices.push(value !== 0);
      } else if (fieldNumber === 5) {
        treeDepth = value;
      } else if (fieldNumber === 6) {
        rootBlockHeight = value;
      }

      continue;
    }

    if (wireType === 2) {
      const { value: length, bytesRead } = parseVarint(messageBytes, offset);
      offset += bytesRead;
      const fieldBytes = messageBytes.slice(offset, offset + length);

      if (fieldNumber === 2) {
        merkleRoot = bytesToBase64(fieldBytes);
      } else if (fieldNumber === 3) {
        pathElements.push(bytesToBase64(fieldBytes));
      } else if (fieldNumber === 4) {
        let packedOffset = 0;
        while (packedOffset < fieldBytes.length) {
          const { value, bytesRead: packedBytesRead } = parseVarint(fieldBytes, packedOffset);
          packedOffset += packedBytesRead;
          pathIndices.push(value !== 0);
        }
      }

      offset += length;
      continue;
    }

    break;
  }

  return {
    isMember,
    merkleRoot,
    pathElements,
    pathIndices,
    treeDepth,
    rootBlockHeight,
  };
}

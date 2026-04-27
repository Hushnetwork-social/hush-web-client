import { describe, expect, it } from 'vitest';

import { parseGrpcResponse, parseGrpcWebResponse } from './grpc-web-helper';

function createGrpcWebFrame(flag: number, bytes: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + bytes.length);
  frame[0] = flag;
  frame[1] = (bytes.length >> 24) & 0xff;
  frame[2] = (bytes.length >> 16) & 0xff;
  frame[3] = (bytes.length >> 8) & 0xff;
  frame[4] = bytes.length & 0xff;
  frame.set(bytes, 5);
  return frame;
}

function concatFrames(...frames: Uint8Array[]): Uint8Array {
  const totalLength = frames.reduce((sum, frame) => sum + frame.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const frame of frames) {
    result.set(frame, offset);
    offset += frame.length;
  }

  return result;
}

describe('parseGrpcWebResponse', () => {
  it('keeps zero-length protobuf response frames as empty messages', () => {
    const trailers = new TextEncoder().encode('grpc-status: 0\r\n');
    const responseBytes = concatFrames(
      createGrpcWebFrame(0, new Uint8Array()),
      createGrpcWebFrame(0x80, trailers)
    );

    const parsed = parseGrpcWebResponse(responseBytes);

    expect(parsed.messageBytes).toBeInstanceOf(Uint8Array);
    expect(parsed.messageBytes).toHaveLength(0);
    expect(parsed.trailers).toEqual({ 'grpc-status': '0' });
    expect(parseGrpcResponse(responseBytes)).toHaveLength(0);
  });
});

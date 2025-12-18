import { grpcConfig } from './config';

// Generic gRPC-Web client wrapper
// Uses grpc-web library for browser-compatible gRPC communication

export class GrpcClient {
  private serverUrl: string;

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || grpcConfig.serverUrl;
  }

  // Generic unary call method
  async unaryCall<TRequest, TResponse>(
    serviceName: string,
    methodName: string,
    request: TRequest
  ): Promise<TResponse> {
    const url = `${this.serverUrl}/${serviceName}/${methodName}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          'X-Grpc-Web': '1',
          'Accept': 'application/grpc-web-text',
        },
        body: this.encodeRequest(request),
      });

      if (!response.ok) {
        throw new Error(`gRPC call failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      return this.decodeResponse<TResponse>(responseText);
    } catch (error) {
      console.error(`gRPC call to ${serviceName}/${methodName} failed:`, error);
      throw error;
    }
  }

  // Encode request to base64 protobuf format
  private encodeRequest<T>(request: T): string {
    // For gRPC-Web, we need to encode the message in a specific format
    // The format is: 1 byte flag + 4 bytes message length + message bytes
    const jsonStr = JSON.stringify(request);
    const bytes = new TextEncoder().encode(jsonStr);

    // Create the gRPC frame
    const frame = new Uint8Array(5 + bytes.length);
    frame[0] = 0; // No compression
    frame[1] = (bytes.length >> 24) & 0xff;
    frame[2] = (bytes.length >> 16) & 0xff;
    frame[3] = (bytes.length >> 8) & 0xff;
    frame[4] = bytes.length & 0xff;
    frame.set(bytes, 5);

    return btoa(String.fromCharCode(...frame));
  }

  // Decode base64 protobuf response
  private decodeResponse<T>(responseText: string): T {
    try {
      // gRPC-Web response is base64 encoded
      const binaryStr = atob(responseText);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Skip the 5-byte header (1 byte flag + 4 bytes length)
      if (bytes.length < 5) {
        throw new Error('Invalid gRPC response: too short');
      }

      const messageBytes = bytes.slice(5);
      const jsonStr = new TextDecoder().decode(messageBytes);

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      console.error('Failed to decode gRPC response:', error);
      throw new Error('Failed to decode gRPC response');
    }
  }
}

// Singleton instance
let grpcClient: GrpcClient | null = null;

export function getGrpcClient(): GrpcClient {
  if (!grpcClient) {
    grpcClient = new GrpcClient();
  }
  return grpcClient;
}

export function resetGrpcClient(serverUrl?: string): void {
  grpcClient = new GrpcClient(serverUrl);
}

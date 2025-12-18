// gRPC-Web configuration

export interface GrpcConfig {
  serverUrl: string;
  timeout: number;
}

// Default configuration - can be overridden via environment variables
export const grpcConfig: GrpcConfig = {
  serverUrl: process.env.NEXT_PUBLIC_GRPC_URL || 'https://api.hushnetwork.social',
  timeout: 30000, // 30 seconds
};

// gRPC-Web uses base64 encoding for binary data
export const GRPC_WEB_CONTENT_TYPE = 'application/grpc-web-text';

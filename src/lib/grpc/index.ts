// gRPC-Web Client Module
// Provides typed access to HushNetwork gRPC services

export { grpcConfig, type GrpcConfig } from './config';
export { GrpcClient, getGrpcClient, resetGrpcClient } from './client';
export * from './types';
export * from './services';

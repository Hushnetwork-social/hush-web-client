import {
  buildGetIdentityRequest,
  grpcCall,
  parseGrpcResponse,
  parseIdentityResponse,
} from "@/lib/grpc/grpc-web-helper";

export async function getIdentityProfile(publicSigningAddress: string): Promise<{
  exists: boolean;
  profileName?: string;
  publicSigningAddress?: string;
  publicEncryptAddress?: string;
  isPublic?: boolean;
  message?: string;
}> {
  const requestBytes = buildGetIdentityRequest(publicSigningAddress);
  const responseBytes = await grpcCall("rpcHush.HushIdentity", "GetIdentity", requestBytes);
  const messageBytes = parseGrpcResponse(responseBytes);

  if (!messageBytes) {
    throw new Error("Invalid gRPC response");
  }

  const identity = parseIdentityResponse(messageBytes);
  return {
    exists: identity.successful,
    profileName: identity.profileName,
    publicSigningAddress: identity.publicSigningAddress,
    publicEncryptAddress: identity.publicEncryptAddress,
    isPublic: identity.isPublic,
    message: identity.message,
  };
}

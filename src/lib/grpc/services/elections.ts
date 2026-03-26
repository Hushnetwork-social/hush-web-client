import { getGrpcClient } from '../client';
import type {
  CloseElectionRequest,
  CreateElectionDraftRequest,
  ElectionCommandResponse,
  FinalizeElectionRequest,
  GetElectionOpenReadinessRequest,
  GetElectionOpenReadinessResponse,
  GetElectionRequest,
  GetElectionResponse,
  GetElectionsByOwnerRequest,
  GetElectionsByOwnerResponse,
  InviteElectionTrusteeRequest,
  OpenElectionRequest,
  ResolveElectionTrusteeInvitationRequest,
  UpdateElectionDraftRequest,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushElections';

export const electionsService = {
  async createElectionDraft(request: CreateElectionDraftRequest): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<CreateElectionDraftRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'CreateElectionDraft',
      request
    );
  },

  async updateElectionDraft(request: UpdateElectionDraftRequest): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<UpdateElectionDraftRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'UpdateElectionDraft',
      request
    );
  },

  async inviteElectionTrustee(
    request: InviteElectionTrusteeRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<InviteElectionTrusteeRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'InviteElectionTrustee',
      request
    );
  },

  async acceptElectionTrusteeInvitation(
    request: ResolveElectionTrusteeInvitationRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<ResolveElectionTrusteeInvitationRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'AcceptElectionTrusteeInvitation',
      request
    );
  },

  async rejectElectionTrusteeInvitation(
    request: ResolveElectionTrusteeInvitationRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<ResolveElectionTrusteeInvitationRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RejectElectionTrusteeInvitation',
      request
    );
  },

  async revokeElectionTrusteeInvitation(
    request: ResolveElectionTrusteeInvitationRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<ResolveElectionTrusteeInvitationRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RevokeElectionTrusteeInvitation',
      request
    );
  },

  async getElectionOpenReadiness(
    request: GetElectionOpenReadinessRequest
  ): Promise<GetElectionOpenReadinessResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionOpenReadinessRequest, GetElectionOpenReadinessResponse>(
      SERVICE_NAME,
      'GetElectionOpenReadiness',
      request
    );
  },

  async openElection(request: OpenElectionRequest): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<OpenElectionRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'OpenElection',
      request
    );
  },

  async closeElection(request: CloseElectionRequest): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<CloseElectionRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'CloseElection',
      request
    );
  },

  async finalizeElection(request: FinalizeElectionRequest): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<FinalizeElectionRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'FinalizeElection',
      request
    );
  },

  async getElection(request: GetElectionRequest): Promise<GetElectionResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionRequest, GetElectionResponse>(
      SERVICE_NAME,
      'GetElection',
      request
    );
  },

  async getElectionsByOwner(
    request: GetElectionsByOwnerRequest
  ): Promise<GetElectionsByOwnerResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionsByOwnerRequest, GetElectionsByOwnerResponse>(
      SERVICE_NAME,
      'GetElectionsByOwner',
      request
    );
  },
};

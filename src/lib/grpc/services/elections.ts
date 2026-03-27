import { getGrpcClient } from '../client';
import type {
  ApproveElectionGovernedProposalRequest,
  CloseElectionRequest,
  CreateElectionDraftRequest,
  ElectionCommandResponse,
  FinalizeElectionRequest,
  GetElectionCeremonyActionViewRequest,
  GetElectionCeremonyActionViewResponse,
  GetElectionOpenReadinessRequest,
  GetElectionOpenReadinessResponse,
  GetElectionRequest,
  GetElectionResponse,
  GetElectionsByOwnerRequest,
  GetElectionsByOwnerResponse,
  InviteElectionTrusteeRequest,
  OpenElectionRequest,
  PublishElectionCeremonyTransportKeyRequest,
  RecordElectionCeremonySelfTestRequest,
  RecordElectionCeremonyShareExportRequest,
  RecordElectionCeremonyShareImportRequest,
  RecordElectionCeremonyValidationFailureRequest,
  RetryElectionGovernedProposalExecutionRequest,
  ResolveElectionTrusteeInvitationRequest,
  RestartElectionCeremonyRequest,
  StartElectionCeremonyRequest,
  StartElectionGovernedProposalRequest,
  SubmitElectionCeremonyMaterialRequest,
  CompleteElectionCeremonyTrusteeRequest,
  JoinElectionCeremonyRequest,
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

  async startElectionCeremony(
    request: StartElectionCeremonyRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<StartElectionCeremonyRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'StartElectionCeremony',
      request
    );
  },

  async restartElectionCeremony(
    request: RestartElectionCeremonyRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<RestartElectionCeremonyRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RestartElectionCeremony',
      request
    );
  },

  async publishElectionCeremonyTransportKey(
    request: PublishElectionCeremonyTransportKeyRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<PublishElectionCeremonyTransportKeyRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'PublishElectionCeremonyTransportKey',
      request
    );
  },

  async joinElectionCeremony(
    request: JoinElectionCeremonyRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<JoinElectionCeremonyRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'JoinElectionCeremony',
      request
    );
  },

  async recordElectionCeremonySelfTestSuccess(
    request: RecordElectionCeremonySelfTestRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<RecordElectionCeremonySelfTestRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RecordElectionCeremonySelfTestSuccess',
      request
    );
  },

  async submitElectionCeremonyMaterial(
    request: SubmitElectionCeremonyMaterialRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<SubmitElectionCeremonyMaterialRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'SubmitElectionCeremonyMaterial',
      request
    );
  },

  async recordElectionCeremonyValidationFailure(
    request: RecordElectionCeremonyValidationFailureRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<
      RecordElectionCeremonyValidationFailureRequest,
      ElectionCommandResponse
    >(SERVICE_NAME, 'RecordElectionCeremonyValidationFailure', request);
  },

  async completeElectionCeremonyTrustee(
    request: CompleteElectionCeremonyTrusteeRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<CompleteElectionCeremonyTrusteeRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'CompleteElectionCeremonyTrustee',
      request
    );
  },

  async recordElectionCeremonyShareExport(
    request: RecordElectionCeremonyShareExportRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<RecordElectionCeremonyShareExportRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RecordElectionCeremonyShareExport',
      request
    );
  },

  async recordElectionCeremonyShareImport(
    request: RecordElectionCeremonyShareImportRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<RecordElectionCeremonyShareImportRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RecordElectionCeremonyShareImport',
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

  async startElectionGovernedProposal(
    request: StartElectionGovernedProposalRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<StartElectionGovernedProposalRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'StartElectionGovernedProposal',
      request
    );
  },

  async approveElectionGovernedProposal(
    request: ApproveElectionGovernedProposalRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<ApproveElectionGovernedProposalRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'ApproveElectionGovernedProposal',
      request
    );
  },

  async retryElectionGovernedProposalExecution(
    request: RetryElectionGovernedProposalExecutionRequest
  ): Promise<ElectionCommandResponse> {
    const client = getGrpcClient();
    return client.unaryCall<RetryElectionGovernedProposalExecutionRequest, ElectionCommandResponse>(
      SERVICE_NAME,
      'RetryElectionGovernedProposalExecution',
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

  async getElectionCeremonyActionView(
    request: GetElectionCeremonyActionViewRequest
  ): Promise<GetElectionCeremonyActionViewResponse> {
    const client = getGrpcClient();
    return client.unaryCall<
      GetElectionCeremonyActionViewRequest,
      GetElectionCeremonyActionViewResponse
    >(SERVICE_NAME, 'GetElectionCeremonyActionView', request);
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

import { getGrpcClient } from '../client';
import type {
  GetElectionCeremonyActionViewRequest,
  GetElectionCeremonyActionViewResponse,
  GetElectionEligibilityViewRequest,
  GetElectionEligibilityViewResponse,
  GetElectionVotingViewRequest,
  GetElectionVotingViewResponse,
  GetElectionOpenReadinessRequest,
  GetElectionOpenReadinessResponse,
  GetElectionRequest,
  GetElectionEnvelopeAccessRequest,
  GetElectionEnvelopeAccessResponse,
  GetElectionResponse,
  GetElectionsByOwnerRequest,
  GetElectionsByOwnerResponse,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushElections';

export const electionsService = {
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

  async getElection(request: GetElectionRequest): Promise<GetElectionResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionRequest, GetElectionResponse>(
      SERVICE_NAME,
      'GetElection',
      request
    );
  },

  async getElectionEligibilityView(
    request: GetElectionEligibilityViewRequest
  ): Promise<GetElectionEligibilityViewResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionEligibilityViewRequest, GetElectionEligibilityViewResponse>(
      SERVICE_NAME,
      'GetElectionEligibilityView',
      request
    );
  },

  async getElectionVotingView(
    request: GetElectionVotingViewRequest
  ): Promise<GetElectionVotingViewResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionVotingViewRequest, GetElectionVotingViewResponse>(
      SERVICE_NAME,
      'GetElectionVotingView',
      request
    );
  },

  async getElectionEnvelopeAccess(
    request: GetElectionEnvelopeAccessRequest
  ): Promise<GetElectionEnvelopeAccessResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetElectionEnvelopeAccessRequest, GetElectionEnvelopeAccessResponse>(
      SERVICE_NAME,
      'GetElectionEnvelopeAccess',
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

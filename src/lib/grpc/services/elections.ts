import { buildApiUrl } from '@/lib/api-config';
import type {
  GetElectionCeremonyActionViewRequest,
  GetElectionCeremonyActionViewResponse,
  GetElectionHubViewRequest,
  GetElectionHubViewResponse,
  GetElectionEligibilityViewRequest,
  GetElectionEligibilityViewResponse,
  GetElectionReportAccessGrantsRequest,
  GetElectionReportAccessGrantsResponse,
  GetElectionResultViewRequest,
  GetElectionResultViewResponse,
  VerifyElectionReceiptRequest,
  VerifyElectionReceiptResponse,
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
  SearchElectionDirectoryRequest,
  SearchElectionDirectoryResponse,
} from '../types';

const ELECTIONS_QUERY_PROXY_URL = '/api/elections/query';

async function proxyElectionQuery<TRequest, TResponse>(
  method: string,
  request: TRequest
): Promise<TResponse> {
  const response = await fetch(buildApiUrl(ELECTIONS_QUERY_PROXY_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method, request }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Election query proxy failed for ${method}: ${response.status} ${text}`);
  }

  return (await response.json()) as TResponse;
}

export const electionsService = {
  async getElectionOpenReadiness(
    request: GetElectionOpenReadinessRequest
  ): Promise<GetElectionOpenReadinessResponse> {
    return proxyElectionQuery<GetElectionOpenReadinessRequest, GetElectionOpenReadinessResponse>(
      'GetElectionOpenReadiness',
      request
    );
  },

  async getElection(request: GetElectionRequest): Promise<GetElectionResponse> {
    return proxyElectionQuery<GetElectionRequest, GetElectionResponse>(
      'GetElection',
      request
    );
  },

  async searchElectionDirectory(
    request: SearchElectionDirectoryRequest
  ): Promise<SearchElectionDirectoryResponse> {
    return proxyElectionQuery<SearchElectionDirectoryRequest, SearchElectionDirectoryResponse>(
      'SearchElectionDirectory',
      request
    );
  },

  async getElectionHubView(
    request: GetElectionHubViewRequest
  ): Promise<GetElectionHubViewResponse> {
    return proxyElectionQuery<GetElectionHubViewRequest, GetElectionHubViewResponse>(
      'GetElectionHubView',
      request
    );
  },

  async getElectionEligibilityView(
    request: GetElectionEligibilityViewRequest
  ): Promise<GetElectionEligibilityViewResponse> {
    return proxyElectionQuery<GetElectionEligibilityViewRequest, GetElectionEligibilityViewResponse>(
      'GetElectionEligibilityView',
      request
    );
  },

  async getElectionVotingView(
    request: GetElectionVotingViewRequest
  ): Promise<GetElectionVotingViewResponse> {
    return proxyElectionQuery<GetElectionVotingViewRequest, GetElectionVotingViewResponse>(
      'GetElectionVotingView',
      request
    );
  },

  async verifyElectionReceipt(
    request: VerifyElectionReceiptRequest
  ): Promise<VerifyElectionReceiptResponse> {
    return proxyElectionQuery<VerifyElectionReceiptRequest, VerifyElectionReceiptResponse>(
      'VerifyElectionReceipt',
      request
    );
  },

  async getElectionEnvelopeAccess(
    request: GetElectionEnvelopeAccessRequest
  ): Promise<GetElectionEnvelopeAccessResponse> {
    return proxyElectionQuery<GetElectionEnvelopeAccessRequest, GetElectionEnvelopeAccessResponse>(
      'GetElectionEnvelopeAccess',
      request
    );
  },

  async getElectionResultView(
    request: GetElectionResultViewRequest
  ): Promise<GetElectionResultViewResponse> {
    return proxyElectionQuery<GetElectionResultViewRequest, GetElectionResultViewResponse>(
      'GetElectionResultView',
      request
    );
  },

  async getElectionReportAccessGrants(
    request: GetElectionReportAccessGrantsRequest
  ): Promise<GetElectionReportAccessGrantsResponse> {
    return proxyElectionQuery<
      GetElectionReportAccessGrantsRequest,
      GetElectionReportAccessGrantsResponse
    >('GetElectionReportAccessGrants', request);
  },

  async getElectionCeremonyActionView(
    request: GetElectionCeremonyActionViewRequest
  ): Promise<GetElectionCeremonyActionViewResponse> {
    return proxyElectionQuery<
      GetElectionCeremonyActionViewRequest,
      GetElectionCeremonyActionViewResponse
    >('GetElectionCeremonyActionView', request);
  },

  async getElectionsByOwner(
    request: GetElectionsByOwnerRequest
  ): Promise<GetElectionsByOwnerResponse> {
    return proxyElectionQuery<GetElectionsByOwnerRequest, GetElectionsByOwnerResponse>(
      'GetElectionsByOwner',
      request
    );
  },
};

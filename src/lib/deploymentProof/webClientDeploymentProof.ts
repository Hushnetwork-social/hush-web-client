import { webClientDeploymentProofMetadata } from '@/generated/webClientDeploymentProofMetadata';
import {
  getMissingWebClientDeploymentProofHeaders,
  getWebClientDeploymentProofHeadersFromMetadata,
  normalizeWebClientDeploymentProofMetadata,
  type WebClientDeploymentProofMetadata,
} from './webClientDeploymentProofContract';

export function getWebClientDeploymentProofMetadata(): WebClientDeploymentProofMetadata | null {
  const result = normalizeWebClientDeploymentProofMetadata(webClientDeploymentProofMetadata);
  return result.ok ? result.metadata : null;
}

export function getWebClientDeploymentProofHeaders(
  observationScope: string
): Record<string, string> {
  const metadata = getWebClientDeploymentProofMetadata();

  return metadata
    ? getWebClientDeploymentProofHeadersFromMetadata(metadata, observationScope)
    : getMissingWebClientDeploymentProofHeaders(observationScope);
}


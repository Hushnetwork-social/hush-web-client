import { describe, expect, it } from 'vitest';
import {
  ElectionClosedProgressStatusProto,
  type ElectionSp07EvidenceStatusView,
} from '@/lib/grpc';
import {
  getSp07OpenReadinessPresentation,
  getSp07PublicationProofPresentation,
  getSp07VerificationPackagePresentation,
} from './contracts';

function createSp07Evidence(
  overrides?: Partial<ElectionSp07EvidenceStatusView>
): ElectionSp07EvidenceStatusView {
  return {
    EvidenceExpected: true,
    PublicEvidenceAvailable: false,
    RestrictedEvidenceAvailable: false,
    PublicationProofMode: 'zk_rerandomization_shuffle_v1',
    ProofConstruction: 'bayer_groth_reencryption_shuffle_argument_v1',
    StatementId: 'sp07-bayer-groth-hush-vector-shuffle-v1',
    ExternalReviewStatus: 'external_crypto_review_pending',
    AcceptedBallotCount: 100,
    PublishedBallotCount: 0,
    CiphertextSlotCount: 8,
    ChunkCount: 1,
    AcceptedBallotSetHash: '',
    PublishedBallotStreamHash: '',
    TranscriptHash: '',
    ProofHash: '',
    WitnessDeletionReceiptHash: '',
    LatestPubResultCode: 'publication_proof_evidence_pending',
    ProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    CanRetry: false,
    Blockers: [],
    Message: '',
    CompletedChunkCount: 0,
    FailedChunkCount: 0,
    SlowestChunkMilliseconds: 0,
    ...overrides,
  };
}

describe('SP-07 presentation contracts', () => {
  it('marks open readiness as blocked when the proof envelope has blocking findings', () => {
    const presentation = getSp07OpenReadinessPresentation({
      Sp07Evidence: createSp07Evidence({
        AcceptedBallotCount: 501,
        Message: 'SP-07 publication-proof profile has blockers before election open.',
        Blockers: [
          {
            Code: 'sp07_publication_proof_envelope_exceeded',
            Message: 'SP-07 high-assurance v1 supports up to 500 accepted ballots.',
            BlocksOpen: true,
            BlocksFinalization: true,
          },
        ],
      }),
    });

    expect(presentation).toMatchObject({
      state: 'configured_blocked',
      tone: 'error',
      showTechnicalRefs: true,
      blockingCodes: ['sp07_publication_proof_envelope_exceeded'],
    });
  });

  it('maps a verified package to success and keeps public evidence availability visible', () => {
    const presentation = getSp07VerificationPackagePresentation({
      Sp07Evidence: createSp07Evidence({
        PublicEvidenceAvailable: true,
        RestrictedEvidenceAvailable: true,
        PublishedBallotCount: 100,
        CompletedChunkCount: 1,
        TranscriptHash: 'transcript-hash',
        ProofHash: 'proof-hash',
        LatestPubResultCode: 'publication_proof_evidence_valid',
        ProgressStatus:
          ElectionClosedProgressStatusProto.ClosedProgressPublicationProofVerified,
      }),
    }, 'auditor');

    expect(presentation).toMatchObject({
      state: 'tally_ready',
      tone: 'success',
      publicEvidenceAvailable: true,
      restrictedEvidenceAvailable: true,
      showTechnicalRefs: true,
    });
  });

  it('maps failed close progress to retry-aware owner/admin copy', () => {
    const presentation = getSp07PublicationProofPresentation(
      createSp07Evidence({
        CanRetry: true,
        ProgressStatus:
          ElectionClosedProgressStatusProto.ClosedProgressPublicationProofFailed,
      }),
      'owner-admin'
    );

    expect(presentation).toMatchObject({
      state: 'publication_proof_failed',
      tone: 'error',
      canRetry: true,
    });
  });

  it('does not expose voter-facing SP-07 package refs in v1', () => {
    const presentation = getSp07VerificationPackagePresentation({
      Sp07Evidence: createSp07Evidence({
        PublicEvidenceAvailable: true,
        ProofHash: 'proof-hash',
      }),
    }, 'voter');

    expect(presentation).toBeNull();
  });
});

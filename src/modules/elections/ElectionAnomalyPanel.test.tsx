import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionLifecycleStateProto,
  TransactionStatus,
  type ElectionAnomalyMessageView,
  type GetElectionAnomalyOwnThreadResponse,
} from '@/lib/grpc';
import { timestamp } from './HushVotingWorkspaceTestUtils';
import { ElectionAnomalyPanel } from './ElectionAnomalyPanel';
import {
  ELECTION_ANOMALY_ATTACHMENT_KIND_IDS,
  ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS,
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
  ELECTION_ANOMALY_VALIDATION_CODES,
} from './transactionService';

const {
  electionsServiceMock,
  submitTransactionMock,
  transactionServiceMock,
} = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionAnomalyOwnThread: vi.fn(),
    stageElectionAnomalyRestrictedPayload: vi.fn(),
  },
  submitTransactionMock: vi.fn(),
  transactionServiceMock: {
    createElectionAnomalyRestrictedEvidencePayload: vi.fn(),
    createElectionAnomalySubmitterAttachmentContentKeyWraps: vi.fn(),
    createRecordElectionAnomalyAttachmentManifestTransaction: vi.fn(),
    createSubmitElectionAnomalyInformationTransaction: vi.fn(),
    createSubmitElectionAnomalyThreadTransaction: vi.fn(),
    decryptElectionAnomalyMessageBody: vi.fn(),
    prepareElectionAnomalyAttachmentManifestMaterial: vi.fn(),
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => submitTransactionMock(...args),
}));

vi.mock('./transactionService', async () => {
  const actual = await vi.importActual<typeof import('./transactionService')>('./transactionService');
  return {
    ...actual,
    createElectionAnomalyRestrictedEvidencePayload: (...args: unknown[]) =>
      transactionServiceMock.createElectionAnomalyRestrictedEvidencePayload(...args),
    createElectionAnomalySubmitterAttachmentContentKeyWraps: (...args: unknown[]) =>
      transactionServiceMock.createElectionAnomalySubmitterAttachmentContentKeyWraps(...args),
    createRecordElectionAnomalyAttachmentManifestTransaction: (...args: unknown[]) =>
      transactionServiceMock.createRecordElectionAnomalyAttachmentManifestTransaction(...args),
    createSubmitElectionAnomalyInformationTransaction: (...args: unknown[]) =>
      transactionServiceMock.createSubmitElectionAnomalyInformationTransaction(...args),
    createSubmitElectionAnomalyThreadTransaction: (...args: unknown[]) =>
      transactionServiceMock.createSubmitElectionAnomalyThreadTransaction(...args),
    decryptElectionAnomalyMessageBody: (...args: unknown[]) =>
      transactionServiceMock.decryptElectionAnomalyMessageBody(...args),
    prepareElectionAnomalyAttachmentManifestMaterial: (...args: unknown[]) =>
      transactionServiceMock.prepareElectionAnomalyAttachmentManifestMaterial(...args),
  };
});

function createMessage(overrides?: Partial<ElectionAnomalyMessageView>): ElectionAnomalyMessageView {
  return {
    MessageId: 'message-request-1',
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
    RecordedAt: timestamp,
    EncryptedBody: 'ciphertext-body-not-for-ui',
    EncryptedBodyHash: 'sha256:body',
    PlaintextCharacterCount: 48,
    RecipientWraps: [],
    ClarificationRequestId: '11111111-1111-1111-1111-111111111111',
    HasClarificationRequest: true,
    AttachmentManifestHash: '',
    ...overrides,
  };
}

function createOwnThreadResponse(
  hasOpenClarificationRequest = true,
): GetElectionAnomalyOwnThreadResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'submitter-address',
    HasThread: true,
    Thread: {
      AnomalyThreadId: '22222222-2222-2222-2222-222222222222',
      ElectionId: 'election-128',
      CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
      CaseStateId: hasOpenClarificationRequest
        ? ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION
        : ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW,
      CurrentThreadHash: 'sha256:thread',
      SeverityCandidateId: 'requires_authority_review',
      GovernedDecisionRef: '',
      HasOpenClarificationRequest: hasOpenClarificationRequest,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Messages: hasOpenClarificationRequest
        ? [createMessage()]
        : [
            createMessage({
              ClarificationRequestId: '',
              HasClarificationRequest: false,
            }),
          ],
    },
  };
}

function renderPanel() {
  return render(
    <ElectionAnomalyPanel
      electionId="election-128"
      actorPublicAddress="submitter-address"
      actorEncryptionPublicKey="submitter-encrypt-public"
      actorEncryptionPrivateKey="submitter-encrypt-private"
      actorSigningPrivateKey="submitter-signing-private"
      ownerPublicAddress="owner-address"
      isLinkedVoter
      canReadOwnThread
      canCreateThread
      lifecycleState={ElectionLifecycleStateProto.Open}
    />,
  );
}

describe('ElectionAnomalyPanel clarification evidence uploader', () => {
  beforeEach(() => {
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createOwnThreadResponse(),
    );
    electionsServiceMock.stageElectionAnomalyRestrictedPayload.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'submitter-address',
      PayloadReference:
        'hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333',
      EncryptedPayloadHash: 'sha256:encrypted-payload',
      ContentHash: 'sha256:content',
      SizeBytes: 438_000,
      MimeType: 'image/png',
      ScannerStatusId: 'pending',
      PayloadAvailabilityStatusId: 'available',
      ValidationCode: '',
    });
    submitTransactionMock.mockResolvedValue({
      successful: true,
      status: TransactionStatus.ACCEPTED,
      message: 'accepted',
    });
    transactionServiceMock.decryptElectionAnomalyMessageBody.mockResolvedValue(
      'Please provide the missing receipt screenshot.',
    );
    transactionServiceMock.createElectionAnomalyRestrictedEvidencePayload.mockResolvedValue({
      EncryptedPayload: new Uint8Array([11, 12, 13]),
      ContentKey: 'restricted-content-key',
    });
    transactionServiceMock.createElectionAnomalySubmitterAttachmentContentKeyWraps.mockResolvedValue([
      {
        RecipientRoleId: 'submitter',
        RecipientPublicAddress: 'submitter-address',
        RecipientKeyFingerprint: 'sha256:submitter-key',
        EncryptedContentKey: 'submitter-wrapped-content-key',
        WrapAlgorithm: 'x25519-aes-gcm',
        WrapStatusId: 'available',
      },
      {
        RecipientRoleId: 'election_owner',
        RecipientPublicAddress: 'owner-address',
        RecipientKeyFingerprint: 'sha256:owner-key',
        EncryptedContentKey: 'owner-wrapped-content-key',
        WrapAlgorithm: 'x25519-aes-gcm',
        WrapStatusId: 'available',
      },
    ]);
    transactionServiceMock.prepareElectionAnomalyAttachmentManifestMaterial.mockResolvedValue({
      EncryptedPayloadReference:
        'hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333',
      EncryptedPayloadHash: 'sha256:encrypted-payload',
      ContentHash: 'sha256:content',
      SizeBytes: 438_000,
    });
    transactionServiceMock.createRecordElectionAnomalyAttachmentManifestTransaction.mockResolvedValue({
      signedTransaction: 'signed-evidence-manifest-tx',
      attachmentManifestId: 'manifest-1',
    });
    transactionServiceMock.createSubmitElectionAnomalyInformationTransaction.mockResolvedValue({
      signedTransaction: 'signed-clarification-tx',
    });
    transactionServiceMock.createSubmitElectionAnomalyThreadTransaction.mockResolvedValue({
      signedTransaction: 'signed-thread-tx',
      anomalyThreadId: 'thread-new',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stages a request-bound evidence file and signs its manifest before the clarification response', async () => {
    renderPanel();

    expect(await screen.findByText('Clarification requested')).toBeInTheDocument();
    const file = new File(['receipt image bytes'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose clarification evidence files'), {
      target: {
        files: [file],
      },
    });

    expect(await screen.findByText('Payload staged', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.getByText('receipt.png')).toBeInTheDocument();
    expect(screen.getByText('sha256:content')).toBeInTheDocument();
    expect(
      screen.queryByText('hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333'),
    ).not.toBeInTheDocument();
    expect(electionsServiceMock.stageElectionAnomalyRestrictedPayload)
      .toHaveBeenCalledWith(expect.objectContaining({
        ElectionId: 'election-128',
        ActorPublicAddress: 'submitter-address',
        AnomalyThreadId: '22222222-2222-2222-2222-222222222222',
        AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE,
        EncryptedPayloadHash: 'sha256:encrypted-payload',
        ContentHash: 'sha256:content',
        SizeBytes: 438_000,
        MimeType: 'image/png',
        ClarificationRequestId: '11111111-1111-1111-1111-111111111111',
      }));
    expect(electionsServiceMock.stageElectionAnomalyRestrictedPayload.mock.calls[0][0].EncryptedPayloadBase64)
      .toEqual(expect.any(String));

    fireEvent.change(screen.getByLabelText('Clarification response body'), {
      target: { value: 'Attached the requested receipt screenshot.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit clarification' }));

    await waitFor(() => {
      expect(transactionServiceMock.createRecordElectionAnomalyAttachmentManifestTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-128',
          AnomalyThreadId: '22222222-2222-2222-2222-222222222222',
          ActorPublicAddress: 'submitter-address',
          AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE,
          EncryptedPayloadReference:
            'hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333',
          EncryptedPayloadHash: 'sha256:encrypted-payload',
          ContentHash: 'sha256:content',
          SizeBytes: 438_000,
          MimeType: 'image/png',
          ValidationStatusId: ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS.PENDING_SCAN,
          ClarificationRequestId: '11111111-1111-1111-1111-111111111111',
          ContentKeyWraps: expect.arrayContaining([
            expect.objectContaining({
              RecipientRoleId: 'submitter',
              EncryptedContentKey: 'submitter-wrapped-content-key',
            }),
            expect.objectContaining({
              RecipientRoleId: 'election_owner',
              EncryptedContentKey: 'owner-wrapped-content-key',
            }),
          ]),
        }));
    });
    expect(transactionServiceMock.createSubmitElectionAnomalyInformationTransaction)
      .toHaveBeenCalledWith(expect.objectContaining({
        Body: 'Attached the requested receipt screenshot.',
        ClarificationRequestId: '11111111-1111-1111-1111-111111111111',
      }));
    expect(submitTransactionMock).toHaveBeenNthCalledWith(1, 'signed-evidence-manifest-tx');
    expect(submitTransactionMock).toHaveBeenNthCalledWith(2, 'signed-clarification-tx');
    expect(
      await screen.findByText(/Clarification response and evidence manifests accepted/),
    ).toBeInTheDocument();
  });

  it('shows validation rejection for unsupported evidence MIME before signing', async () => {
    renderPanel();

    await screen.findByText('Clarification requested');
    const file = new File(['zip bytes'], 'archive.zip', { type: 'application/zip' });
    fireEvent.change(screen.getByLabelText('Choose clarification evidence files'), {
      target: {
        files: [file],
      },
    });

    expect(await screen.findByText('Validation rejected')).toBeInTheDocument();
    expect(screen.getByText(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID))
      .toBeInTheDocument();
    expect(transactionServiceMock.prepareElectionAnomalyAttachmentManifestMaterial)
      .not.toHaveBeenCalled();
    expect(electionsServiceMock.stageElectionAnomalyRestrictedPayload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Clarification response body'), {
      target: { value: 'Response without an acceptable evidence file.' },
    });
    expect(screen.getByRole('button', { name: 'Submit clarification' })).toBeDisabled();
  });

  it('shows validation rejection when restricted payload staging is denied', async () => {
    electionsServiceMock.stageElectionAnomalyRestrictedPayload.mockResolvedValue({
      Success: false,
      ErrorMessage: 'Submitter restricted evidence does not match the open authority request.',
      ActorPublicAddress: 'submitter-address',
      PayloadReference: '',
      EncryptedPayloadHash: '',
      ContentHash: '',
      SizeBytes: 0,
      MimeType: '',
      ScannerStatusId: '',
      PayloadAvailabilityStatusId: '',
      ValidationCode: ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN,
    });

    renderPanel();

    await screen.findByText('Clarification requested');
    const file = new File(['receipt image bytes'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose clarification evidence files'), {
      target: {
        files: [file],
      },
    });

    expect(await screen.findByText('Validation rejected')).toBeInTheDocument();
    expect(screen.getByText(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN))
      .toBeInTheDocument();
    expect(transactionServiceMock.createRecordElectionAnomalyAttachmentManifestTransaction)
      .not.toHaveBeenCalled();
  });

  it('does not render the evidence uploader without a usable open request', async () => {
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createOwnThreadResponse(false),
    );

    renderPanel();

    expect(await screen.findByText('No clarification response is currently requested.'))
      .toBeInTheDocument();
    expect(screen.queryByTestId('election-anomaly-clarification-evidence'))
      .not.toBeInTheDocument();
  });
});

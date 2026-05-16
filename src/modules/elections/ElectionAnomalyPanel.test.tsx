import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionLifecycleStateProto,
  TransactionStatus,
  type ElectionAnomalyMessageView,
  type ElectionAnomalyOwnerMessageView,
  type ElectionAnomalyOwnerTriageThreadView,
  type GetElectionAnomalyOwnThreadResponse,
  type GetElectionAnomalyOwnerTriageResponse,
} from '@/lib/grpc';
import { timestamp } from './HushVotingWorkspaceTestUtils';
import { ElectionAnomalyPanel } from './ElectionAnomalyPanel';
import {
  ELECTION_ANOMALY_ATTACHMENT_KIND_IDS,
  ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS,
  ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS,
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
    getElectionAnomalyOwnerTriage: vi.fn(),
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
    decryptElectionAnomalyOwnerMessageBody: vi.fn(),
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
    decryptElectionAnomalyOwnerMessageBody: (...args: unknown[]) =>
      transactionServiceMock.decryptElectionAnomalyOwnerMessageBody(...args),
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

function createInitialSubmissionMessage(
  overrides?: Partial<ElectionAnomalyMessageView>,
): ElectionAnomalyMessageView {
  return createMessage({
    MessageId: 'message-initial-1',
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
    ClarificationRequestId: '',
    HasClarificationRequest: false,
    ...overrides,
  });
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
        ? [createInitialSubmissionMessage(), createMessage()]
        : [createInitialSubmissionMessage()],
    },
  };
}

function createEmptyOwnThreadResponse(): GetElectionAnomalyOwnThreadResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'submitter-address',
    HasThread: false,
  };
}

function createOwnerMessage(
  overrides?: Partial<ElectionAnomalyOwnerMessageView>,
): ElectionAnomalyOwnerMessageView {
  return {
    MessageId: 'owner-message-initial-1',
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
    RecordedAt: timestamp,
    EncryptedBody: 'owner-ciphertext-body-not-for-ui',
    EncryptedBodyHash: 'sha256:owner-body',
    PlaintextCharacterCount: 48,
    RecipientStatuses: [],
    HasCallerOwnerWrap: true,
    CallerOwnerWrap: {
      WrapStatusId: 'available',
      RecipientKeyFingerprint: 'sha256:owner-key',
      EncryptedContentKey: 'owner-content-key',
      WrapAlgorithm: 'x25519-aes-gcm',
    },
    ClarificationRequestId: '',
    HasClarificationRequest: false,
    AttachmentManifestHash: '',
    ...overrides,
  };
}

function createOwnerRegisteredThread(
  overrides?: Partial<ElectionAnomalyOwnerTriageThreadView>,
): ElectionAnomalyOwnerTriageThreadView {
  return {
    AnomalyThreadId: 'owner-registered-thread-1',
    ElectionId: 'election-128',
    CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
    CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.SUBMITTED,
    CurrentThreadHash: 'sha256:registered-thread',
    SeverityCandidateId: 'not_assessed',
    GovernedDecisionRef: '',
    SubmitterActorPublicAddress: 'submitter-address',
    SubmitterRoleContextId: ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.EXTERNAL_CLAIMANT_REGISTRAR,
    LifecycleStateAtSubmission: ElectionLifecycleStateProto.Open,
    HasOpenClarificationRequest: false,
    OpenClarificationRequestId: '',
    HasOpenClarificationRequestId: false,
    CreatedAt: timestamp,
    UpdatedAt: timestamp,
    Messages: [createOwnerMessage()],
    ...overrides,
  };
}

function createOwnerTriageResponse(
  threads: ElectionAnomalyOwnerTriageThreadView[] = [],
): GetElectionAnomalyOwnerTriageResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'submitter-address',
    HasTriage: true,
    Triage: {
      ElectionId: 'election-128',
      TotalThreadCount: threads.length,
      OpenThreadCount: threads.length,
      AwaitingInformationThreadCount: 0,
      ResponsePresentThreadCount: 0,
      ExternalClaimantThreadCount: threads.length,
      DecryptableMessageCount: threads.reduce((count, thread) => count + thread.Messages.length, 0),
      PendingRewrapMessageCount: 0,
      MissingOwnerWrapMessageCount: 0,
      AttachmentManifestCount: 0,
      GovernedContinuityHandoffStatusId: 'continuity_normal',
      CategoryCounts: [],
      CaseStateCounts: [],
      Threads: threads,
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
    window.sessionStorage.clear();
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createOwnThreadResponse(),
    );
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue({
      Success: false,
      ErrorMessage: 'Not owner triage for this actor.',
      ActorPublicAddress: 'submitter-address',
      HasTriage: false,
    });
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
    transactionServiceMock.decryptElectionAnomalyOwnerMessageBody.mockResolvedValue(
      'We are having problems with the election ...',
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
    vi.useRealTimers();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('does not offer a second anomaly form when the own thread is already loaded', async () => {
    renderPanel();

    expect(await screen.findByText('Your anomaly is registered')).toBeInTheDocument();
    expect(screen.getByText('Thread history')).toBeInTheDocument();
    expect(screen.getByText('Existing report')).toBeInTheDocument();
    expect(screen.getByText('Already submitted')).toBeInTheDocument();
    expect(screen.getByTestId('election-anomaly-state-timeline')).toHaveTextContent(
      'Authority request',
    );
    expect(screen.getByTestId('election-anomaly-state-timeline')).toHaveTextContent(
      'Waiting for my reply',
    );
    expect(screen.getByTestId('election-anomaly-state-timeline')).toHaveTextContent(
      'Authority response',
    );
    expect(screen.getByText(/Review your submitted election anomaly thread here/))
      .toBeInTheDocument();
    expect(screen.queryByTestId('election-anomaly-create')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit anomaly' })).not.toBeInTheDocument();
  });

  it('blocks duplicate submit UI while a local submission is waiting for the own-thread projection', async () => {
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createEmptyOwnThreadResponse(),
    );
    window.sessionStorage.setItem(
      'feat123:anomaly-pending:election-128:submitter-address',
      JSON.stringify({
        anomalyThreadId: 'thread-new',
        categoryId: ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
        submittedAt: '2026-05-16T09:10:20.000Z',
      }),
    );

    render(
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
        surface="account"
        lifecycleState={ElectionLifecycleStateProto.Open}
      />,
    );

    expect(await screen.findByTestId('election-anomaly-pending')).toHaveTextContent(
      'Report submitted from this device',
    );
    expect(screen.getByText('Submission pending')).toBeInTheDocument();
    expect(screen.getByText('Blocked while indexing')).toBeInTheDocument();
    expect(screen.queryByTestId('election-anomaly-create')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit anomaly' })).not.toBeInTheDocument();
  });

  it('shows a read-only owner-registered claimant report when the account own thread is empty', async () => {
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createEmptyOwnThreadResponse(),
    );
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createOwnerTriageResponse([createOwnerRegisteredThread()]),
    );

    render(
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
        surface="account"
        lifecycleState={ElectionLifecycleStateProto.Open}
      />,
    );

    expect(await screen.findByText('External claimant report registered by this account'))
      .toBeInTheDocument();
    expect(screen.getByTestId('election-anomaly-owner-registered-thread'))
      .toHaveTextContent('External objection or complaint');
    expect(screen.getByTestId('election-anomaly-owner-registered-state-timeline'))
      .toHaveTextContent('Initial report');
    expect(await screen.findByText('We are having problems with the election ...'))
      .toBeInTheDocument();
    expect(screen.queryByTestId('election-anomaly-create')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit anomaly' })).not.toBeInTheDocument();
  });

  it('does not present stale awaiting-information state as actionable without an open request', async () => {
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createEmptyOwnThreadResponse(),
    );
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createOwnerTriageResponse([
        createOwnerRegisteredThread({
          CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION,
          HasOpenClarificationRequest: false,
          OpenClarificationRequestId: '',
          HasOpenClarificationRequestId: false,
          Messages: [
            createOwnerMessage(),
            createOwnerMessage({
              MessageId: 'owner-message-response-1',
              MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE,
            }),
          ],
        }),
      ]),
    );

    render(
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
        surface="account"
        lifecycleState={ElectionLifecycleStateProto.Open}
      />,
    );

    const registeredThread = await screen.findByTestId('election-anomaly-owner-registered-thread');
    expect(registeredThread).toHaveTextContent('Authority response recorded');
    expect(registeredThread).not.toHaveTextContent('Awaiting information');
    expect(screen.getByTestId('election-anomaly-owner-registered-no-action'))
      .toHaveTextContent('No open clarification request');
    expect(screen.getByTestId('election-anomaly-owner-registered-no-action'))
      .toHaveTextContent('marked as awaiting information without a clarification request transaction');
    expect(screen.queryByTestId('election-anomaly-owner-registered-clarification'))
      .not.toBeInTheDocument();
  });

  it('lets the registered claimant workspace answer an open clarification request', async () => {
    const registeredClarificationRequestId = 'registered-clarification-1';
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createEmptyOwnThreadResponse(),
    );
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createOwnerTriageResponse([
        createOwnerRegisteredThread({
          CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION,
          HasOpenClarificationRequest: true,
          OpenClarificationRequestId: registeredClarificationRequestId,
          HasOpenClarificationRequestId: true,
          Messages: [
            createOwnerMessage(),
            createOwnerMessage({
              MessageId: 'owner-message-request-1',
              MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
              ClarificationRequestId: registeredClarificationRequestId,
              HasClarificationRequest: true,
            }),
          ],
        }),
      ]),
    );

    render(
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
        surface="account"
        lifecycleState={ElectionLifecycleStateProto.Open}
      />,
    );

    expect(await screen.findByTestId('election-anomaly-owner-registered-clarification'))
      .toHaveTextContent('Clarification requested');
    fireEvent.change(screen.getByLabelText('Registered claimant clarification response body'), {
      target: { value: 'Here is the extra information requested.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit clarification' }));

    await waitFor(() => {
      expect(transactionServiceMock.createSubmitElectionAnomalyInformationTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-128',
          AnomalyThreadId: 'owner-registered-thread-1',
          ClarificationRequestId: registeredClarificationRequestId,
          ActorPublicAddress: 'submitter-address',
          Body: 'Here is the extra information requested.',
        }));
    });
    expect(submitTransactionMock).toHaveBeenCalledWith('signed-clarification-tx');
    expect(await screen.findByTestId('election-anomaly-owner-registered-clarification-submitted'))
      .toHaveTextContent('Clarification response submitted');
    expect(screen.queryByTestId('election-anomaly-owner-registered-clarification'))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit clarification' }))
      .not.toBeInTheDocument();
  });

  it('shows registered claimant clarification submission errors next to the composer', async () => {
    const registeredClarificationRequestId = 'registered-clarification-1';
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue(
      createEmptyOwnThreadResponse(),
    );
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createOwnerTriageResponse([
        createOwnerRegisteredThread({
          CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION,
          HasOpenClarificationRequest: true,
          OpenClarificationRequestId: registeredClarificationRequestId,
          HasOpenClarificationRequestId: true,
          Messages: [
            createOwnerMessage(),
            createOwnerMessage({
              MessageId: 'owner-message-request-1',
              MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
              ClarificationRequestId: registeredClarificationRequestId,
              HasClarificationRequest: true,
            }),
          ],
        }),
      ]),
    );
    submitTransactionMock.mockResolvedValueOnce({
      successful: false,
      status: TransactionStatus.REJECTED,
      message: 'Only the original anomaly submitter can answer a clarification request.',
    });

    render(
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
        surface="account"
        lifecycleState={ElectionLifecycleStateProto.Open}
      />,
    );

    await screen.findByTestId('election-anomaly-owner-registered-clarification');
    fireEvent.change(screen.getByLabelText('Registered claimant clarification response body'), {
      target: { value: 'Here is the extra information requested.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit clarification' }));

    expect(await screen.findByTestId('election-anomaly-owner-registered-clarification-feedback'))
      .toHaveTextContent('Only the original anomaly submitter can answer a clarification request.');
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
    expect(await screen.findByTestId('election-anomaly-clarification-submitted'))
      .toHaveTextContent('Clarification response submitted');
    expect(screen.queryByTestId('election-anomaly-clarification'))
      .not.toBeInTheDocument();
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

    expect(await screen.findByText('Validation rejected', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.getByText(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID))
      .toBeInTheDocument();
    expect(transactionServiceMock.prepareElectionAnomalyAttachmentManifestMaterial)
      .not.toHaveBeenCalled();
    expect(electionsServiceMock.stageElectionAnomalyRestrictedPayload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Clarification response body'), {
      target: { value: 'Response without an acceptable evidence file.' },
    });
    expect(screen.getByRole('button', { name: 'Submit clarification' })).toBeDisabled();
  }, 10_000);

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

    await waitFor(() => {
      expect(electionsServiceMock.stageElectionAnomalyRestrictedPayload).toHaveBeenCalled();
    });
    expect(await screen.findByText('Validation rejected', {}, { timeout: 5_000 })).toBeInTheDocument();
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

    expect(await screen.findByText('No open clarification request'))
      .toBeInTheDocument();
    expect(screen.getByText('Voter report')).toBeInTheDocument();
    expect(screen.getByText(/complete history currently available/)).toBeInTheDocument();
    expect(screen.queryByTestId('election-anomaly-clarification-evidence'))
      .not.toBeInTheDocument();
  });
});

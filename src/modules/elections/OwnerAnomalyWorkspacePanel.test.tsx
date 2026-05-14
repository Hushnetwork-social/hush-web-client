import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionLifecycleStateProto,
  ElectionReportAccessGrantRoleProto,
  TransactionStatus,
  type ElectionAnomalyOwnerMessageView,
  type ElectionAnomalyOwnerTriageThreadView,
  type GetElectionAnomalyOwnerTriageResponse,
  type GetElectionReportAccessGrantsResponse,
} from '@/lib/grpc';
import { createElectionRecord, timestamp } from './HushVotingWorkspaceTestUtils';
import { OwnerAnomalyWorkspacePanel } from './OwnerAnomalyWorkspacePanel';
import {
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
  ELECTION_ANOMALY_RECIPIENT_ROLE_IDS,
  ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS,
  ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS,
} from './transactionService';

const {
  electionsServiceMock,
  identityServiceMock,
  submitTransactionMock,
  transactionServiceMock,
  useElectionsStoreMock,
  loadElectionMock,
  resetMock,
} = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionAnomalyOwnerTriage: vi.fn(),
    getElectionReportAccessGrants: vi.fn(),
  },
  identityServiceMock: {
    getIdentity: vi.fn(),
  },
  submitTransactionMock: vi.fn(),
  transactionServiceMock: {
    createClassifyElectionAnomalyThreadTransaction: vi.fn(),
    createRecordElectionAnomalyAuthorityResponseTransaction: vi.fn(),
    createRecordElectionAnomalyAuditorRecipientRewrapTransaction: vi.fn(),
    createRegisterExternalElectionAnomalyClaimantTransaction: vi.fn(),
    createRequestElectionAnomalyInformationTransaction: vi.fn(),
    decryptElectionAnomalyOwnerMessageBody: vi.fn(),
    decryptElectionAnomalyOwnerMessageContentKey: vi.fn(),
    hashExternalElectionAnomalyClaimantReference: vi.fn(),
  },
  useElectionsStoreMock: vi.fn(),
  loadElectionMock: vi.fn(),
  resetMock: vi.fn(),
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

vi.mock('@/lib/grpc/services/identity', () => ({
  identityService: identityServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => submitTransactionMock(...args),
}));

vi.mock('./useElectionsStore', () => ({
  useElectionsStore: () => useElectionsStoreMock(),
}));

vi.mock('./transactionService', async () => {
  const actual = await vi.importActual<typeof import('./transactionService')>('./transactionService');
  return {
    ...actual,
    createClassifyElectionAnomalyThreadTransaction: (...args: unknown[]) =>
      transactionServiceMock.createClassifyElectionAnomalyThreadTransaction(...args),
    createRecordElectionAnomalyAuthorityResponseTransaction: (...args: unknown[]) =>
      transactionServiceMock.createRecordElectionAnomalyAuthorityResponseTransaction(...args),
    createRecordElectionAnomalyAuditorRecipientRewrapTransaction: (...args: unknown[]) =>
      transactionServiceMock.createRecordElectionAnomalyAuditorRecipientRewrapTransaction(...args),
    createRegisterExternalElectionAnomalyClaimantTransaction: (...args: unknown[]) =>
      transactionServiceMock.createRegisterExternalElectionAnomalyClaimantTransaction(...args),
    createRequestElectionAnomalyInformationTransaction: (...args: unknown[]) =>
      transactionServiceMock.createRequestElectionAnomalyInformationTransaction(...args),
    decryptElectionAnomalyOwnerMessageBody: (...args: unknown[]) =>
      transactionServiceMock.decryptElectionAnomalyOwnerMessageBody(...args),
    decryptElectionAnomalyOwnerMessageContentKey: (...args: unknown[]) =>
      transactionServiceMock.decryptElectionAnomalyOwnerMessageContentKey(...args),
    hashExternalElectionAnomalyClaimantReference: (...args: unknown[]) =>
      transactionServiceMock.hashExternalElectionAnomalyClaimantReference(...args),
  };
});

function createMessage(overrides?: Partial<ElectionAnomalyOwnerMessageView>): ElectionAnomalyOwnerMessageView {
  return {
    MessageId: 'message-1',
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
    RecordedAt: timestamp,
    EncryptedBody: 'ciphertext-body',
    EncryptedBodyHash: 'sha256:body',
    PlaintextCharacterCount: 33,
    RecipientStatuses: [
      {
        RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
        WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
      },
      {
        RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR,
        WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.PENDING_BACKFILL,
      },
    ],
    HasCallerOwnerWrap: true,
    CallerOwnerWrap: {
      WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
      RecipientKeyFingerprint: 'sha256:owner-key',
      EncryptedContentKey: 'encrypted-content-key',
      WrapAlgorithm: 'x25519-aes-gcm',
    },
    ClarificationRequestId: '',
    HasClarificationRequest: false,
    AttachmentManifestHash: '',
    ...overrides,
  };
}

function createThread(
  overrides?: Partial<ElectionAnomalyOwnerTriageThreadView>,
): ElectionAnomalyOwnerTriageThreadView {
  const hasOpenClarification =
    overrides?.HasOpenClarificationRequest ?? true;

  return {
    AnomalyThreadId: 'thread-1',
    ElectionId: 'election-127',
    CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY,
    CaseStateId: hasOpenClarification
      ? ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION
      : ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW,
    CurrentThreadHash: 'sha256:thread',
    SeverityCandidateId: ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.REQUIRES_AUTHORITY_REVIEW,
    GovernedDecisionRef: '',
    SubmitterActorPublicAddress: 'submitter-address',
    SubmitterRoleContextId: 'trustee',
    LifecycleStateAtSubmission: ElectionLifecycleStateProto.Draft,
    HasOpenClarificationRequest: hasOpenClarification,
    OpenClarificationRequestId: hasOpenClarification ? 'clarification-1' : '',
    HasOpenClarificationRequestId: hasOpenClarification,
    CreatedAt: timestamp,
    UpdatedAt: timestamp,
    Messages: [createMessage()],
    ...overrides,
  };
}

function createTriageResponse(
  overrides?: Partial<GetElectionAnomalyOwnerTriageResponse>,
  threadOverrides?: {
    hasOpenClarification?: boolean;
    messages?: ElectionAnomalyOwnerMessageView[];
    threads?: ElectionAnomalyOwnerTriageThreadView[];
  },
): GetElectionAnomalyOwnerTriageResponse {
  const hasOpenClarification = threadOverrides?.hasOpenClarification ?? true;
  const threads = threadOverrides?.threads ?? [
    createThread({
      HasOpenClarificationRequest: hasOpenClarification,
      OpenClarificationRequestId: hasOpenClarification ? 'clarification-1' : '',
      HasOpenClarificationRequestId: hasOpenClarification,
      CaseStateId: hasOpenClarification
        ? ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION
        : ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW,
      Messages: threadOverrides?.messages ?? [createMessage()],
    }),
  ];

  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'owner-address',
    HasTriage: true,
    Triage: {
      ElectionId: 'election-127',
      TotalThreadCount: threads.length,
      OpenThreadCount: threads.length,
      AwaitingInformationThreadCount: threads.filter((thread) => thread.HasOpenClarificationRequest).length,
      ResponsePresentThreadCount: 0,
      ExternalClaimantThreadCount: threads.filter(
        (thread) => thread.CategoryId === ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
      ).length,
      DecryptableMessageCount: threads.reduce((count, thread) => count + thread.Messages.length, 0),
      PendingRewrapMessageCount: threads.filter((thread) =>
        thread.Messages.some((message) =>
          message.RecipientStatuses.some((status) =>
            status.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR &&
            status.WrapStatusId === ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.PENDING_BACKFILL,
          ),
        ),
      ).length,
      MissingOwnerWrapMessageCount: 0,
      AttachmentManifestCount: 0,
      GovernedContinuityHandoffStatusId: 'governed_path_unavailable',
      CategoryCounts: [],
      CaseStateCounts: [],
      ContinuitySummary: {
        TrusteeContinuityThreadCount: threads.filter(
          (thread) => thread.CategoryId === ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY,
        ).length,
        OpenContinuityThreadCount: threads.filter(
          (thread) => thread.CategoryId === ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY,
        ).length,
        AwaitingInformationContinuityThreadCount: threads.filter(
          (thread) =>
            thread.CategoryId === ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY &&
            thread.HasOpenClarificationRequest,
        ).length,
        ClosedContinuityThreadCount: 0,
        GovernedDecisionLinkedCount: 0,
        HasContinuityIssue: true,
      },
      Threads: threads,
    },
    ...overrides,
  };
}

function createGrantResponse(): GetElectionReportAccessGrantsResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'owner-address',
    CanManageGrants: true,
    DeniedReason: '',
    Grants: [
      {
        Id: 'grant-1',
        ElectionId: 'election-127',
        ActorPublicAddress: 'auditor-address',
        GrantRole: ElectionReportAccessGrantRoleProto.ReportAccessGrantDesignatedAuditor,
        GrantedAt: timestamp,
        GrantedByPublicAddress: 'owner-address',
      },
    ],
  };
}

function renderPanel() {
  return render(
    <OwnerAnomalyWorkspacePanel
      electionId="election-127"
      actorPublicAddress="owner-address"
      actorEncryptionPublicKey="owner-encrypt-public"
      actorEncryptionPrivateKey="owner-encrypt-private"
      actorSigningPrivateKey="owner-signing-private"
    />,
  );
}

describe('OwnerAnomalyWorkspacePanel', () => {
  beforeEach(() => {
    useElectionsStoreMock.mockReturnValue({
      isLoadingDetail: false,
      loadElection: loadElectionMock.mockResolvedValue(null),
      reset: resetMock,
      selectedElection: {
        Success: true,
        ErrorMessage: '',
        Election: createElectionRecord(
          'election-127',
          ElectionLifecycleStateProto.Draft,
          'FEAT-127 owner election',
          { OwnerPublicAddress: 'owner-address' },
        ),
        TrusteeInvitations: [],
      },
    });
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(createTriageResponse());
    electionsServiceMock.getElectionReportAccessGrants.mockResolvedValue(createGrantResponse());
    identityServiceMock.getIdentity.mockResolvedValue({
      Successfull: true,
      Message: '',
      ProfileName: 'Auditor Alice',
      PublicSigningAddress: 'auditor-address',
      PublicEncryptAddress: 'auditor-encrypt-public',
      IsPublic: true,
    });
    submitTransactionMock.mockResolvedValue({
      successful: true,
      status: TransactionStatus.ACCEPTED,
      message: 'accepted',
    });
    transactionServiceMock.decryptElectionAnomalyOwnerMessageBody.mockResolvedValue(
      'Decrypted owner anomaly body.',
    );
    transactionServiceMock.decryptElectionAnomalyOwnerMessageContentKey.mockResolvedValue(
      'message-content-key',
    );
    transactionServiceMock.createClassifyElectionAnomalyThreadTransaction.mockResolvedValue({
      signedTransaction: 'signed-classify-tx',
    });
    transactionServiceMock.createRecordElectionAnomalyAuthorityResponseTransaction.mockResolvedValue({
      signedTransaction: 'signed-response-tx',
    });
    transactionServiceMock.createRecordElectionAnomalyAuditorRecipientRewrapTransaction.mockResolvedValue({
      signedTransaction: 'signed-rewrap-tx',
    });
    transactionServiceMock.createRegisterExternalElectionAnomalyClaimantTransaction.mockResolvedValue({
      signedTransaction: 'signed-external-tx',
      anomalyThreadId: 'external-thread',
      externalClaimantReferenceHash: 'sha256:external-ref',
    });
    transactionServiceMock.createRequestElectionAnomalyInformationTransaction.mockResolvedValue({
      signedTransaction: 'signed-clarification-tx',
      clarificationRequestId: 'clarification-2',
    });
    transactionServiceMock.hashExternalElectionAnomalyClaimantReference.mockResolvedValue(
      'sha256:external-ref',
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('decrypts owner-visible messages without exposing raw ciphertext and blocks terminal state with an open clarification', async () => {
    renderPanel();

    expect(await screen.findByText('Decrypted owner anomaly body.')).toBeInTheDocument();
    expect(screen.queryByText('ciphertext-body')).not.toBeInTheDocument();
    expect(screen.getByText('Submitter: submitter-address')).toBeInTheDocument();
    expect(screen.getByText('Role context: trustee')).toBeInTheDocument();
    expect(screen.getByText('Lifecycle at submission: Draft')).toBeInTheDocument();
    expect(screen.getByText('Thread hash: sha256:thread')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Anomaly case state'), {
      target: { value: ELECTION_ANOMALY_CASE_STATE_IDS.RESOLVED_NON_BLOCKING },
    });

    expect(
      screen.getByText('Terminal classification requires the open clarification request to close first.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit classification' })).toBeDisabled();
    expect(screen.getByText(/FEAT-127 does not void the election/)).toBeInTheDocument();
  });

  it('filters the owner queue by category and operational mode', async () => {
    const availableAuditorMessage = createMessage({
      MessageId: 'message-available',
      EncryptedBodyHash: 'sha256:available-body',
      RecipientStatuses: [
        {
          RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
          WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
        },
        {
          RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR,
          WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
        },
      ],
    });
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createTriageResponse(undefined, {
        threads: [
          createThread({
            AnomalyThreadId: 'thread-continuity',
            CurrentThreadHash: 'sha256:continuity-thread',
            HasOpenClarificationRequest: true,
            OpenClarificationRequestId: 'clarification-1',
            HasOpenClarificationRequestId: true,
            CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION,
          }),
          createThread({
            AnomalyThreadId: 'thread-external',
            CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
            CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.OWNER_RESPONDED,
            CurrentThreadHash: 'sha256:external-thread',
            SubmitterRoleContextId: 'external_claimant_registrar',
            HasOpenClarificationRequest: false,
            OpenClarificationRequestId: '',
            HasOpenClarificationRequestId: false,
            Messages: [availableAuditorMessage],
          }),
          createThread({
            AnomalyThreadId: 'thread-counting',
            CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.COUNTING_OR_TALLY,
            CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW,
            CurrentThreadHash: 'sha256:counting-thread',
            HasOpenClarificationRequest: false,
            OpenClarificationRequestId: '',
            HasOpenClarificationRequestId: false,
            Messages: [availableAuditorMessage],
          }),
        ],
      }),
    );

    renderPanel();

    const triageSection = await screen.findByTestId('owner-anomaly-triage');
    expect(triageSection).toHaveTextContent('Showing 3 of 3 cases');
    expect(screen.getByText('thread-continuity')).toBeInTheDocument();
    expect(screen.getByText('thread-external')).toBeInTheDocument();
    expect(screen.getByText('thread-counting')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Queue category filter'), {
      target: { value: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT },
    });

    await waitFor(() => {
      expect(triageSection).toHaveTextContent('Showing 1 of 3 cases');
    });
    expect(screen.getByText('thread-external')).toBeInTheDocument();
    expect(screen.queryByText('thread-continuity')).not.toBeInTheDocument();
    expect(screen.queryByText('thread-counting')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting info' }));

    await waitFor(() => {
      expect(triageSection).toHaveTextContent('Showing 1 of 3 cases');
    });
    expect(screen.getByText('thread-continuity')).toBeInTheDocument();
    expect(screen.queryByText('thread-external')).not.toBeInTheDocument();
  });

  it('rewraps pending auditor recipients for the selected message', async () => {
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createTriageResponse(undefined, { hasOpenClarification: false }),
    );

    renderPanel();

    const rewrapButton = await screen.findByRole('button', {
      name: 'Rewrap message message-1 for auditors',
    });
    await waitFor(() => expect(rewrapButton).toBeEnabled());

    fireEvent.click(rewrapButton);

    await waitFor(() => {
      expect(transactionServiceMock.createRecordElectionAnomalyAuditorRecipientRewrapTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-127',
          AnomalyThreadId: 'thread-1',
          MessageId: 'message-1',
          ActorPublicAddress: 'owner-address',
          AuditorPublicAddress: 'auditor-address',
          AuditorPublicEncryptAddress: 'auditor-encrypt-public',
          ContentKey: 'message-content-key',
        }));
    });
    expect(submitTransactionMock).toHaveBeenCalledWith('signed-rewrap-tx');
    expect(await screen.findByText('Auditor rewrap accepted for 1 designated auditor.'))
      .toBeInTheDocument();
  });

  it('submits clarification requests and authority responses through signed owner transactions', async () => {
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createTriageResponse(undefined, { hasOpenClarification: false }),
    );

    renderPanel();

    await screen.findByText('Decrypted owner anomaly body.');
    fireEvent.change(screen.getByLabelText('Clarification request body'), {
      target: { value: 'Please provide a bounded clarification.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request clarification' }));

    await waitFor(() => {
      expect(transactionServiceMock.createRequestElectionAnomalyInformationTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-127',
          AnomalyThreadId: 'thread-1',
          OriginalSubmitterPublicAddress: 'submitter-address',
          Body: 'Please provide a bounded clarification.',
        }));
    });
    expect(submitTransactionMock).toHaveBeenCalledWith('signed-clarification-tx');
    expect(await screen.findByText('Clarification request accepted. The submitter can now answer one bounded response.'))
      .toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Authority response body'), {
      target: { value: 'Authority response remains anomaly evidence.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send response' }));

    await waitFor(() => {
      expect(transactionServiceMock.createRecordElectionAnomalyAuthorityResponseTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-127',
          AnomalyThreadId: 'thread-1',
          OriginalSubmitterPublicAddress: 'submitter-address',
          Body: 'Authority response remains anomaly evidence.',
        }));
    });
    expect(submitTransactionMock).toHaveBeenCalledWith('signed-response-tx');
    expect(await screen.findByText('Authority response accepted as anomaly evidence.'))
      .toBeInTheDocument();
  });

  it('submits classification and external claimant actions through signed owner transactions', async () => {
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue(
      createTriageResponse(undefined, { hasOpenClarification: false }),
    );

    renderPanel();

    await screen.findByText('Decrypted owner anomaly body.');
    fireEvent.change(screen.getByLabelText('Anomaly case state'), {
      target: { value: ELECTION_ANOMALY_CASE_STATE_IDS.OWNER_RESPONDED },
    });
    fireEvent.change(screen.getByLabelText('Governed decision reference'), {
      target: { value: 'governed-decision-42' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit classification' }));

    await waitFor(() => {
      expect(transactionServiceMock.createClassifyElectionAnomalyThreadTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-127',
          AnomalyThreadId: 'thread-1',
          CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.OWNER_RESPONDED,
          GovernedDecisionRef: 'governed-decision-42',
        }));
    });
    expect(submitTransactionMock).toHaveBeenCalledWith('signed-classify-tx');
    expect(await screen.findByText('Classification transaction accepted. Refreshing owner triage.'))
      .toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('External claimant reference'), {
      target: { value: 'local-claimant-ref' },
    });
    expect(await screen.findByText('sha256:external-ref')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('External claimant anomaly body'), {
      target: { value: 'External claimant encrypted body.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register external anomaly' }));

    await waitFor(() => {
      expect(transactionServiceMock.createRegisterExternalElectionAnomalyClaimantTransaction)
        .toHaveBeenCalledWith(expect.objectContaining({
          ElectionId: 'election-127',
          ActorPublicAddress: 'owner-address',
          ExternalClaimantReference: 'local-claimant-ref',
          Body: 'External claimant encrypted body.',
        }));
    });
    expect(submitTransactionMock).toHaveBeenCalledWith('signed-external-tx');
  });

  it('recovers duplicate external claimant submissions by refreshing triage', async () => {
    submitTransactionMock.mockResolvedValueOnce({
      successful: false,
      status: TransactionStatus.REJECTED,
      message: 'Rejected with anomaly_duplicate_thread',
    });

    renderPanel();

    await screen.findByText('Decrypted owner anomaly body.');
    fireEvent.change(screen.getByLabelText('External claimant reference'), {
      target: { value: 'duplicate-claimant-ref' },
    });
    fireEvent.change(screen.getByLabelText('External claimant anomaly body'), {
      target: { value: 'Duplicate external claimant body.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register external anomaly' }));

    expect(await screen.findByText(
      'An external claimant anomaly already exists for this reference. Triage has been refreshed.',
    )).toBeInTheDocument();
    expect(electionsServiceMock.getElectionAnomalyOwnerTriage).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('External claimant reference')).toHaveValue('');
    expect(screen.getByLabelText('External claimant anomaly body')).toHaveValue('');
  });
});

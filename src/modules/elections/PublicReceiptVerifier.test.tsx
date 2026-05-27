import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicReceiptVerifier } from './PublicReceiptVerifier';
import {
  encodeReceiptChannelPayload,
  parseReceiptExportJson,
  type ReceiptVerificationResult,
} from './receiptVerification';

vi.mock('@/stores', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      setSelectedNav: vi.fn(),
      setActiveApp: vi.fn(),
    }),
}));

const receiptJson = JSON.stringify({
  schema: 'hushvoting.receipt.export',
  schemaVersion: 1,
  receiptProof: {
    electionId: 'election-1',
    receiptCommitment: 'receipt-commitment-1',
    receiptCommitmentScheme: 'sha256(receipt_secret|prepared_ballot_hash|accepted_ballot_id)',
    preparedBallotHash: 'prepared-ballot-hash-1',
    expectedPackageId: 'HushElectionPackage-election-1',
    expectedPackageHash: `sha256:${'a'.repeat(64)}`,
    expectedVerifierProfileId: 'public_anonymous_v1',
  },
  exportEnvelope: {
    receiptGeneratedAt: '2026-05-21T10:00:00Z',
    exportedBy: 'HushVoting',
    exporterVersion: 'hush-web-client',
  },
});

function createReceiptFile(content = receiptJson): File {
  return new File([content], 'accepted-ballot.hush-receipt.json', {
    type: 'application/json',
  });
}

function createPackageFile(): File {
  return new File([new Uint8Array([80, 75, 3, 4])], 'finalized-package.zip', {
    type: 'application/zip',
  });
}

function successResult(): ReceiptVerificationResult {
  return {
    category: 'verified_included',
    warnings: [],
    issues: [],
    receipt: JSON.parse(receiptJson),
    packageIdentity: {
      packageId: 'HushElectionPackage-election-1',
      packageHash: `sha256:${'a'.repeat(64)}`,
      electionId: 'election-1',
      verifierProfileId: 'public_anonymous_v1',
    },
    matchedEvidence: {
      receiptCommitment: 'receipt-commitment-1',
      receiptCommitmentScheme: 'sha256(receipt_secret|prepared_ballot_hash|accepted_ballot_id)',
      preparedBallotHash: 'prepared-ballot-hash-1',
    },
  };
}

async function selectValidInputs(): Promise<void> {
  fireEvent.change(screen.getByTestId('receipt-verifier-receipt-input'), {
    target: { files: [createReceiptFile()] },
  });
  selectPackageInput();
  await waitFor(() => expect(screen.getByTestId('receipt-verifier-submit')).toBeEnabled());
}

function selectPackageInput(): void {
  fireEvent.change(screen.getByTestId('receipt-verifier-package-input'), {
    target: { files: [createPackageFile()] },
  });
}

describe('PublicReceiptVerifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps verification disabled until one receipt JSON and one package ZIP are selected', async () => {
    render(<PublicReceiptVerifier verifyReceipt={vi.fn()} />);

    expect(screen.getByTestId('receipt-verifier-submit')).toBeDisabled();

    fireEvent.change(screen.getByTestId('receipt-verifier-receipt-input'), {
      target: { files: [createReceiptFile()] },
    });

    await waitFor(() => {
      expect(screen.getByText('accepted-ballot.hush-receipt.json')).toBeInTheDocument();
    });
    expect(screen.getByTestId('receipt-verifier-submit')).toBeDisabled();

    fireEvent.change(screen.getByTestId('receipt-verifier-package-input'), {
      target: { files: [createPackageFile()] },
    });

    await waitFor(() => expect(screen.getByTestId('receipt-verifier-submit')).toBeEnabled());
  });

  it('runs browser-local verification and renders safe success evidence', async () => {
    const verifyReceipt = vi.fn().mockResolvedValue(successResult());
    render(<PublicReceiptVerifier verifyReceipt={verifyReceipt} />);

    await selectValidInputs();
    fireEvent.click(screen.getByTestId('receipt-verifier-submit'));

    await waitFor(() => expect(verifyReceipt).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('receipt-verifier-result-verified_included')).toHaveTextContent(
      'Receipt included',
    );
    expect(screen.getByTestId('receipt-verifier-evidence')).toHaveTextContent(
      'HushElecti...election-1',
    );
    expect(screen.getByTestId('receipt-verifier-evidence')).not.toHaveTextContent('Candidate A');
    expect(screen.getByTestId('receipt-verifier-evidence')).not.toHaveTextContent('server-proof');
  });

  it('accepts a QR-ready payload and verifies it through the same receipt JSON path', async () => {
    const verifyReceipt = vi.fn().mockResolvedValue(successResult());
    const payload = encodeReceiptChannelPayload(parseReceiptExportJson(receiptJson), 'qr_ready');
    render(<PublicReceiptVerifier verifyReceipt={verifyReceipt} />);

    fireEvent.click(screen.getByTestId('receipt-verifier-source-mode-qr_paste'));
    fireEvent.change(screen.getByTestId('receipt-verifier-payload-input'), {
      target: { value: payload },
    });
    selectPackageInput();

    await waitFor(() => expect(screen.getByTestId('receipt-verifier-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('receipt-verifier-submit'));

    await waitFor(() => expect(verifyReceipt).toHaveBeenCalledTimes(1));
    expect(JSON.parse(verifyReceipt.mock.calls[0][0].receiptJson)).toEqual(JSON.parse(receiptJson));
    expect(await screen.findByTestId('receipt-verifier-result-verified_included')).toHaveTextContent(
      'Receipt included',
    );
  });

  it('accepts a segmented manual payload and keeps the finalized package ZIP required', async () => {
    const verifyReceipt = vi.fn().mockResolvedValue(successResult());
    const payload = encodeReceiptChannelPayload(parseReceiptExportJson(receiptJson), 'manual_payload');
    const segmented = payload.match(/.{1,22}/g)?.join('\n') ?? payload;
    render(<PublicReceiptVerifier verifyReceipt={verifyReceipt} />);

    fireEvent.click(screen.getByTestId('receipt-verifier-source-mode-manual_payload'));
    fireEvent.change(screen.getByTestId('receipt-verifier-payload-input'), {
      target: { value: segmented },
    });

    await waitFor(() => expect(screen.getByText('Manual receipt payload')).toBeInTheDocument());
    expect(screen.getByTestId('receipt-verifier-submit')).toBeDisabled();

    selectPackageInput();
    await waitFor(() => expect(screen.getByTestId('receipt-verifier-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('receipt-verifier-submit'));

    await waitFor(() => expect(verifyReceipt).toHaveBeenCalledTimes(1));
  });

  it('maps malformed channel payloads to invalid_receipt when verification is requested', async () => {
    const verifyReceipt = vi.fn();
    render(<PublicReceiptVerifier verifyReceipt={verifyReceipt} />);

    fireEvent.click(screen.getByTestId('receipt-verifier-source-mode-qr_paste'));
    fireEvent.change(screen.getByTestId('receipt-verifier-payload-input'), {
      target: { value: 'HVR1.%%%%.deadbeefdeadbeef' },
    });
    selectPackageInput();

    await waitFor(() => expect(screen.getByTestId('receipt-verifier-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('receipt-verifier-submit'));

    expect(
      await screen.findByTestId('receipt-verifier-result-invalid_receipt'),
    ).toHaveTextContent('invalid_payload_encoding');
    expect(verifyReceipt).not.toHaveBeenCalled();
  });

  it('shows a warning result when inclusion is valid but not clean package-bound success', async () => {
    const warningResult: ReceiptVerificationResult = {
      ...successResult(),
      category: 'verified_included_with_warnings',
      warnings: ['receipt_not_package_bound'],
    };
    render(<PublicReceiptVerifier verifyReceipt={vi.fn().mockResolvedValue(warningResult)} />);

    await selectValidInputs();
    fireEvent.click(screen.getByTestId('receipt-verifier-submit'));

    expect(
      await screen.findByTestId('receipt-verifier-result-verified_included_with_warnings'),
    ).toHaveTextContent('Receipt included with warning');
    expect(screen.getByText('receipt_not_package_bound')).toBeInTheDocument();
  });

  it('rejects invalid file types before verification', () => {
    const verifyReceipt = vi.fn();
    render(<PublicReceiptVerifier verifyReceipt={verifyReceipt} />);

    fireEvent.change(screen.getByTestId('receipt-verifier-receipt-input'), {
      target: { files: [new File(['x'], 'receipt.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByText('Choose one .hush-receipt.json or JSON receipt file.')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-verifier-submit')).toBeDisabled();
    expect(verifyReceipt).not.toHaveBeenCalled();
  });

  it('rejects multiple receipt or package files before verification', () => {
    const verifyReceipt = vi.fn();
    render(<PublicReceiptVerifier verifyReceipt={verifyReceipt} />);

    fireEvent.change(screen.getByTestId('receipt-verifier-receipt-input'), {
      target: { files: [createReceiptFile(), createReceiptFile()] },
    });
    expect(screen.getByText('Choose exactly one receipt JSON file.')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('receipt-verifier-package-input'), {
      target: { files: [createPackageFile(), createPackageFile()] },
    });
    expect(screen.getByText('Choose exactly one finalized public package ZIP.')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-verifier-submit')).toBeDisabled();
    expect(verifyReceipt).not.toHaveBeenCalled();
  });

  it.each([
    [
      'not_found',
      'Receipt not found in this package',
      'The selected finalized package does not contain matching receipt evidence.',
      'Confirm that the package belongs to the same election and final result.',
    ],
    [
      'wrong_package',
      'Wrong finalized package',
      'The receipt package binding does not match the selected finalized package.',
      'Select the package whose id, hash, and verifier profile match the receipt.',
    ],
    [
      'invalid_receipt',
      'Receipt file is invalid',
      'The receipt schema or strict proof fields are malformed or unsupported.',
      'Export the receipt again from the Vote/Election Workspace.',
    ],
    [
      'invalid_package',
      'Package ZIP is invalid',
      'The finalized package could not be trusted before receipt inclusion was checked.',
      'Use a non-corrupted finalized public package ZIP from the expected source.',
    ],
    [
      'package_unavailable',
      'Package required',
      'A finalized public package ZIP is required for public counted-inclusion verification.',
      'Select exactly one finalized public package ZIP.',
    ],
    [
      'verification_unavailable',
      'Verification could not run',
      'This browser/runtime could not complete local receipt verification.',
      'Retry after reload or use a supported browser/runtime.',
    ],
  ] as const)('renders deterministic copy for %s', async (category, title, body, recovery) => {
    const result: ReceiptVerificationResult = {
      category,
      warnings: [],
      issues: [
        {
          family: 'runtime',
          code: `${category}_test`,
          message: 'Deterministic failure copy.',
        },
      ],
      receipt: JSON.parse(receiptJson),
    };
    render(<PublicReceiptVerifier verifyReceipt={vi.fn().mockResolvedValue(result)} />);

    await selectValidInputs();
    fireEvent.click(screen.getByTestId('receipt-verifier-submit'));

    const panel = await screen.findByTestId(`receipt-verifier-result-${category}`);
    expect(panel).toHaveTextContent(title);
    expect(panel).toHaveTextContent(body);
    expect(panel).toHaveTextContent(recovery);
    expect(panel).toHaveTextContent(`${category}_test - Deterministic failure copy.`);
  });
});

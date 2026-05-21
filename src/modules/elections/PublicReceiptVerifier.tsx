"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  FileJson,
  Info,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import {
  PACKAGE_ZIP_MAX_BYTES,
  RECEIPT_FILE_MAX_BYTES,
  hasReceiptPackageBinding,
  parseReceiptExportJson,
  verifyReceiptInPackage,
  type HushVotingReceiptExport,
  type ReceiptVerificationIssue,
  type ReceiptVerificationResult,
  type ReceiptVerificationResultCategory,
} from './receiptVerification';

type ReceiptVerifier = (input: {
  receiptJson: string;
  packageZipBytes: ArrayBuffer;
}) => ReceiptVerificationResult | Promise<ReceiptVerificationResult>;

interface PublicReceiptVerifierProps {
  verifyReceipt?: ReceiptVerifier;
}

interface ReceiptPreview {
  electionId: string;
  packageBound: boolean;
  generatedAt: string;
}

interface ResultCopy {
  title: string;
  body: string;
  recovery: string;
  tone: 'success' | 'warning' | 'error';
}

const RESULT_COPY: Record<ReceiptVerificationResultCategory, ResultCopy> = {
  verified_included: {
    title: 'Receipt included',
    body: 'This receipt is included in the finalized election evidence.',
    recovery: 'You can verify another receipt or inspect the checked evidence.',
    tone: 'success',
  },
  verified_included_with_warnings: {
    title: 'Receipt included with warning',
    body: 'The receipt matched the finalized evidence, but at least one non-blocking warning applies.',
    recovery: 'Read the warning and checked evidence before treating this as a clean package-bound result.',
    tone: 'warning',
  },
  not_found: {
    title: 'Receipt not found in this package',
    body: 'The selected finalized package does not contain matching receipt evidence.',
    recovery: 'Confirm that the package belongs to the same election and final result.',
    tone: 'error',
  },
  wrong_package: {
    title: 'Wrong finalized package',
    body: 'The receipt package binding does not match the selected finalized package.',
    recovery: 'Select the package whose id, hash, and verifier profile match the receipt.',
    tone: 'error',
  },
  invalid_receipt: {
    title: 'Receipt file is invalid',
    body: 'The receipt schema or strict proof fields are malformed or unsupported.',
    recovery: 'Export the receipt again from the Vote/Election Workspace.',
    tone: 'error',
  },
  invalid_package: {
    title: 'Package ZIP is invalid',
    body: 'The finalized package could not be trusted before receipt inclusion was checked.',
    recovery: 'Use a non-corrupted finalized public package ZIP from the expected source.',
    tone: 'error',
  },
  package_unavailable: {
    title: 'Package required',
    body: 'A finalized public package ZIP is required for public counted-inclusion verification.',
    recovery: 'Select exactly one finalized public package ZIP.',
    tone: 'error',
  },
  verification_unavailable: {
    title: 'Verification could not run',
    body: 'This browser/runtime could not complete local receipt verification.',
    recovery: 'Retry after reload or use a supported browser/runtime.',
    tone: 'error',
  },
};

const CHECK_STEPS = [
  'Receipt schema',
  'ZIP safety',
  'Manifest hashes',
  'Package binding',
  'SP-04 receipt set',
  'Accepted ballot set',
  'Receipt inclusion',
];

function defaultVerifyReceipt(input: {
  receiptJson: string;
  packageZipBytes: ArrayBuffer;
}): ReceiptVerificationResult {
  return verifyReceiptInPackage(input);
}

function isReceiptFileName(fileName: string): boolean {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith('.json') || normalized.endsWith('.hush-receipt.json');
}

function isZipFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.zip');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function truncateMiddle(value: string | undefined, keep: number = 10): string {
  if (!value) {
    return 'Not available';
  }

  if (value.length <= keep * 2 + 3) {
    return value;
  }

  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function resultToneClasses(tone: ResultCopy['tone']): {
  shell: string;
  icon: typeof ShieldCheck;
  code: string;
} {
  switch (tone) {
    case 'success':
      return {
        shell: 'bg-green-500/12 text-green-100',
        icon: ShieldCheck,
        code: 'bg-green-950/50 text-green-100',
      };
    case 'warning':
      return {
        shell: 'bg-amber-500/12 text-amber-100',
        icon: ShieldAlert,
        code: 'bg-amber-950/50 text-amber-100',
      };
    default:
      return {
        shell: 'bg-red-500/12 text-red-100',
        icon: ShieldAlert,
        code: 'bg-red-950/50 text-red-100',
      };
  }
}

function mapIssueMessage(issue: ReceiptVerificationIssue): string {
  return [issue.code, issue.path, issue.message].filter(Boolean).join(' - ');
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('Package ZIP could not be read.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}

export function PublicReceiptVerifier({
  verifyReceipt = defaultVerifyReceipt,
}: PublicReceiptVerifierProps) {
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);
  const setActiveApp = useAppStore((state) => state.setActiveApp);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(null);
  const [receiptWarning, setReceiptWarning] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [packageError, setPackageError] = useState('');
  const [result, setResult] = useState<ReceiptVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setActiveApp('voting');
    setSelectedNav('verify-receipt');
  }, [setActiveApp, setSelectedNav]);

  const canVerify = Boolean(receiptFile && packageFile && !receiptError && !packageError);
  const resultCopy = result ? RESULT_COPY[result.category] : null;
  const resultClasses = resultCopy ? resultToneClasses(resultCopy.tone) : null;
  const ResultIcon = resultClasses?.icon;

  const stepStates = useMemo(() => {
    if (isVerifying) {
      return CHECK_STEPS.map((label, index) => ({
        label,
        state: index === 0 ? 'active' : 'pending',
      }));
    }

    if (!result) {
      return CHECK_STEPS.map((label) => ({ label, state: 'pending' }));
    }

    if (result.category === 'verified_included' || result.category === 'verified_included_with_warnings') {
      return CHECK_STEPS.map((label) => ({ label, state: 'passed' }));
    }

    const failedIndex =
      result.category === 'invalid_receipt'
        ? 0
        : result.category === 'invalid_package'
          ? 2
          : result.category === 'wrong_package'
            ? 3
            : result.category === 'not_found'
              ? 6
              : 1;

    return CHECK_STEPS.map((label, index) => ({
      label,
      state: index < failedIndex ? 'passed' : index === failedIndex ? 'failed' : 'pending',
    }));
  }, [isVerifying, result]);

  async function handleReceiptSelected(fileList: FileList | null): Promise<void> {
    const file = fileList?.[0] ?? null;
    setResult(null);
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptWarning('');
    setReceiptError('');

    if (fileList && fileList.length > 1) {
      setReceiptError('Choose exactly one receipt JSON file.');
      return;
    }

    if (!file) {
      return;
    }

    if (!isReceiptFileName(file.name)) {
      setReceiptError('Choose one .hush-receipt.json or JSON receipt file.');
      return;
    }

    if (file.size > RECEIPT_FILE_MAX_BYTES) {
      setReceiptError(`Receipt file is too large. Limit is ${formatBytes(RECEIPT_FILE_MAX_BYTES)}.`);
      return;
    }

    setReceiptFile(file);
    try {
      const text = await readFileAsText(file);
      const parsed = parseReceiptExportJson(text);
      setReceiptPreview({
        electionId: parsed.receiptProof.electionId,
        packageBound: hasReceiptPackageBinding(parsed.receiptProof),
        generatedAt: parsed.exportEnvelope.receiptGeneratedAt,
      });
    } catch {
      setReceiptWarning('Receipt schema will be checked during verification.');
    }
  }

  function handlePackageSelected(fileList: FileList | null): void {
    const file = fileList?.[0] ?? null;
    setResult(null);
    setPackageFile(null);
    setPackageError('');

    if (fileList && fileList.length > 1) {
      setPackageError('Choose exactly one finalized public package ZIP.');
      return;
    }

    if (!file) {
      return;
    }

    if (!isZipFileName(file.name)) {
      setPackageError('Choose one finalized public package ZIP.');
      return;
    }

    if (file.size > PACKAGE_ZIP_MAX_BYTES) {
      setPackageError(`Package ZIP is too large. Limit is ${formatBytes(PACKAGE_ZIP_MAX_BYTES)}.`);
      return;
    }

    setPackageFile(file);
  }

  async function handleVerify(): Promise<void> {
    if (!receiptFile || !packageFile) {
      return;
    }

    setIsVerifying(true);
    setResult(null);
    try {
      const [receiptJson, packageZipBytes] = await Promise.all([
        readFileAsText(receiptFile),
        readFileAsArrayBuffer(packageFile),
      ]);
      setResult(await verifyReceipt({ receiptJson, packageZipBytes }));
    } catch (error) {
      setResult({
        category: 'verification_unavailable',
        warnings: [],
        issues: [
          {
            family: 'runtime',
            code: 'file_read_failed',
            message: error instanceof Error ? error.message : 'Verifier input could not be read.',
          },
        ],
      });
    } finally {
      setIsVerifying(false);
    }
  }

  function clearReceipt(): void {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptWarning('');
    setReceiptError('');
    setResult(null);
    if (receiptInputRef.current) {
      receiptInputRef.current.value = '';
    }
  }

  function clearPackage(): void {
    setPackageFile(null);
    setPackageError('');
    setResult(null);
    if (packageInputRef.current) {
      packageInputRef.current.value = '';
    }
  }

  function clearAll(): void {
    clearReceipt();
    clearPackage();
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-hush-bg-dark px-4 pb-8 pt-6 text-hush-text-primary md:px-6">
      <div className="flex w-full min-w-0 flex-col gap-6">
        <header className="rounded-3xl bg-hush-bg-element/90 px-6 py-5 shadow-lg shadow-black/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                No login needed
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Verify receipt</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-hush-text-accent">
                  Check one HushVoting receipt JSON against one finalized public package ZIP locally
                  in this browser. Files are not uploaded.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-bg-hover px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
              data-testid="receipt-verifier-clear"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Start over</span>
            </button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-2" aria-label="Verifier inputs">
          <FilePickerPanel
            icon={<FileJson className="h-5 w-5" />}
            title="1. Receipt JSON"
            description="Choose one .hush-receipt.json file exported from the Vote/Election Workspace."
            inputTestId="receipt-verifier-receipt-input"
            buttonLabel="Choose receipt"
            accept=".json,.hush-receipt.json,application/json"
            file={receiptFile}
            error={receiptError}
            warning={receiptWarning}
            preview={receiptPreview}
            inputRef={receiptInputRef}
            onFileSelected={(files) => void handleReceiptSelected(files)}
            onClear={clearReceipt}
          />
          <FilePickerPanel
            icon={<Archive className="h-5 w-5" />}
            title="2. Finalized package ZIP"
            description="Choose one finalized public package ZIP. Extracted folders are not accepted in v1."
            inputTestId="receipt-verifier-package-input"
            buttonLabel="Choose package ZIP"
            accept=".zip,application/zip"
            file={packageFile}
            error={packageError}
            inputRef={packageInputRef}
            onFileSelected={handlePackageSelected}
            onClear={clearPackage}
          />
        </section>

        <section className="rounded-3xl bg-hush-bg-element/90 px-6 py-5 shadow-lg shadow-black/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <h2 className="text-lg font-semibold">Local verification checks</h2>
              <p className="text-sm leading-6 text-hush-text-accent">
                The verifier checks package safety, manifest hashes, package binding, SP-04 receipt
                commitments, accepted ballot evidence, and receipt inclusion before producing a
                result.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={!canVerify || isVerifying}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="receipt-verifier-submit"
            >
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <span>{isVerifying ? 'Verifying' : 'Verify receipt'}</span>
            </button>
          </div>

          <ol className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-4" data-testid="receipt-verifier-steps">
            {stepStates.map((step) => (
              <li
                key={step.label}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
                  step.state === 'passed'
                    ? 'bg-green-500/12 text-green-100'
                    : step.state === 'failed'
                      ? 'bg-red-500/12 text-red-100'
                      : step.state === 'active'
                        ? 'bg-teal-500/12 text-teal-100'
                        : 'bg-hush-bg-dark/60 text-hush-text-accent'
                }`}
              >
                {step.state === 'passed' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : step.state === 'failed' ? (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                ) : step.state === 'active' ? (
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                ) : (
                  <Info className="h-4 w-4 flex-shrink-0" />
                )}
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </section>

        {result && resultCopy && resultClasses && ResultIcon ? (
          <section
            className={`rounded-3xl px-6 py-5 shadow-lg shadow-black/10 ${resultClasses.shell}`}
            data-testid={`receipt-verifier-result-${result.category}`}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <ResultIcon className="mt-0.5 h-6 w-6 flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-semibold">{resultCopy.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">{resultCopy.body}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${resultClasses.code}`}>
                  {result.category}
                </span>
              </div>

              {result.warnings.length > 0 ? (
                <div className="rounded-2xl bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <TriangleAlert className="h-4 w-4" />
                    <span>Warning reason</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {result.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.issues.length > 0 ? (
                <div className="rounded-2xl bg-red-950/35 px-4 py-3 text-sm text-red-100">
                  <div className="font-semibold">What happened</div>
                  <ul className="mt-2 space-y-1">
                    {result.issues.map((issue) => (
                      <li key={`${issue.code}-${issue.path ?? ''}`}>{mapIssueMessage(issue)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-2xl bg-black/20 px-4 py-3 text-sm">
                <div className="font-semibold">What to do next</div>
                <p className="mt-2 leading-6 opacity-90">{resultCopy.recovery}</p>
              </div>

              <EvidenceSummary result={result} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function FilePickerPanel({
  icon,
  title,
  description,
  inputTestId,
  buttonLabel,
  accept,
  file,
  error,
  warning,
  preview,
  inputRef,
  onFileSelected,
  onClear,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  inputTestId: string;
  buttonLabel: string;
  accept: string;
  file: File | null;
  error: string;
  warning?: string;
  preview?: ReceiptPreview | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (files: FileList | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-3xl bg-hush-bg-element/90 px-6 py-5 shadow-lg shadow-black/10">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-teal-500/12 p-3 text-teal-100">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-hush-text-accent">{description}</p>
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl px-4 py-4 ${
          error ? 'bg-red-500/12 text-red-100' : file ? 'bg-teal-500/12 text-teal-100' : 'bg-hush-bg-dark/65 text-hush-text-primary'
        }`}
      >
        {file ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-1 text-sm">
              <div className="font-semibold break-all">{file.name}</div>
              <div className="text-hush-text-accent">{formatBytes(file.size)}</div>
              {preview ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniValue label="Election" value={preview.electionId} />
                  <MiniValue label="Binding" value={preview.packageBound ? 'Package-bound' : 'Package-less'} />
                  <MiniValue label="Generated" value={preview.generatedAt} />
                </div>
              ) : null}
              {warning ? <div className="mt-2 text-amber-100">{warning}</div> : null}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
            >
              <X className="h-4 w-4" />
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-hush-text-accent">No file selected.</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-semibold text-hush-bg-dark transition-colors hover:bg-hush-purple-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
            >
              {buttonLabel}
            </button>
          </div>
        )}
        {error ? <div className="mt-3 text-sm text-red-100">{error}</div> : null}
      </div>

      <input
        ref={inputRef}
        data-testid={inputTestId}
        className="sr-only"
        type="file"
        accept={accept}
        onChange={(event) => onFileSelected(event.target.files)}
      />
    </div>
  );
}

function EvidenceSummary({ result }: { result: ReceiptVerificationResult }) {
  const receipt = result.receipt as HushVotingReceiptExport | undefined;
  return (
    <details className="rounded-2xl bg-black/20 px-4 py-3 text-sm" data-testid="receipt-verifier-evidence">
      <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple">
        Checked evidence
      </summary>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <ValueWell label="Package id" value={result.packageIdentity?.packageId} />
        <ValueWell label="Package hash" value={result.packageIdentity?.packageHash} />
        <ValueWell label="Verifier profile" value={result.packageIdentity?.verifierProfileId} />
        <ValueWell label="Receipt commitment" value={receipt?.receiptProof.receiptCommitment} />
        <ValueWell label="Prepared ballot hash" value={receipt?.receiptProof.preparedBallotHash} />
        <ValueWell label="Commitment scheme" value={receipt?.receiptProof.receiptCommitmentScheme} />
      </div>
      <div className="mt-4 rounded-2xl bg-hush-bg-dark/60 px-4 py-3 leading-6 text-hush-text-accent">
        This verifier does not display voter identity, vote choice, cast timestamp, plaintext ballot,
        randomness, receipt secret, or private audit material.
      </div>
    </details>
  );
}

function ValueWell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-hush-bg-dark/65 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-hush-text-accent">
        {label}
      </div>
      <div className="mt-2 break-all font-mono text-sm text-hush-text-primary">
        {truncateMiddle(value)}
      </div>
    </div>
  );
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{truncateMiddle(value, 7)}</div>
    </div>
  );
}

import type {
  MobileBenchmarkReport,
  MobileElectionCryptoOperationResult,
} from './contracts.ts';
import { validateMobileBenchmarkReportShape } from './contracts.ts';

export const MOBILE_BENCHMARK_FORBIDDEN_REPORT_FIELD_PATTERNS = [
  'vote_secret',
  'private_witness',
  'private_witness_data',
  'raw_trustee_material',
  'trustee_private_material',
  'raw_attestation_token',
  'raw_device_identifier',
  'device_identifier',
  'android_id',
  'advertising_id',
  'serial_number',
  'idfa',
  'idfv',
  'ip_address',
  'real_voter_data',
  'real_ballot',
  'voter_device_join',
  'voter_device_link',
  'private_key',
] as const;

export const MOBILE_BENCHMARK_FORBIDDEN_CLAIM_PHRASES = [
  'mobile ready',
  'production ready',
  'certified',
  'approved for public elections',
  'public-election ready',
  'legally validated',
  'legal approval',
  'externally audited',
  'external review complete',
  'feat-106 complete',
] as const;

export interface MobileBenchmarkPrivacyFinding {
  path: string;
  code: 'forbidden_field' | 'forbidden_value';
  pattern: string;
}

export interface MobileBenchmarkClaimFinding {
  path: string;
  phrase: string;
}

export interface MobileBenchmarkPrivacyScanResult {
  status: 'passed' | 'blocked';
  findings: MobileBenchmarkPrivacyFinding[];
}

export interface MobileBenchmarkExportValidationResult {
  exportable: boolean;
  privacy: MobileBenchmarkPrivacyScanResult;
  claimFindings: MobileBenchmarkClaimFinding[];
  shapeIssues: ReturnType<typeof validateMobileBenchmarkReportShape>;
}

const normalizedForbiddenPatterns = MOBILE_BENCHMARK_FORBIDDEN_REPORT_FIELD_PATTERNS.map(
  (pattern) => normalizeScanText(pattern)
);

function normalizeScanText(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function pathFor(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

export function scanMobileBenchmarkReportPrivacy(
  value: unknown,
  parentPath = ''
): MobileBenchmarkPrivacyScanResult {
  const findings: MobileBenchmarkPrivacyFinding[] = [];

  function visit(node: unknown, currentPath: string): void {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }

    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        const normalizedKey = normalizeScanText(key);
        const pattern = normalizedForbiddenPatterns.find((candidate) =>
          normalizedKey.includes(candidate)
        );
        const childPath = pathFor(currentPath, key);

        if (pattern) {
          findings.push({
            path: childPath,
            code: 'forbidden_field',
            pattern,
          });
        }

        visit(child, childPath);
      }
      return;
    }

    if (typeof node === 'string') {
      const normalizedValue = normalizeScanText(node);
      const pattern = normalizedForbiddenPatterns.find((candidate) =>
        normalizedValue.includes(candidate)
      );

      if (pattern) {
        findings.push({
          path: currentPath,
          code: 'forbidden_value',
          pattern,
        });
      }
    }
  }

  visit(value, parentPath);

  return {
    status: findings.length > 0 ? 'blocked' : 'passed',
    findings,
  };
}

export function findUnsupportedMobileBenchmarkClaims(
  values: Array<{ path: string; text: string }>
): MobileBenchmarkClaimFinding[] {
  return values.flatMap(({ path, text }) => {
    const normalized = text.toLowerCase();
    return MOBILE_BENCHMARK_FORBIDDEN_CLAIM_PHRASES.filter((phrase) =>
      normalized.includes(phrase)
    ).map((phrase) => ({
      path,
      phrase,
    }));
  });
}

export function validateMobileBenchmarkReportForExport(
  report: MobileBenchmarkReport
): MobileBenchmarkExportValidationResult {
  const privacy = scanMobileBenchmarkReportPrivacy(report);
  const claimFindings = findUnsupportedMobileBenchmarkClaims([
    { path: 'summary.assurancePositioning', text: report.summary.assurancePositioning },
    ...report.summary.warnings.map((warning, index) => ({
      path: `summary.warnings.${index}`,
      text: warning,
    })),
  ]);
  const shapeIssues = validateMobileBenchmarkReportShape(report);

  return {
    exportable:
      privacy.status === 'passed' && claimFindings.length === 0 && shapeIssues.length === 0,
    privacy,
    claimFindings,
    shapeIssues,
  };
}

export function assertMobileBenchmarkReportExportable(report: MobileBenchmarkReport): void {
  const validation = validateMobileBenchmarkReportForExport(report);

  if (!validation.exportable) {
    const reasons = [
      ...validation.privacy.findings.map((finding) => `${finding.code}:${finding.path}`),
      ...validation.claimFindings.map((finding) => `unsupported_claim:${finding.path}`),
      ...validation.shapeIssues.map((issue) => `${issue.code}:${issue.path}`),
    ];
    throw new Error(`Mobile benchmark report export blocked: ${reasons.join(', ')}`);
  }
}

export function sanitizeMobileElectionCryptoOperationResult<TPublicOutput extends Record<string, unknown>>(
  result: MobileElectionCryptoOperationResult<TPublicOutput>
): MobileElectionCryptoOperationResult<TPublicOutput> {
  const scan = scanMobileBenchmarkReportPrivacy(result.publicOutput, 'publicOutput');

  if (scan.status === 'blocked') {
    throw new Error(
      `MobileElectionCrypto result contains forbidden report output: ${scan.findings
        .map((finding) => finding.path)
        .join(', ')}`
    );
  }

  return result;
}

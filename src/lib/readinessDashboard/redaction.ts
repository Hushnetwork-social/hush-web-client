export interface PublicSafeSummaryRedactionResult {
  status: 'passed' | 'failed';
  warnings: string[];
}

const forbiddenPreviewPatterns: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\b\d{1,3}\s*\/\s*100\b/,
    label: 'numeric readiness score',
  },
  {
    pattern: /\bRDY-DIM-\d{3}\b/,
    label: 'dimension score identifier',
  },
  {
    pattern: /\bsha256Hash\b/i,
    label: 'private hash field',
  },
  {
    pattern: /hush-documents\/PrivateServer/i,
    label: 'private document path',
  },
  {
    pattern: /restricted-reviewer-extract/i,
    label: 'restricted reviewer artifact',
  },
  {
    pattern: /trustee share|receipt secret|key material|credential/i,
    label: 'secret-bearing wording',
  },
];

export function validatePublicSafeSummary(
  markdown: string
): PublicSafeSummaryRedactionResult {
  const warnings = forbiddenPreviewPatterns
    .filter((item) => item.pattern.test(markdown))
    .map((item) => `Public-safe preview contains ${item.label}.`);

  return {
    status: warnings.length > 0 ? 'failed' : 'passed',
    warnings,
  };
}

export function redactPublicSafeSummaryForPreview(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

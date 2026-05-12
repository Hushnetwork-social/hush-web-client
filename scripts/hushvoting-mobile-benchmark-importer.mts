import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildMobileBenchmarkAggregatorOutput,
  importMobileBenchmarkReports,
  type MobileBenchmarkImportSource,
} from '../src/lib/crypto/mobileBenchmark/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const inputDirs = readRequiredList(args.input, 'input').map((input) =>
    path.resolve(repoRoot, input)
  );
  const outputDir = path.resolve(repoRoot, readRequired(args.output, 'output'));
  const sources = await Promise.all(inputDirs.map(readLooseImportSource));
  const importResult = importMobileBenchmarkReports(sources);

  if (importResult.rejectedReports.length > 0) {
    for (const reject of importResult.rejectedReports) {
      process.stderr.write(`${reject.sourceName}: ${reject.code}: ${reject.message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const output = buildMobileBenchmarkAggregatorOutput(importResult);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'all_metrics.csv'), output.mergedCsv['all_metrics.csv'], 'utf8');
  await fs.writeFile(
    path.join(outputDir, 'all_operations.csv'),
    output.mergedCsv['all_operations.csv'],
    'utf8'
  );
  await fs.writeFile(
    path.join(outputDir, 'all_environments.csv'),
    output.mergedCsv['all_environments.csv'],
    'utf8'
  );
  await fs.writeFile(path.join(outputDir, 'comparison-summary.md'), output.comparisonSummaryMd, 'utf8');
  process.stdout.write(`Imported ${importResult.acceptedReports.length} report(s) into ${outputDir}\n`);
}

interface ParsedArgs {
  help?: boolean;
  input?: string[];
  output?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument '${token}'. Use --help for usage.`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for '--${key}'. Use --help for usage.`);
    }

    if (key === 'input') {
      parsed.input = [...(parsed.input ?? []), value];
    } else if (key === 'output') {
      parsed.output = value;
    } else {
      throw new Error(`Unexpected option '--${key}'. Use --help for usage.`);
    }
    index += 1;
  }

  return parsed;
}

function readRequired(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required --${name} value. Use --help for usage.`);
  }

  return value;
}

function readRequiredList(value: string[] | undefined, name: string): string[] {
  if (!value || value.length === 0) {
    throw new Error(`Missing required --${name} value. Use --help for usage.`);
  }

  return value;
}

async function readLooseImportSource(inputDir: string): Promise<MobileBenchmarkImportSource> {
  return {
    kind: 'loose_files',
    sourceName: inputDir,
    reportJson: await fs.readFile(path.join(inputDir, 'report.json'), 'utf8'),
    metricsCsv: await readOptionalFile(path.join(inputDir, 'metrics.csv')),
    operationsCsv: await readOptionalFile(path.join(inputDir, 'operations.csv')),
    environmentCsv: await readOptionalFile(path.join(inputDir, 'environment.csv')),
  };
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return undefined;
    }

    throw error;
  }
}

function printHelp(): void {
  process.stdout.write(`Usage:
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/hushvoting-mobile-benchmark-importer.mts --input <report-dir> [--input <report-dir> ...] --output <summary-dir>

Reads local loose FEAT-121 files from each <report-dir>:
  report.json
  metrics.csv optional
  operations.csv optional
  environment.csv optional

Writes local aggregate files to <summary-dir>:
  all_metrics.csv
  all_operations.csv
  all_environments.csv
  comparison-summary.md
`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

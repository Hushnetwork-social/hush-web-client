import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FEAT107_PROOF_PROFILES,
  buildControlledElectionFixturePack,
  type ControlledElectionFixtureOptions,
  type ElectionDecodeTier,
  type ElectionProofProfile,
} from '../src/lib/crypto/elections/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const options: ControlledElectionFixtureOptions = {
    seed: parseRequiredBigInt(args.seed, 'seed'),
    choiceIndex: parseRequiredNumber(args.choice, 'choice'),
    profile: parseProfile(args.profile),
    decodeTier: parseTier(args.tier),
    encryptionNonceSeed: parseOptionalBigInt(args.encryptionNonceSeed),
    rerandomizationNonceSeed: parseOptionalBigInt(args.rerandomizationNonceSeed),
    selectionCount: parseOptionalNumber(args.selectionCount),
    fixtureVersion: parseOptionalString(args.fixtureVersion),
  };

  const fixtureJson = JSON.stringify(buildControlledElectionFixturePack(options), null, 2);

  if (args.output) {
    const outputPath = path.resolve(__dirname, '..', args.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, fixtureJson + '\n', 'utf8');
    process.stdout.write(`Wrote FEAT-107 election fixture to ${outputPath}\n`);
    return;
  }

  process.stdout.write(fixtureJson + '\n');
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index++) {
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

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function parseProfile(value: string | boolean | undefined): ElectionProofProfile | undefined {
  if (!value) {
    return undefined;
  }

  if (value !== FEAT107_PROOF_PROFILES.DEV_SMOKE_PROFILE && value !== FEAT107_PROOF_PROFILES.PRODUCTION_LIKE_PROFILE) {
    throw new Error(`Unsupported profile '${value}'.`);
  }

  return value;
}

function parseTier(value: string | boolean | undefined): ElectionDecodeTier | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value !== 'DEV_SMOKE_TIER' &&
    value !== 'CLUB_ROLLOUT_TIER' &&
    value !== 'UPPER_SUPPORTED_TIER'
  ) {
    throw new Error(`Unsupported decode tier '${value}'.`);
  }

  return value;
}

function parseRequiredBigInt(value: string | boolean | undefined, label: string): bigint {
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required '--${label}' argument.`);
  }

  return BigInt(value);
}

function parseOptionalBigInt(value: string | boolean | undefined): bigint | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  return BigInt(value);
}

function parseRequiredNumber(value: string | boolean | undefined, label: string): number {
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required '--${label}' argument.`);
  }

  return Number.parseInt(value, 10);
}

function parseOptionalNumber(value: string | boolean | undefined): number | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  return Number.parseInt(value, 10);
}

function parseOptionalString(value: string | boolean | undefined): string | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  return value;
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: npm run fixture:election -- [options]',
      '',
      'Required:',
      '  --seed <bigint>               Deterministic election key seed',
      '  --choice <number>             One-hot selected option index',
      '',
      'Optional:',
      `  --profile <name>              ${FEAT107_PROOF_PROFILES.DEV_SMOKE_PROFILE} | ${FEAT107_PROOF_PROFILES.PRODUCTION_LIKE_PROFILE}`,
      '  --tier <name>                 DEV_SMOKE_TIER | CLUB_ROLLOUT_TIER | UPPER_SUPPORTED_TIER',
      '  --selectionCount <number>     Override slot count (default: 6)',
      '  --encryptionNonceSeed <bigint>',
      '  --rerandomizationNonceSeed <bigint>',
      '  --fixtureVersion <version>    Override fixture version policy tag',
      '  --output <path>               Write JSON to a file instead of stdout',
      '  --help                        Show this message',
      '',
      'Example:',
      '  npm run fixture:election -- --seed 17 --choice 2 --profile PRODUCTION_LIKE_PROFILE --tier CLUB_ROLLOUT_TIER --output .tmp/feat107-fixture.json',
      '',
    ].join('\n')
  );
}

await main();

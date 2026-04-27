/**
 * Replay Producer CLI (WP-063 / EC-071).
 *
 * Wraps @legendary-arena/game-engine's buildSnapshotSequence with file I/O
 * to emit deterministic ReplaySnapshotSequence JSON. Strictly I/O + arg
 * parsing + canonical serialization — no gameplay logic, no registry
 * imports at runtime, no boardgame.io imports.
 *
 * Determinism contract: with --produced-at fixed to a constant ISO
 * timestamp, two runs against the same input file produce byte-identical
 * output. Top-level JSON keys are sorted alphabetically per D-6302; nested
 * objects inherit engine-produced key order (no recursive sort).
 */

import process from 'node:process';

// why: enable sourcemaps before any other executable statement so uncaught
// crashes anywhere below this point produce stack traces that point at the
// TypeScript source rather than compiled/bundled JS. Chosen over an
// NODE_OPTIONS=--enable-source-maps prefix in package.json scripts because
// the prefix form requires cross-env on Windows, which would be a new
// forbidden dependency under the session's §Non-Negotiable Constraints.
process.setSourceMapsEnabled(true);

import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildSnapshotSequence } from '@legendary-arena/game-engine';
import type {
  ReplayInputsFile,
  ReplaySnapshotSequence,
  CardRegistryReader,
  ReplayMove,
  MatchSetupConfig,
} from '@legendary-arena/game-engine';

// why: exit codes are declared as named constants so process.exit() calls
// carry no magic numbers and every stderr message can cite the same
// documented code. 0 success / 1 invalid args (missing --in, unknown flag,
// malformed flag value) / 2 input parse error (unreadable, invalid JSON,
// version !== 1, shape check failed) / 3 engine error (Game.setup() threw
// for the provided MatchSetupConfig) / 4 output write error (unwritable
// path, permission denied, disk full). No other codes — extensions require
// a D-entry.
const EXIT_OK = 0;
const EXIT_INVALID_ARGS = 1;
const EXIT_INPUT_PARSE = 2;
const EXIT_ENGINE = 3;
const EXIT_OUTPUT_WRITE = 4;

/**
 * Minimal card registry reader used at runtime.
 *
 * Buildouts for real card data happen at setup-time inside Game.setup() in
 * apps/server/; the producer CLI ships the empty-list reader because
 * deterministic sample fixtures do not require registry resolution. See
 * D-6305 for the rationale (no registry import at runtime; mirror
 * replay.execute.test.ts precedent).
 *
 * @amended WP-113 PS-3: widened to satisfy the new CardRegistryReader
 *   shape (`listCards` + `listSets` + `getSet`); produces the same
 *   empty-state behaviour at runtime — no real data is loaded
 *   (per D-10014).
 */
const minimalRegistry: CardRegistryReader = {
  listCards: () => [],
  listSets: () => [],
  getSet: () => undefined,
};

/**
 * Lightweight shape check for a parsed JSON object claiming to be a
 * ReplayInputsFile. Returns a discriminated union — success value typed
 * as ReplayInputsFile, failure carries a full-sentence error message.
 *
 * @param parsed - The JSON.parse result of the input file.
 * @returns Either the typed ReplayInputsFile or an error message.
 */
function validateReplayInputsFile(
  parsed: unknown,
): { ok: true; value: ReplayInputsFile } | { ok: false; message: string } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      message:
        'Input file must be a JSON object at the top level; received array or non-object value.',
    };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) {
    return {
      ok: false,
      message: `Input file field "version" must be the literal 1; received ${JSON.stringify(obj.version)}.`,
    };
  }
  if (
    obj.setupConfig === null ||
    typeof obj.setupConfig !== 'object' ||
    Array.isArray(obj.setupConfig)
  ) {
    return {
      ok: false,
      message:
        'Input file field "setupConfig" must be an object matching the MatchSetupConfig shape.',
    };
  }
  if (typeof obj.seed !== 'string') {
    return {
      ok: false,
      message: 'Input file field "seed" must be a string.',
    };
  }
  if (!Array.isArray(obj.playerOrder)) {
    return {
      ok: false,
      message:
        'Input file field "playerOrder" must be an array of player ID strings.',
    };
  }
  for (const playerId of obj.playerOrder) {
    if (typeof playerId !== 'string') {
      return {
        ok: false,
        message:
          'Input file field "playerOrder" must contain string values only.',
      };
    }
  }
  if (!Array.isArray(obj.moves)) {
    return {
      ok: false,
      message:
        'Input file field "moves" must be an array of ReplayMove records.',
    };
  }
  for (const move of obj.moves) {
    if (
      move === null ||
      typeof move !== 'object' ||
      typeof (move as Record<string, unknown>).moveName !== 'string' ||
      typeof (move as Record<string, unknown>).playerId !== 'string'
    ) {
      return {
        ok: false,
        message:
          'Input file "moves" entries must each be an object with string "moveName" and string "playerId".',
      };
    }
  }
  return {
    ok: true,
    value: obj as unknown as ReplayInputsFile,
  };
}

/**
 * Builds the output metadata object from flags + input-file metadata +
 * Date.now() fallback. Honors the D-6303 omission rule — sub-fields are
 * only set when a defined source provides a value.
 */
function buildOutputMetadata(
  values: {
    'match-id'?: string | undefined;
    'produced-at'?: string | undefined;
  },
  inputsFile: ReplayInputsFile,
): ReplaySnapshotSequence['metadata'] {
  const metadata: {
    matchId?: string;
    seed?: string;
    producedAt?: string;
  } = {};
  const matchIdFlag = values['match-id'];
  const matchIdFromFile = inputsFile.metadata?.matchId;
  if (matchIdFlag !== undefined) {
    metadata.matchId = matchIdFlag;
  } else if (matchIdFromFile !== undefined) {
    metadata.matchId = matchIdFromFile;
  }
  metadata.seed = inputsFile.seed;
  // why: --produced-at override is the deterministic path; without it the
  // Date.now() fallback embeds wall-clock drift into the output and breaks
  // byte-level determinism tests (AC + Verification Step 5). Determinism
  // tests MUST pass --produced-at.
  const producedAtFlag = values['produced-at'];
  if (producedAtFlag !== undefined) {
    metadata.producedAt = producedAtFlag;
  } else {
    metadata.producedAt = new Date().toISOString();
  }
  return metadata;
}

/**
 * Serializes a ReplaySnapshotSequence as JSON with top-level keys sorted
 * alphabetically. Nested objects inherit engine-produced key order per
 * D-6302 — the engine's purity is the nested-key determinism source, so a
 * recursive sort would add no guarantee and would obscure real nested-key
 * drift if it ever appears.
 */
function serializeWithSortedTopLevel(sequence: ReplaySnapshotSequence): string {
  // why: projecting the sequence through a new object with keys inserted in
  // sorted order works because JSON.stringify enumerates keys in insertion
  // order. The original sequence is frozen upstream; we do not mutate it.
  const sortedKeys = Object.keys(sequence).sort();
  const projected: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    projected[key] = (sequence as unknown as Record<string, unknown>)[key];
  }
  return JSON.stringify(projected);
}

/**
 * Emits a one-line stderr summary when DEBUG env var is set to
 * replay-producer or *. Never writes to stdout.
 */
function emitDebugSummary(
  values: { in?: string | undefined; out?: string | undefined },
  inputsFile: ReplayInputsFile,
  sequence: ReplaySnapshotSequence,
  serialized: string,
): void {
  const debug = process.env.DEBUG;
  if (debug !== 'replay-producer' && debug !== '*') {
    return;
  }
  const inLabel = values.in ?? '<missing>';
  const outLabel = values.out ?? '<stdout>';
  const inputCount = inputsFile.moves.length;
  const snapshotCount = sequence.snapshots.length;
  const byteCount = Buffer.byteLength(serialized, 'utf8');
  process.stderr.write(
    `[replay-producer] input=${inLabel} inputs=${inputCount} snapshots=${snapshotCount} out=${outLabel} bytes=${byteCount}\n`,
  );
}

/**
 * Main CLI entrypoint. Returns the desired process exit code.
 *
 * @returns A numeric exit code per the documented table.
 */
export async function main(argv: readonly string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: {
        in: { type: 'string' },
        out: { type: 'string' },
        'match-id': { type: 'string' },
        'produced-at': { type: 'string' },
      },
      allowPositionals: false,
      strict: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Failed to parse CLI arguments: ${message} (exit code 1).\n`,
    );
    return EXIT_INVALID_ARGS;
  }

  const values = parsed.values as {
    in?: string;
    out?: string;
    'match-id'?: string;
    'produced-at'?: string;
  };

  if (values.in === undefined) {
    process.stderr.write(
      'Missing required --in flag; supply a path to a ReplayInputsFile JSON (exit code 1).\n',
    );
    return EXIT_INVALID_ARGS;
  }

  let raw: string;
  try {
    raw = await readFile(values.in, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Failed to read input file "${values.in}": ${message} (exit code 2).\n`,
    );
    return EXIT_INPUT_PARSE;
  }

  let jsonValue: unknown;
  try {
    jsonValue = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Failed to parse input JSON at "${values.in}": ${message} (exit code 2).\n`,
    );
    return EXIT_INPUT_PARSE;
  }

  const validation = validateReplayInputsFile(jsonValue);
  if (!validation.ok) {
    process.stderr.write(`${validation.message} (exit code 2).\n`);
    return EXIT_INPUT_PARSE;
  }
  const inputsFile = validation.value;

  let sequence: ReplaySnapshotSequence;
  try {
    const outputMetadata = buildOutputMetadata(values, inputsFile);
    const baseParams = {
      setupConfig: inputsFile.setupConfig as MatchSetupConfig,
      seed: inputsFile.seed,
      playerOrder: inputsFile.playerOrder,
      moves: inputsFile.moves as readonly ReplayMove[],
      registry: minimalRegistry,
    };
    sequence =
      outputMetadata !== undefined
        ? buildSnapshotSequence({ ...baseParams, metadata: outputMetadata })
        : buildSnapshotSequence(baseParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `Engine error during snapshot construction: ${message} (exit code 3).\n`,
    );
    return EXIT_ENGINE;
  }

  const serialized = serializeWithSortedTopLevel(sequence);

  if (values.out !== undefined) {
    try {
      await writeFile(values.out, serialized, 'utf8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `Failed to write output file "${values.out}": ${message} (exit code 4).\n`,
      );
      return EXIT_OUTPUT_WRITE;
    }
  } else {
    process.stdout.write(serialized);
  }

  emitDebugSummary(values, inputsFile, sequence, serialized);
  return EXIT_OK;
}

// why: the auto-run block fires only when this module is the process entry
// (node --import tsx src/cli.ts ...). When cli.test.ts imports { main } for
// unit tests, process.argv[1] ends with the test file path — not cli.ts —
// so the check is false and main() does not run as a side-effect of import.
// The forward-slash normalization is required because Windows paths use
// backslashes but the endsWith check expects a uniform separator.
const entryPath = (process.argv[1] ?? '').replace(/\\/g, '/');
const isDirectEntry =
  entryPath.endsWith('/cli.ts') || entryPath.endsWith('/cli.js');
if (isDirectEntry) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (err) => {
      const message =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
      process.stderr.write(
        `Unhandled failure in replay-producer CLI: ${message} (exit code 3).\n`,
      );
      process.exit(EXIT_ENGINE);
    },
  );
}

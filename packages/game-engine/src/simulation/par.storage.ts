/**
 * PAR artifact storage and indexing (WP-050).
 *
 * Persists PAR baselines as immutable JSON artifacts under a versioned,
 * per-source-class directory layout. Two source classes — `seed` (content
 * authored) and `simulation` (WP-049 `ParSimulationResult`) — version
 * independently and are combined at read time by the cross-class resolver.
 *
 * This is the trust substrate the pre-release PAR gate (WP-051) and public
 * leaderboards (WP-054) depend on: every artifact is content-addressed by
 * ScenarioKey, hashed with SHA-256 for tamper detection, and locked against
 * overwrite at the write layer. The index is an atomic-write manifest that
 * answers "does PAR exist for this scenario?" without loading full artifact
 * bodies.
 *
 * // why: D-5001 simulation IO carve-out — filesystem IO is permitted in
 * this file and its `.test.ts` peer only. Every other simulation file remains
 * IO-free per D-3601. The carve-out boundary is grep-enforced in WP-050
 * verification steps and 01.6 post-mortem audit #6.
 *
 * Pure TypeScript using Node built-ins only: `node:fs/promises` for async
 * IO, `node:path` for POSIX-normalized path construction, and `node:crypto`
 * for SHA-256 hashing. No boardgame.io. No registry. No external crypto.
 * No synchronous filesystem APIs in production code.
 */

import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { posix } from 'node:path';

import type {
  ParBaseline,
  ScenarioKey,
  ScenarioScoringConfig,
} from '../scoring/parScoring.types.js';

import { computeParScore } from '../scoring/parScoring.logic.js';
import { AI_POLICY_TIER_DEFINITIONS } from './ai.tiers.js';
import type { ParSimulationResult } from './par.aggregator.js';

// ---------------------------------------------------------------------------
// Canonical source-class taxonomy
// ---------------------------------------------------------------------------

/**
 * Canonical source class for a PAR artifact.
 *
 * - `'seed'`: content-authored Phase 1 baseline. Hand-maintained per
 *   scenario. Required until a `simulation` artifact exists for the same
 *   `ScenarioKey`.
 * - `'simulation'`: Phase 2 calibrated output from WP-049
 *   `generateScenarioPar`. Supersedes the seed artifact at resolve time
 *   once present.
 */
export type ParArtifactSource = 'seed' | 'simulation';

/**
 * Canonical readonly array of every ParArtifactSource member.
 *
 * Drift-pinned against the union via a drift-detection test (see
 * par.storage.test.ts test #6). Adding a new source class requires updating
 * BOTH the union and this array in the same commit.
 */
// why: the enum is fixed — no third source exists in this packet. Phase 3
// post-release refinement (if/when introduced) lands as a new WP with its
// own source-class identifier and canonical array entry.
export const PAR_ARTIFACT_SOURCES: readonly ParArtifactSource[] = [
  'seed',
  'simulation',
] as const;

// why: the raw-score formula generation is pinned at 1 until a future WP
// deliberately bumps it. Stored inside each simulation artifact so that
// leaderboard entries can be filtered to a semantically compatible set
// after any future formula change.
const CURRENT_RAW_SCORE_SEMANTICS_VERSION = 1;

// ---------------------------------------------------------------------------
// Artifact shapes
// ---------------------------------------------------------------------------

/**
 * Content-authored PAR artifact (Phase 1 seed baseline).
 *
 * Every field is load-bearing. Any change to field names or shape requires
 * a new seed version directory and a matching DECISIONS entry. Must survive
 * JSON.parse(JSON.stringify(artifact)) with structural equality (D-4806
 * precedent).
 */
export interface SeedParArtifact {
  readonly scenarioKey: ScenarioKey;
  readonly source: 'seed';
  readonly parBaseline: ParBaseline;
  readonly parValue: number;
  readonly scoring: {
    readonly scoringConfigVersion: number;
    readonly rawScoreSemanticsVersion: number;
  };
  readonly authoredAt: string;
  readonly authoredBy: string;
  readonly rationale: string;
  readonly artifactHash: string;
}

/**
 * Simulation-calibrated PAR artifact (Phase 2 WP-049 output).
 *
 * Mirrors the fields of `ParSimulationResult` that are load-bearing for
 * publication plus the policy-tier guard. `simulation.policyTier` is locked
 * to the literal `'T2'` — artifacts with any other tier are not publishable
 * and are rejected at write time.
 */
export interface SimulationParArtifact {
  readonly scenarioKey: ScenarioKey;
  readonly source: 'simulation';
  readonly parValue: number;
  readonly percentileUsed: number;
  readonly sampleSize: number;
  readonly generatedAt: string;
  readonly simulation: {
    readonly policyTier: 'T2';
    readonly policyVersion: string;
    readonly seedSetHash: string;
  };
  readonly scoring: {
    readonly scoringConfigVersion: number;
    readonly rawScoreSemanticsVersion: number;
  };
  readonly artifactHash: string;
}

/**
 * Discriminated union of every PAR artifact shape. Consumers narrow via the
 * `source` field.
 */
export type ParArtifact = SeedParArtifact | SimulationParArtifact;

/**
 * Per-class × per-version index manifest.
 *
 * `scenarios` keys are sorted alphabetically on write (determinism contract).
 * `source` at the top is redundant with the directory path but is required
 * and validated so that moving an index file into the wrong class root is
 * detected as a structural error rather than silent cross-class corruption.
 */
export interface ParIndex {
  readonly parVersion: string;
  readonly source: ParArtifactSource;
  readonly generatedAt: string;
  readonly scenarioCount: number;
  readonly scenarios: Readonly<Record<ScenarioKey, {
    readonly path: string;
    readonly parValue: number;
    readonly artifactHash: string;
  }>>;
}

/**
 * Result of a cross-class PAR resolution.
 *
 * Produced by `resolveParForScenario`. Carries the winning source class
 * (sim takes precedence when both classes cover the scenario), the effective
 * PAR value, and the paths to both the artifact file and the index file
 * that resolved it — enough for callers to load the full artifact if
 * needed without re-deriving the path.
 */
export interface ParResolution {
  readonly source: ParArtifactSource;
  readonly parValue: number;
  readonly path: string;
  readonly indexPath: string;
}

/** Descriptor for a single PAR store (one source class × one version). */
export interface ParStorageConfig {
  readonly basePath: string;
  readonly source: ParArtifactSource;
  readonly parVersion: string;
}

/** One structured failure detected by `validateParStore`. */
export interface ParStoreValidationError {
  readonly scenarioKey: ScenarioKey;
  readonly errorType: string;
  readonly message: string;
}

/** Aggregated result returned by `validateParStore`. */
export interface ParStoreValidationResult {
  readonly isValid: boolean;
  readonly source: ParArtifactSource;
  readonly scenariosChecked: number;
  readonly errors: readonly ParStoreValidationError[];
}

/** Cross-class coverage report returned by `validateParStoreCoverage`. */
export interface ParCoverageResult {
  readonly expectedCount: number;
  readonly bothCount: number;
  readonly simulationOnlyCount: number;
  readonly seedOnlyCount: number;
  readonly missingCount: number;
  readonly missing: readonly ScenarioKey[];
  readonly seedOnly: readonly ScenarioKey[];
}

/**
 * Thrown by readers on malformed, truncated, or hash-mismatched index /
 * artifact content. Distinct from plain "file not found" (expressed by a
 * `null` return) so callers can distinguish missing coverage from store
 * corruption.
 *
 * Error messages are full sentences per code-style Rule 11.
 */
export class ParStoreReadError extends Error {
  readonly name = 'ParStoreReadError';

  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (NOT exported)
// ---------------------------------------------------------------------------

/**
 * Recursively clone a value with object keys sorted lexicographically.
 *
 * Array element order is preserved; object key order is fully sorted at
 * every level. Non-object values (strings, numbers, booleans, null) are
 * returned as-is. Produces structural equality with the input under
 * JSON.parse(JSON.stringify(...)).
 */
function sortObjectKeysRecursive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    const sortedArray: unknown[] = [];
    for (const element of value) {
      sortedArray.push(sortObjectKeysRecursive(element));
    }
    return sortedArray;
  }
  const asRecord = value as Record<string, unknown>;
  const sortedKeys = Object.keys(asRecord).sort();
  const sortedObject: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObject[key] = sortObjectKeysRecursive(asRecord[key]);
  }
  return sortedObject;
}

/**
 * Canonical JSON serializer. Keys sorted lexicographically at every level;
 * no whitespace; no trailing commas. The correctness contract of the entire
 * storage layer — two artifacts with identical data produce identical bytes
 * regardless of insertion order.
 */
function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeysRecursive(value));
}

/** Idempotent mkdir -p wrapper. Silent on already-exists. */
async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

/** True when the path exists and is accessible; false on ENOENT. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (accessError) {
    if (isFileNotFoundError(accessError)) {
      return false;
    }
    throw accessError;
  }
}

/** Returns true when an error is a Node ENOENT "file not found" failure. */
function isFileNotFoundError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const withCode = error as { code?: unknown };
  return withCode.code === 'ENOENT';
}

/** Returns a shallow-cloned object with the `artifactHash` key removed. */
function stripArtifactHashField(
  artifact: Record<string, unknown>,
): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(artifact)) {
    if (key !== 'artifactHash') {
      stripped[key] = nestedValue;
    }
  }
  return stripped;
}

/**
 * Builds a fully-populated `SimulationParArtifact` (minus `artifactHash`)
 * from a `ParSimulationResult`. Asserts the WP-049 T2 guard by consulting
 * `AI_POLICY_TIER_DEFINITIONS` and refusing any policy version whose tier
 * is not T2.
 */
function buildSimulationArtifactFromResult(
  result: ParSimulationResult,
): Omit<SimulationParArtifact, 'artifactHash'> {
  // why: AI_POLICY_TIER_DEFINITIONS pins T2 as the only publishable tier;
  // the writer rejects non-T2 inputs at the earliest boundary so that no
  // non-publishable artifact ever reaches disk.
  const publishableTierDefinition = AI_POLICY_TIER_DEFINITIONS.find(
    (definition) => definition.usedForPar === true,
  );
  if (publishableTierDefinition === undefined || publishableTierDefinition.tier !== 'T2') {
    throw new Error(
      'writeSimulationParArtifact cannot determine the publishable AI policy tier: AI_POLICY_TIER_DEFINITIONS has no entry with usedForPar === true mapped to T2. Check the WP-049 contract for drift.',
    );
  }
  return {
    scenarioKey: result.scenarioKey,
    source: 'simulation',
    parValue: result.parValue,
    percentileUsed: result.percentileUsed,
    sampleSize: result.sampleSize,
    generatedAt: result.generatedAt,
    simulation: {
      policyTier: 'T2',
      policyVersion: result.simulationPolicyVersion,
      seedSetHash: result.seedSetHash,
    },
    scoring: {
      scoringConfigVersion: result.scoringConfigVersion,
      rawScoreSemanticsVersion: CURRENT_RAW_SCORE_SEMANTICS_VERSION,
    },
  };
}

/**
 * Substitutes the artifact's `parBaseline` into the caller-supplied scoring
 * config and runs `computeParScore` to derive the expected `parValue`. Used
 * by `writeSeedParArtifact` for the consistency guard.
 */
function computeExpectedSeedParValue(
  parBaseline: ParBaseline,
  scoringConfig: ScenarioScoringConfig,
): number {
  const configWithBaseline: ScenarioScoringConfig = {
    ...scoringConfig,
    parBaseline,
  };
  return computeParScore(configWithBaseline);
}

// ---------------------------------------------------------------------------
// Path helpers (exported)
// ---------------------------------------------------------------------------

/**
 * Converts a `ScenarioKey` to a filesystem-safe filename.
 *
 * Replaces `::` with `--` and `+` with `_`, then appends `.json`. Reversible
 * only via knowledge of the scheme — do not attempt to round-trip via string
 * transforms alone; the index is the authoritative key-to-path mapping.
 */
// why: ScenarioKey uses :: and + which are valid in the key format but
// problematic on some filesystems (Windows treats `:` specially; `+` is
// reserved in URL-encoded query strings). Mapping to filesystem-safe
// characters preserves portability across local disk, R2/S3, and CDN.
export function scenarioKeyToFilename(scenarioKey: ScenarioKey): string {
  return `${scenarioKey.replace(/::/g, '--').replace(/\+/g, '_')}.json`;
}

/**
 * Extracts the shard directory name for a `ScenarioKey` — the first two
 * characters of the scheme slug (the component before the first `::`).
 */
// why: sharding by scheme-slug prefix prevents single-directory bloat at
// 10k–100k scenarios. Deterministic (no hash-based sharding) keeps the
// layout content-addressable and auditable by hand.
export function scenarioKeyToShard(scenarioKey: ScenarioKey): string {
  const delimiterIndex = scenarioKey.indexOf('::');
  const schemeSlug = delimiterIndex === -1
    ? scenarioKey
    : scenarioKey.slice(0, delimiterIndex);
  return schemeSlug.slice(0, 2);
}

/**
 * Returns the directory for a given source class × version:
 * `{basePath}/{seed|sim}/{parVersion}`. The only place `seed` and `sim`
 * directory names are constructed — callers that need these roots must
 * route through this helper.
 */
// why: one helper keeps the seed/ vs sim/ directory name locked; avoids
// typos like simulation/ or seeded/ creeping in. No other function may
// concatenate these strings — the single choke-point is the enforcement.
export function sourceClassRoot(
  basePath: string,
  source: ParArtifactSource,
  parVersion: string,
): string {
  const directoryName = source === 'seed' ? 'seed' : 'sim';
  return posix.join(basePath, directoryName, parVersion);
}

// ---------------------------------------------------------------------------
// Hashing (exported)
// ---------------------------------------------------------------------------

/**
 * Computes the tamper-detection hash for an artifact.
 *
 * Output format: `sha256:{64-char-hex}`. The hash is computed over the
 * canonical JSON of the artifact with the `artifactHash` field removed —
 * after hashing, the caller embeds the returned string into the artifact
 * and serializes the full (with-hash) form to disk.
 *
 * Pure function. No IO. Identical rule across both source classes.
 */
// why: SHA-256 via node:crypto is a Node built-in — NOT an external crypto
// library. D-3601's "no crypto libraries in simulation" was scoped to
// seed-set hashing where djb2 sufficed. Tamper detection is a distinct
// concern; node:crypto carries no package.json impact. External crypto
// libraries (crypto-js, sha.js, etc.) remain forbidden.
// why: self-hash exclusion avoids circular dependency — without it, the
// hash would depend on its own previous value and every write would
// invalidate the prior hash.
export function computeArtifactHash(artifact: Record<string, unknown>): string {
  const withoutHashField = stripArtifactHashField(artifact);
  const canonical = canonicalJsonStringify(withoutHashField);
  const hashHex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hashHex}`;
}

// ---------------------------------------------------------------------------
// Simulation artifact writers / readers (exported)
// ---------------------------------------------------------------------------

/**
 * Writes a simulation PAR artifact to disk under
 * `{basePath}/sim/{parVersion}/scenarios/{shard}/{filename}.json`.
 *
 * Refuses to overwrite an existing artifact file — throws a full-sentence
 * `Error` naming the path and citing the immutability rule. Computes the
 * `artifactHash` from the caller's `ParSimulationResult` and embeds it in
 * the persisted artifact. Serializes with canonical sorted-key JSON for
 * byte-identical reproducibility across runs and machines.
 *
 * Forbidden behaviors:
 * - Silently overwriting an existing file
 * - Trusting a caller-supplied hash
 * - Using a synchronous filesystem API
 * - Accepting a `ParSimulationResult` whose policy tier is not T2
 *
 * @returns Relative path of the written file under `basePath`.
 */
// why: overwrite refusal enforces immutability at the write layer, not just
// as a convention — catches both accidental and intentional violations
// before they hit disk.
export async function writeSimulationParArtifact(
  result: ParSimulationResult,
  basePath: string,
  parVersion: string,
): Promise<string> {
  const artifactWithoutHash = buildSimulationArtifactFromResult(result);
  const artifactHash = computeArtifactHash(
    artifactWithoutHash as unknown as Record<string, unknown>,
  );
  const artifact: SimulationParArtifact = { ...artifactWithoutHash, artifactHash };

  const shard = scenarioKeyToShard(result.scenarioKey);
  const filename = scenarioKeyToFilename(result.scenarioKey);
  const classRoot = sourceClassRoot(basePath, 'simulation', parVersion);
  const scenarioDirectory = posix.join(classRoot, 'scenarios', shard);
  const fullPath = posix.join(scenarioDirectory, filename);

  if (await fileExists(fullPath)) {
    throw new Error(
      `writeSimulationParArtifact refused to overwrite existing artifact at ${fullPath}. PAR artifacts are immutable once written; create a new version directory instead of overwriting.`,
    );
  }

  await ensureDirectoryExists(scenarioDirectory);
  // why: sorted keys ensure bit-for-bit reproducibility across runs and
  // machines. Default JSON.stringify preserves insertion order, which is
  // non-deterministic across code paths.
  const serialized = canonicalJsonStringify(artifact);
  await writeFile(fullPath, serialized, 'utf8');

  return posix.join('sim', parVersion, 'scenarios', shard, filename);
}

/**
 * Reads a simulation PAR artifact by `ScenarioKey`. Returns `null` when the
 * file does not exist. Throws `ParStoreReadError` on malformed JSON or
 * structural shape violations.
 */
export async function readSimulationParArtifact(
  scenarioKey: ScenarioKey,
  basePath: string,
  parVersion: string,
): Promise<SimulationParArtifact | null> {
  const shard = scenarioKeyToShard(scenarioKey);
  const filename = scenarioKeyToFilename(scenarioKey);
  const fullPath = posix.join(
    sourceClassRoot(basePath, 'simulation', parVersion),
    'scenarios',
    shard,
    filename,
  );
  const raw = await tryReadFile(fullPath);
  if (raw === null) {
    return null;
  }
  const parsed = parseJsonOrThrow(raw, fullPath);
  if (!isSimulationArtifactShape(parsed)) {
    throw new ParStoreReadError(
      `Simulation PAR artifact at ${fullPath} is missing required fields or has an unexpected shape; file may be truncated or from a different artifact version.`,
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Seed artifact writers / readers (exported)
// ---------------------------------------------------------------------------

/**
 * Writes a seed PAR artifact to disk under
 * `{basePath}/seed/{parVersion}/scenarios/{shard}/{filename}.json`.
 *
 * Refuses to overwrite. Always computes the `artifactHash` from the caller's
 * artifact (any value in `artifact.artifactHash` is ignored — writers never
 * trust caller-supplied hashes). Validates that the stored `parValue`
 * equals `computeParScore` applied to the caller's `scoringConfig` with the
 * artifact's `parBaseline` substituted — drift between the two is a
 * publication-blocking error and throws before any disk write.
 *
 * Forbidden behaviors:
 * - Silently overwriting an existing file
 * - Trusting a caller-supplied hash
 * - Using a synchronous filesystem API
 * - Accepting an artifact whose `parValue` disagrees with its baseline
 *
 * @returns Relative path of the written file under `basePath`.
 */
// why: the four-parameter signature (including `scoringConfig`) is required
// so the writer can run the consistency check at write time by calling
// `computeParScore` against a config constructed from the caller's
// `parBaseline`. Without the parameter, the writer cannot validate the
// stored `parValue` against its baseline.
// why: writer always computes the hash — caller-supplied hashes are ignored
// to prevent drift between baseline and hash. Hashes are authoritative only
// when the writer owned their derivation.
export async function writeSeedParArtifact(
  artifact: SeedParArtifact,
  scoringConfig: ScenarioScoringConfig,
  basePath: string,
  parVersion: string,
): Promise<string> {
  const expectedParValue = computeExpectedSeedParValue(
    artifact.parBaseline,
    scoringConfig,
  );
  if (artifact.parValue !== expectedParValue) {
    throw new Error(
      `writeSeedParArtifact refused to write artifact for scenario ${artifact.scenarioKey}: stored parValue ${artifact.parValue} does not equal computeParScore(${expectedParValue}) applied to the supplied scoringConfig with the artifact's parBaseline. Recompute the parValue from the baseline before writing.`,
    );
  }

  const withoutHash: Omit<SeedParArtifact, 'artifactHash'> = {
    scenarioKey: artifact.scenarioKey,
    source: 'seed',
    parBaseline: artifact.parBaseline,
    parValue: artifact.parValue,
    scoring: artifact.scoring,
    authoredAt: artifact.authoredAt,
    authoredBy: artifact.authoredBy,
    rationale: artifact.rationale,
  };
  const artifactHash = computeArtifactHash(
    withoutHash as unknown as Record<string, unknown>,
  );
  const finalArtifact: SeedParArtifact = { ...withoutHash, artifactHash };

  const shard = scenarioKeyToShard(artifact.scenarioKey);
  const filename = scenarioKeyToFilename(artifact.scenarioKey);
  const classRoot = sourceClassRoot(basePath, 'seed', parVersion);
  const scenarioDirectory = posix.join(classRoot, 'scenarios', shard);
  const fullPath = posix.join(scenarioDirectory, filename);

  if (await fileExists(fullPath)) {
    throw new Error(
      `writeSeedParArtifact refused to overwrite existing artifact at ${fullPath}. PAR artifacts are immutable once written; create a new version directory instead of overwriting.`,
    );
  }

  await ensureDirectoryExists(scenarioDirectory);
  const serialized = canonicalJsonStringify(finalArtifact);
  await writeFile(fullPath, serialized, 'utf8');

  return posix.join('seed', parVersion, 'scenarios', shard, filename);
}

/**
 * Reads a seed PAR artifact by `ScenarioKey`. Returns `null` when the file
 * does not exist. Throws `ParStoreReadError` on malformed JSON or shape
 * violations.
 */
export async function readSeedParArtifact(
  scenarioKey: ScenarioKey,
  basePath: string,
  parVersion: string,
): Promise<SeedParArtifact | null> {
  const shard = scenarioKeyToShard(scenarioKey);
  const filename = scenarioKeyToFilename(scenarioKey);
  const fullPath = posix.join(
    sourceClassRoot(basePath, 'seed', parVersion),
    'scenarios',
    shard,
    filename,
  );
  const raw = await tryReadFile(fullPath);
  if (raw === null) {
    return null;
  }
  const parsed = parseJsonOrThrow(raw, fullPath);
  if (!isSeedArtifactShape(parsed)) {
    throw new ParStoreReadError(
      `Seed PAR artifact at ${fullPath} is missing required fields or has an unexpected shape; file may be truncated or from a different artifact version.`,
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Index building and lookup (exported)
// ---------------------------------------------------------------------------

/**
 * Builds and atomically writes the index manifest for a single source
 * class × version. Scans `{class-root}/scenarios/**\/*.json`, extracts the
 * per-artifact `parValue` and `artifactHash`, sorts the resulting map keys
 * alphabetically, and writes the manifest to `{class-root}/index.json` via
 * temp-file + `rename` for atomicity.
 *
 * Forbidden behaviors:
 * - Writing the index non-atomically (temp + rename is mandatory)
 * - Omitting the top-level `source` stamp
 * - Unsorted `scenarios` keys
 */
// why: atomic write (temp-file + rename) prevents partial index reads
// during concurrent regeneration. A reader that catches an index mid-write
// would otherwise see truncated JSON.
// why: indices are NOT immutable artifacts — they regenerate whenever the
// artifact set changes. Only individual artifact files are write-once.
export async function buildParIndex(
  basePath: string,
  source: ParArtifactSource,
  parVersion: string,
): Promise<ParIndex> {
  const classRoot = sourceClassRoot(basePath, source, parVersion);
  const scenariosRoot = posix.join(classRoot, 'scenarios');
  const artifactFiles = await collectArtifactFiles(scenariosRoot);

  const scenarios: Record<string, { path: string; parValue: number; artifactHash: string }> = {};
  for (const artifactFile of artifactFiles) {
    const raw = await readFile(artifactFile.fullPath, 'utf8');
    const parsed = parseJsonOrThrow(raw, artifactFile.fullPath);
    if (!isArtifactWithCommonFields(parsed)) {
      throw new ParStoreReadError(
        `PAR artifact at ${artifactFile.fullPath} is missing required fields (scenarioKey, parValue, or artifactHash) and cannot be indexed.`,
      );
    }
    const entryPath = posix.join(artifactFile.shard, artifactFile.filename);
    scenarios[parsed.scenarioKey] = {
      path: entryPath,
      parValue: parsed.parValue,
      artifactHash: parsed.artifactHash,
    };
  }

  const sortedKeys = Object.keys(scenarios).sort();
  const sortedScenarios: Record<string, { path: string; parValue: number; artifactHash: string }> = {};
  for (const key of sortedKeys) {
    sortedScenarios[key] = scenarios[key]!;
  }

  const index: ParIndex = {
    parVersion,
    source,
    generatedAt: new Date().toISOString(),
    scenarioCount: sortedKeys.length,
    scenarios: sortedScenarios,
  };

  await ensureDirectoryExists(classRoot);
  const indexPath = posix.join(classRoot, 'index.json');
  const tempPath = `${indexPath}.tmp`;
  await writeFile(tempPath, canonicalJsonStringify(index), 'utf8');
  await rename(tempPath, indexPath);

  return index;
}

/**
 * Checks if a single index contains the given `ScenarioKey`. Returns the
 * entry's path and parValue without loading the full artifact, or `null`
 * when the key is not present in this index. Class-agnostic callers use
 * `resolveParForScenario` instead.
 */
export function lookupParFromIndex(
  index: ParIndex,
  scenarioKey: ScenarioKey,
): { path: string; parValue: number } | null {
  const entry = index.scenarios[scenarioKey];
  if (entry === undefined) {
    return null;
  }
  return { path: entry.path, parValue: entry.parValue };
}

/**
 * Loads the persisted `index.json` for a single `(source, parVersion)` pair.
 * Returns the parsed `ParIndex` on success, `null` when the index file does
 * not exist, and throws `ParStoreReadError` when the file exists but is
 * malformed, truncated, or carries a `source` field that disagrees with the
 * directory it was read from.
 *
 * This is the startup-time primitive for consumers that need an in-memory
 * index they can query many times per process without hitting the filesystem
 * per lookup — the server PAR gate (WP-051) loads both source classes at
 * startup via this helper, then calls `lookupParFromIndex` per gate check.
 * Consumers that need on-demand cross-class precedence should use
 * `resolveParForScenario` instead.
 *
 * Pure IO wrapper — never writes, never repairs, never recomputes the index
 * by scanning the scenarios directory. Use `buildParIndex` for rebuild
 * workflows.
 */
// why: public export of the load-once-check-many primitive keeps the engine
// as the single authority on ParIndex shape validation and source-class
// stamp enforcement. Without this export, server-layer consumers would have
// to reimplement shape validation (drift risk) or consume the per-call
// resolveParForScenario (which performs filesystem IO on every gate check,
// incompatible with the non-blocking-startup pattern locked in EC-051).
// Honors D-5001 "server consumes PAR through the engine API, not raw
// node:fs" by providing a fs-free public surface for startup loading.
export async function loadParIndex(
  basePath: string,
  parVersion: string,
  source: ParArtifactSource,
): Promise<ParIndex | null> {
  const indexPath = posix.join(
    sourceClassRoot(basePath, source, parVersion),
    'index.json',
  );
  return tryLoadIndex(indexPath, source);
}

// ---------------------------------------------------------------------------
// Cross-class resolver (exported)
// ---------------------------------------------------------------------------

/**
 * Returns the effective PAR for a `ScenarioKey`, applying the
 * simulation-over-seed precedence rule. Loads the simulation index first;
 * if it covers the scenario, that entry wins. Otherwise loads the seed
 * index. Missing index files are treated as "class has no coverage" — the
 * resolver proceeds to the next class without raising. Truncated or
 * malformed indices throw `ParStoreReadError` — never silently fall through.
 *
 * The ONLY sanctioned cross-class reader — callers must not encode their
 * own precedence via parallel readers.
 *
 * Forbidden behaviors:
 * - Accepting a caller-supplied `preferSource` override
 * - Silently falling through on malformed indices
 * - Probing artifact files directly (the index is the oracle)
 */
// why: preferring simulation over seed matches the three-phase PAR
// derivation pipeline — seed gives day-one coverage; simulation supersedes
// it once calibrated. Both are preserved on disk so historical leaderboard
// entries pinned to the seed-era scoringConfigVersion remain explainable.
// why: no silent fall-through on malformed indices — truncated or
// hash-mismatched indices throw ParStoreReadError to surface store
// corruption loudly. Silent tolerance would let a corrupted sim index
// degrade the store to seed-only without any operator signal.
export async function resolveParForScenario(
  scenarioKey: ScenarioKey,
  basePath: string,
  parVersion: string,
): Promise<ParResolution | null> {
  const simulationIndexPath = posix.join(
    sourceClassRoot(basePath, 'simulation', parVersion),
    'index.json',
  );
  const simulationIndex = await tryLoadIndex(simulationIndexPath, 'simulation');
  if (simulationIndex !== null) {
    const entry = simulationIndex.scenarios[scenarioKey];
    if (entry !== undefined) {
      return {
        source: 'simulation',
        parValue: entry.parValue,
        path: entry.path,
        indexPath: simulationIndexPath,
      };
    }
  }

  const seedIndexPath = posix.join(
    sourceClassRoot(basePath, 'seed', parVersion),
    'index.json',
  );
  const seedIndex = await tryLoadIndex(seedIndexPath, 'seed');
  if (seedIndex !== null) {
    const entry = seedIndex.scenarios[scenarioKey];
    if (entry !== undefined) {
      return {
        source: 'seed',
        parValue: entry.parValue,
        path: entry.path,
        indexPath: seedIndexPath,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Store validators (exported)
// ---------------------------------------------------------------------------

/**
 * Read-only validator for a single PAR store (one source class × one
 * version). Walks the on-disk scenarios directory and the persisted index
 * and reports every inconsistency — missing entries, parValue mismatches,
 * hash mismatches, filename-scenarioKey mismatches, cross-class `source`
 * drift, policy-tier violations for simulation, and malformed baseline
 * fields for seed. Never silently repairs data.
 *
 * Runs only at tooling / CI time; NEVER called at server runtime.
 */
// why: silent repair would undermine the trust surface. A validator that
// fixes a broken store on read would mask drift that needs human
// adjudication. Read-only is the contract.
export async function validateParStore(
  basePath: string,
  source: ParArtifactSource,
  parVersion: string,
): Promise<ParStoreValidationResult> {
  const errors: ParStoreValidationError[] = [];
  const classRoot = sourceClassRoot(basePath, source, parVersion);
  const scenariosRoot = posix.join(classRoot, 'scenarios');
  const indexPath = posix.join(classRoot, 'index.json');

  const indexPresent = await fileExists(indexPath);
  let persistedIndex: ParIndex | null = null;
  if (indexPresent) {
    try {
      persistedIndex = await tryLoadIndex(indexPath, source);
    } catch (loadError) {
      errors.push({
        scenarioKey: '',
        errorType: 'index-malformed',
        message: loadError instanceof Error
          ? loadError.message
          : 'Unknown error while loading the PAR index.',
      });
    }
  } else {
    errors.push({
      scenarioKey: '',
      errorType: 'index-missing',
      message: `Expected PAR index at ${indexPath} but no file was found. Build the index via buildParIndex before validating.`,
    });
  }

  const artifactFiles = await collectArtifactFiles(scenariosRoot);
  const scenariosChecked = artifactFiles.length;
  const seenScenarioKeys = new Set<ScenarioKey>();

  for (const artifactFile of artifactFiles) {
    const raw = await readFile(artifactFile.fullPath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      errors.push({
        scenarioKey: '',
        errorType: 'artifact-malformed-json',
        message: `PAR artifact at ${artifactFile.fullPath} contains malformed JSON and cannot be parsed.`,
      });
      continue;
    }

    if (!isArtifactWithCommonFields(parsed)) {
      errors.push({
        scenarioKey: '',
        errorType: 'artifact-shape-invalid',
        message: `PAR artifact at ${artifactFile.fullPath} is missing required fields (scenarioKey, parValue, source, or artifactHash).`,
      });
      continue;
    }

    const scenarioKey = parsed.scenarioKey;

    if (seenScenarioKeys.has(scenarioKey)) {
      errors.push({
        scenarioKey,
        errorType: 'duplicate-scenario-key',
        message: `Duplicate ScenarioKey ${scenarioKey} found across multiple artifact files under ${scenariosRoot}.`,
      });
    }
    seenScenarioKeys.add(scenarioKey);

    const expectedFilename = scenarioKeyToFilename(scenarioKey);
    if (expectedFilename !== artifactFile.filename) {
      errors.push({
        scenarioKey,
        errorType: 'filename-scenario-key-mismatch',
        message: `Artifact filename ${artifactFile.filename} does not match the ScenarioKey ${scenarioKey}; expected ${expectedFilename}.`,
      });
    }

    if (parsed.source !== source) {
      errors.push({
        scenarioKey,
        errorType: 'source-class-mismatch',
        message: `Artifact at ${artifactFile.fullPath} carries source "${parsed.source}" but lives under the ${source} class root. Cross-class corruption blocks publication.`,
      });
    }

    const recomputedHash = computeArtifactHash(
      parsed as unknown as Record<string, unknown>,
    );
    if (recomputedHash !== parsed.artifactHash) {
      errors.push({
        scenarioKey,
        errorType: 'artifact-hash-mismatch',
        message: `Artifact at ${artifactFile.fullPath} has artifactHash ${parsed.artifactHash} but its content hashes to ${recomputedHash}; the file may have been edited after write.`,
      });
    }

    if (persistedIndex !== null) {
      const indexEntry = persistedIndex.scenarios[scenarioKey];
      if (indexEntry === undefined) {
        errors.push({
          scenarioKey,
          errorType: 'missing-in-index',
          message: `Artifact ${scenarioKey} exists on disk but is absent from the persisted index at ${indexPath}. Rebuild the index before publishing.`,
        });
      } else {
        if (indexEntry.parValue !== parsed.parValue) {
          errors.push({
            scenarioKey,
            errorType: 'index-par-value-mismatch',
            message: `Index parValue ${indexEntry.parValue} does not match artifact parValue ${parsed.parValue} for scenario ${scenarioKey}.`,
          });
        }
        if (indexEntry.artifactHash !== parsed.artifactHash) {
          errors.push({
            scenarioKey,
            errorType: 'index-hash-mismatch',
            message: `Index artifactHash does not match artifact artifactHash for scenario ${scenarioKey}; store may have been tampered with.`,
          });
        }
      }
    }

    if (source === 'simulation' && isSimulationArtifactShape(parsed)) {
      if (parsed.simulation.policyTier !== 'T2') {
        errors.push({
          scenarioKey,
          errorType: 'non-t2-policy-tier',
          message: `Simulation artifact ${scenarioKey} has policyTier "${parsed.simulation.policyTier}"; only T2 artifacts are publishable.`,
        });
      }
    }

    if (source === 'seed' && isSeedArtifactShape(parsed)) {
      const baselineFields: readonly (keyof ParBaseline)[] = [
        'roundsPar',
        'bystandersPar',
        'victoryPointsPar',
        'escapesPar',
      ];
      for (const field of baselineFields) {
        const fieldValue = parsed.parBaseline[field];
        if (!Number.isInteger(fieldValue) || fieldValue < 0) {
          errors.push({
            scenarioKey,
            errorType: 'seed-baseline-invalid',
            message: `Seed artifact ${scenarioKey} has parBaseline.${field} = ${fieldValue}; all four baseline fields must be non-negative integers.`,
          });
        }
      }
    }
  }

  if (persistedIndex !== null) {
    for (const scenarioKey of Object.keys(persistedIndex.scenarios)) {
      if (!seenScenarioKeys.has(scenarioKey)) {
        errors.push({
          scenarioKey,
          errorType: 'missing-on-disk',
          message: `Index entry ${scenarioKey} points to an artifact file that does not exist under ${scenariosRoot}.`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    source,
    scenariosChecked,
    errors,
  };
}

/**
 * Cross-class coverage report. For each expected `ScenarioKey`, determines
 * which classes carry an artifact and flags keys with neither — those are
 * publication-blocking gaps that the pre-release gate (WP-051) consumes as
 * a single oracle.
 */
// why: one call answers "do we have PAR for every scenario we plan to
// ship?" so the pre-release gate has a single oracle rather than two
// parallel class probes that could drift.
export async function validateParStoreCoverage(
  basePath: string,
  parVersion: string,
  expectedScenarios: readonly ScenarioKey[],
): Promise<ParCoverageResult> {
  const simulationIndexPath = posix.join(
    sourceClassRoot(basePath, 'simulation', parVersion),
    'index.json',
  );
  const seedIndexPath = posix.join(
    sourceClassRoot(basePath, 'seed', parVersion),
    'index.json',
  );
  const simulationIndex = await tryLoadIndex(simulationIndexPath, 'simulation');
  const seedIndex = await tryLoadIndex(seedIndexPath, 'seed');

  const simulationKeys = new Set<ScenarioKey>(
    simulationIndex === null ? [] : Object.keys(simulationIndex.scenarios),
  );
  const seedKeys = new Set<ScenarioKey>(
    seedIndex === null ? [] : Object.keys(seedIndex.scenarios),
  );

  const missing: ScenarioKey[] = [];
  const seedOnly: ScenarioKey[] = [];
  let bothCount = 0;
  let simulationOnlyCount = 0;

  for (const scenarioKey of expectedScenarios) {
    const hasSimulation = simulationKeys.has(scenarioKey);
    const hasSeed = seedKeys.has(scenarioKey);
    if (hasSimulation && hasSeed) {
      bothCount += 1;
      continue;
    }
    if (hasSimulation) {
      simulationOnlyCount += 1;
      continue;
    }
    if (hasSeed) {
      seedOnly.push(scenarioKey);
      continue;
    }
    missing.push(scenarioKey);
  }

  return {
    expectedCount: expectedScenarios.length,
    bothCount,
    simulationOnlyCount,
    seedOnlyCount: seedOnly.length,
    missingCount: missing.length,
    missing,
    seedOnly,
  };
}

// ---------------------------------------------------------------------------
// Low-level IO helpers (internal)
// ---------------------------------------------------------------------------

/** Reads a file; returns `null` on ENOENT; rethrows other errors. */
async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (readError) {
    if (isFileNotFoundError(readError)) {
      return null;
    }
    throw readError;
  }
}

/** Parses JSON text or throws a `ParStoreReadError` naming the file. */
function parseJsonOrThrow(text: string, filePath: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ParStoreReadError(
      `PAR file at ${filePath} contains malformed JSON and cannot be parsed.`,
    );
  }
}

/**
 * Loads and structurally validates a `ParIndex` file. Returns `null` on
 * file-not-found (the caller treats this as "class has no coverage").
 * Throws `ParStoreReadError` on malformed JSON or shape violations.
 */
async function tryLoadIndex(
  indexPath: string,
  expectedSource: ParArtifactSource,
): Promise<ParIndex | null> {
  const raw = await tryReadFile(indexPath);
  if (raw === null) {
    return null;
  }
  const parsed = parseJsonOrThrow(raw, indexPath);
  if (!isParIndexShape(parsed)) {
    throw new ParStoreReadError(
      `PAR index at ${indexPath} is malformed or missing required fields; the file may be truncated or from a different index version.`,
    );
  }
  if (parsed.source !== expectedSource) {
    throw new ParStoreReadError(
      `PAR index at ${indexPath} carries source "${parsed.source}" but lives under the ${expectedSource} class root; cross-class corruption detected.`,
    );
  }
  return parsed;
}

/**
 * Recursively collects every `.json` file under `{scenariosRoot}/{shard}/`.
 * Returns an empty array when the scenarios root does not exist. Results
 * are sorted by shard then filename for deterministic iteration.
 */
async function collectArtifactFiles(
  scenariosRoot: string,
): Promise<readonly { fullPath: string; shard: string; filename: string }[]> {
  let shardEntries: string[];
  try {
    shardEntries = await readdir(scenariosRoot);
  } catch (readdirError) {
    if (isFileNotFoundError(readdirError)) {
      return [];
    }
    throw readdirError;
  }
  const files: { fullPath: string; shard: string; filename: string }[] = [];
  const sortedShards = [...shardEntries].sort();
  for (const shard of sortedShards) {
    const shardPath = posix.join(scenariosRoot, shard);
    let shardFiles: string[];
    try {
      shardFiles = await readdir(shardPath);
    } catch (shardError) {
      if (isFileNotFoundError(shardError)) {
        continue;
      }
      throw shardError;
    }
    const sortedFilenames = [...shardFiles].sort();
    for (const filename of sortedFilenames) {
      if (!filename.endsWith('.json')) {
        continue;
      }
      files.push({
        fullPath: posix.join(shardPath, filename),
        shard,
        filename,
      });
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Structural type guards (internal)
// ---------------------------------------------------------------------------

function isArtifactWithCommonFields(value: unknown): value is {
  scenarioKey: ScenarioKey;
  source: ParArtifactSource;
  parValue: number;
  artifactHash: string;
} & Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.scenarioKey === 'string'
    && (record.source === 'seed' || record.source === 'simulation')
    && typeof record.parValue === 'number'
    && typeof record.artifactHash === 'string'
  );
}

function isSimulationArtifactShape(value: unknown): value is SimulationParArtifact {
  if (!isArtifactWithCommonFields(value) || value.source !== 'simulation') {
    return false;
  }
  const record = value as unknown as Record<string, unknown>;
  if (typeof record.percentileUsed !== 'number') return false;
  if (typeof record.sampleSize !== 'number') return false;
  if (typeof record.generatedAt !== 'string') return false;
  const simulation = record.simulation;
  if (simulation === null || typeof simulation !== 'object') return false;
  const simRecord = simulation as Record<string, unknown>;
  if (typeof simRecord.policyTier !== 'string') return false;
  if (typeof simRecord.policyVersion !== 'string') return false;
  if (typeof simRecord.seedSetHash !== 'string') return false;
  const scoring = record.scoring;
  if (scoring === null || typeof scoring !== 'object') return false;
  const scoringRecord = scoring as Record<string, unknown>;
  if (typeof scoringRecord.scoringConfigVersion !== 'number') return false;
  if (typeof scoringRecord.rawScoreSemanticsVersion !== 'number') return false;
  return true;
}

function isSeedArtifactShape(value: unknown): value is SeedParArtifact {
  if (!isArtifactWithCommonFields(value) || value.source !== 'seed') {
    return false;
  }
  const record = value as unknown as Record<string, unknown>;
  if (typeof record.authoredAt !== 'string') return false;
  if (typeof record.authoredBy !== 'string') return false;
  if (typeof record.rationale !== 'string') return false;
  const baseline = record.parBaseline;
  if (baseline === null || typeof baseline !== 'object') return false;
  const baselineRecord = baseline as Record<string, unknown>;
  if (typeof baselineRecord.roundsPar !== 'number') return false;
  if (typeof baselineRecord.bystandersPar !== 'number') return false;
  if (typeof baselineRecord.victoryPointsPar !== 'number') return false;
  if (typeof baselineRecord.escapesPar !== 'number') return false;
  const scoring = record.scoring;
  if (scoring === null || typeof scoring !== 'object') return false;
  const scoringRecord = scoring as Record<string, unknown>;
  if (typeof scoringRecord.scoringConfigVersion !== 'number') return false;
  if (typeof scoringRecord.rawScoreSemanticsVersion !== 'number') return false;
  return true;
}

function isParIndexShape(value: unknown): value is ParIndex {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.parVersion !== 'string') return false;
  if (record.source !== 'seed' && record.source !== 'simulation') return false;
  if (typeof record.generatedAt !== 'string') return false;
  if (typeof record.scenarioCount !== 'number') return false;
  if (record.scenarios === null || typeof record.scenarios !== 'object') return false;
  const scenarios = record.scenarios as Record<string, unknown>;
  for (const entry of Object.values(scenarios)) {
    if (entry === null || typeof entry !== 'object') return false;
    const entryRecord = entry as Record<string, unknown>;
    if (typeof entryRecord.path !== 'string') return false;
    if (typeof entryRecord.parValue !== 'number') return false;
    if (typeof entryRecord.artifactHash !== 'string') return false;
  }
  return true;
}

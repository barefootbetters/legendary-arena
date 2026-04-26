/**
 * Tests for the PAR artifact storage and indexing layer (WP-050).
 *
 * Exactly thirty-five tests inside one describe block, per WP-050 §D +
 * EC-050 §Test count lock (34 original + 1 A1-amendment drift test
 * asserting `loadParIndex` is exported for WP-051; see DECISIONS D-5101
 * rationale). Tests cover:
 *   - Path helpers (scenarioKeyToFilename, scenarioKeyToShard,
 *     sourceClassRoot, PAR_ARTIFACT_SOURCES drift)
 *   - Simulation artifact I/O (write placement, deterministic byte-identity,
 *     overwrite refusal, read round-trip, null-on-missing, source-field
 *     verbatim)
 *   - Seed artifact I/O (write placement, writer-embedded hash, overwrite
 *     refusal, parValue/parBaseline consistency rejection, read round-trip,
 *     null-on-missing, parBaseline round-trip)
 *   - Index building and lookup (per-class independence, sorted keys,
 *     artifactHash presence, hit/miss lookups)
 *   - Public `loadParIndex` startup-time primitive (null-on-missing,
 *     source-stamp validation) — back-fill for WP-051 gate consumer
 *   - Cross-class resolver (sim-only, seed-only, both-precedence, neither,
 *     malformed-index throws)
 *   - Store validation (valid sim store, non-T2 flag, cross-class source
 *     mismatch, coverage reporter)
 *   - Hashing (canonicalization + any-field-change)
 *
 * No boardgame.io imports. Uses mkdtemp + rm for per-test isolation. Every
 * filesystem-touching test cleans up its temp directory before exiting.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { posix, join } from 'node:path';

import type {
  ParBaseline,
  ScenarioScoringConfig,
} from '../scoring/parScoring.types.js';
import { computeParScore } from '../scoring/parScoring.logic.js';
import type { ParSimulationResult } from './par.aggregator.js';

import {
  PAR_ARTIFACT_SOURCES,
  ParStoreReadError,
  buildParIndex,
  computeArtifactHash,
  loadParIndex,
  lookupParFromIndex,
  readSeedParArtifact,
  readSimulationParArtifact,
  resolveParForScenario,
  scenarioKeyToFilename,
  scenarioKeyToShard,
  sourceClassRoot,
  validateParStore,
  validateParStoreCoverage,
  writeSeedParArtifact,
  writeSimulationParArtifact,
  type ParArtifactSource,
  type SeedParArtifact,
  type SimulationParArtifact,
} from './par.storage.js';

const PAR_VERSION = 'v1';

function createTempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'par-storage-'));
}

async function removeWorkspace(workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true });
}

function createTestParBaseline(): ParBaseline {
  return {
    roundsPar: 5,
    bystandersPar: 3,
    victoryPointsPar: 10,
    escapesPar: 1,
  };
}

// why: weights satisfy validateScoringConfig's structural invariants
// (WP-048): bystanderReward > villainEscaped; bystanderLost > villainEscaped;
// bystanderLost > bystanderReward. Pre-WP-053a these tests never ran the
// embedded config through the validator; the WP-053a validator extension
// (Step 5) now does, so the factory must produce a structurally valid
// config. penaltyEventWeights values are positive to satisfy the per-key
// presence + positivity checks.
function createTestScoringConfig(
  scenarioKey: string,
  parBaseline: ParBaseline,
): ScenarioScoringConfig {
  return {
    scenarioKey,
    weights: {
      roundCost: 100,
      bystanderReward: 400,
      victoryPointReward: 10,
    },
    caps: {
      bystanderCap: null,
      victoryPointCap: null,
    },
    penaltyEventWeights: {
      villainEscaped: 300,
      bystanderLost: 500,
      schemeTwistNegative: 50,
      mastermindTacticUntaken: 25,
      scenarioSpecificPenalty: 40,
    },
    parBaseline,
    scoringConfigVersion: 1,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
  };
}

function createSeedArtifact(
  scenarioKey: string,
  parBaseline: ParBaseline,
  scoringConfig: ScenarioScoringConfig,
): SeedParArtifact {
  const parValue = computeParScore(scoringConfig);
  return {
    scenarioKey,
    source: 'seed',
    parBaseline,
    parValue,
    scoring: {
      scoringConfigVersion: scoringConfig.scoringConfigVersion,
      rawScoreSemanticsVersion: 1,
    },
    authoredAt: '2026-04-23T10:00:00.000Z',
    authoredBy: 'test-author',
    rationale: 'Hand-authored seed baseline for WP-050 testing.',
    artifactHash: '',
  };
}

/**
 * Returns a ScenarioScoringConfig matching the given simulation result's
 * scoringConfigVersion (always 1 in test fixtures). The scenarioKey on the
 * config matches the result's scenarioKey for traceability; validateParStore
 * does not require this equality but it keeps test fixtures self-consistent.
 *
 * Centralizing this factory keeps the WP-053a four-arg writer call shape
 * `writeSimulationParArtifact(result, scoringConfig, workspace, PAR_VERSION)`
 * uniform across every simulation test in this file.
 */
function buildSimScoringConfig(result: ParSimulationResult): ScenarioScoringConfig {
  return createTestScoringConfig(result.scenarioKey, createTestParBaseline());
}

function createSimulationResult(scenarioKey: string): ParSimulationResult {
  return {
    scenarioKey,
    parValue: 5500,
    percentileUsed: 55,
    sampleSize: 500,
    seedSetHash: 'djb2:abcdef1234567890',
    rawScoreDistribution: {
      min: 1000,
      p25: 3000,
      median: 4500,
      p55: 5500,
      p75: 7000,
      max: 12000,
      standardDeviation: 1200,
      interquartileRange: 4000,
    },
    needsMoreSamples: false,
    seedParDelta: 100,
    simulationPolicyVersion: 'CompetentHeuristic/v1',
    scoringConfigVersion: 1,
    generatedAt: '2026-04-23T12:00:00.000Z',
  };
}

describe('PAR artifact storage (WP-050)', () => {
  test('scenarioKeyToFilename replaces :: with -- and + with _', () => {
    const scenarioKey = 'midtown-bank-robbery::red-skull::hydra+masters-of-evil';
    const filename = scenarioKeyToFilename(scenarioKey);
    assert.equal(
      filename,
      'midtown-bank-robbery--red-skull--hydra_masters-of-evil.json',
    );
  });

  test('scenarioKeyToFilename is deterministic (same key = same filename)', () => {
    const scenarioKey = 'alpha-scheme::magneto::brotherhood+sentinels';
    const first = scenarioKeyToFilename(scenarioKey);
    const second = scenarioKeyToFilename(scenarioKey);
    assert.equal(first, second);
  });

  test('scenarioKeyToShard extracts first two chars of scheme slug', () => {
    assert.equal(scenarioKeyToShard('alpha-scheme::red-skull::hydra'), 'al');
    assert.equal(scenarioKeyToShard('beta-scheme::magneto::brotherhood'), 'be');
    assert.equal(scenarioKeyToShard('ze-scheme::loki::enemies'), 'ze');
  });

  test('sourceClassRoot returns {basePath}/seed/{v} for source "seed"', () => {
    const root = sourceClassRoot('/data/par', 'seed', 'v1');
    assert.equal(root, '/data/par/seed/v1');
  });

  test('sourceClassRoot returns {basePath}/sim/{v} for source "simulation"', () => {
    const root = sourceClassRoot('/data/par', 'simulation', 'v1');
    assert.equal(root, '/data/par/sim/v1');
  });

  test('PAR_ARTIFACT_SOURCES matches ParArtifactSource union (drift detection)', () => {
    assert.equal(PAR_ARTIFACT_SOURCES.length, 2);
    assert.deepEqual([...PAR_ARTIFACT_SOURCES], ['seed', 'simulation']);
    const allowed: ParArtifactSource[] = ['seed', 'simulation'];
    for (const member of allowed) {
      assert.ok(
        PAR_ARTIFACT_SOURCES.includes(member),
        `PAR_ARTIFACT_SOURCES is missing union member ${member}`,
      );
    }
  });

  test('writeSimulationParArtifact creates file at sim/{v}/scenarios/{shard}/', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'midtown-bank-robbery::red-skull::hydra';
      const result = createSimulationResult(scenarioKey);
      const returnedPath = await writeSimulationParArtifact(
        result,
        buildSimScoringConfig(result),
        workspace,
        PAR_VERSION,
      );
      const expectedRelative = posix.join(
        'sim',
        PAR_VERSION,
        'scenarios',
        'mi',
        'midtown-bank-robbery--red-skull--hydra.json',
      );
      assert.equal(returnedPath, expectedRelative);
      const fullPath = posix.join(workspace, expectedRelative);
      const fileContent = await readFile(fullPath, 'utf8');
      assert.ok(fileContent.length > 0, 'artifact file is empty');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('writeSimulationParArtifact produces sorted-key JSON (deterministic)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::loki::enemies';
      const result = createSimulationResult(scenarioKey);
      const relative = await writeSimulationParArtifact(
        result,
        buildSimScoringConfig(result),
        workspace,
        PAR_VERSION,
      );
      const fileContent = await readFile(posix.join(workspace, relative), 'utf8');
      const parsed = JSON.parse(fileContent) as Record<string, unknown>;
      const topLevelKeys = Object.keys(parsed);
      const sortedTopLevelKeys = [...topLevelKeys].sort();
      assert.deepEqual(topLevelKeys, sortedTopLevelKeys, 'top-level keys are not sorted');
      const simulationBlock = parsed.simulation as Record<string, unknown>;
      const simulationKeys = Object.keys(simulationBlock);
      assert.deepEqual(simulationKeys, [...simulationKeys].sort());
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('writeSimulationParArtifact twice with identical input produces byte-identical file content', async () => {
    const workspaceA = await createTempWorkspace();
    const workspaceB = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::red-skull::hydra';
      const resultA = createSimulationResult(scenarioKey);
      const resultB = createSimulationResult(scenarioKey);
      const sharedConfig = buildSimScoringConfig(resultA);
      const relativeA = await writeSimulationParArtifact(resultA, sharedConfig, workspaceA, PAR_VERSION);
      const relativeB = await writeSimulationParArtifact(resultB, sharedConfig, workspaceB, PAR_VERSION);
      const bytesA = await readFile(posix.join(workspaceA, relativeA), 'utf8');
      const bytesB = await readFile(posix.join(workspaceB, relativeB), 'utf8');
      assert.equal(bytesA, bytesB);
    } finally {
      await removeWorkspace(workspaceA);
      await removeWorkspace(workspaceB);
    }
  });

  test('writeSimulationParArtifact refuses overwrite (throws on existing file)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::overwrite-test::villain';
      const result = createSimulationResult(scenarioKey);
      const config = buildSimScoringConfig(result);
      await writeSimulationParArtifact(result, config, workspace, PAR_VERSION);
      await assert.rejects(
        writeSimulationParArtifact(result, config, workspace, PAR_VERSION),
        (error: unknown) => {
          return (
            error instanceof Error
            && /refused to overwrite/.test(error.message)
            && /immutable/.test(error.message)
          );
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('readSimulationParArtifact returns the written artifact', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::readback::enemies';
      const result = createSimulationResult(scenarioKey);
      await writeSimulationParArtifact(
        result,
        buildSimScoringConfig(result),
        workspace,
        PAR_VERSION,
      );
      const readBack = await readSimulationParArtifact(scenarioKey, workspace, PAR_VERSION);
      assert.notEqual(readBack, null);
      assert.equal(readBack?.scenarioKey, scenarioKey);
      assert.equal(readBack?.parValue, result.parValue);
      assert.equal(readBack?.source, 'simulation');
      assert.equal(readBack?.simulation.policyTier, 'T2');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('readSimulationParArtifact returns null for non-existent scenario', async () => {
    const workspace = await createTempWorkspace();
    try {
      const readBack = await readSimulationParArtifact(
        'not-present::mastermind::group',
        workspace,
        PAR_VERSION,
      );
      assert.equal(readBack, null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('written simulation artifact carries source: "simulation" verbatim', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::verbatim::gang';
      const result = createSimulationResult(scenarioKey);
      const relative = await writeSimulationParArtifact(
        result,
        buildSimScoringConfig(result),
        workspace,
        PAR_VERSION,
      );
      const fileContent = await readFile(posix.join(workspace, relative), 'utf8');
      const parsed = JSON.parse(fileContent) as { source: unknown };
      assert.equal(parsed.source, 'simulation');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('writeSeedParArtifact creates file at seed/{v}/scenarios/{shard}/', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'midtown-bank-robbery::red-skull::hydra';
      const parBaseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, parBaseline);
      const artifact = createSeedArtifact(scenarioKey, parBaseline, scoringConfig);
      const relative = await writeSeedParArtifact(
        artifact,
        scoringConfig,
        workspace,
        PAR_VERSION,
      );
      const expectedRelative = posix.join(
        'seed',
        PAR_VERSION,
        'scenarios',
        'mi',
        'midtown-bank-robbery--red-skull--hydra.json',
      );
      assert.equal(relative, expectedRelative);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('writeSeedParArtifact embeds artifactHash even when caller omits it (hash computed by writer)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::hash-test::group';
      const parBaseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, parBaseline);
      const artifact: SeedParArtifact = {
        ...createSeedArtifact(scenarioKey, parBaseline, scoringConfig),
        artifactHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      };
      const relative = await writeSeedParArtifact(
        artifact,
        scoringConfig,
        workspace,
        PAR_VERSION,
      );
      const fileContent = await readFile(posix.join(workspace, relative), 'utf8');
      const parsed = JSON.parse(fileContent) as { artifactHash: string };
      assert.match(parsed.artifactHash, /^sha256:[0-9a-f]{64}$/);
      assert.notEqual(
        parsed.artifactHash,
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('writeSeedParArtifact refuses overwrite (throws on existing file)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::seed-overwrite::group';
      const parBaseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, parBaseline);
      const artifact = createSeedArtifact(scenarioKey, parBaseline, scoringConfig);
      await writeSeedParArtifact(artifact, scoringConfig, workspace, PAR_VERSION);
      await assert.rejects(
        writeSeedParArtifact(artifact, scoringConfig, workspace, PAR_VERSION),
        (error: unknown) => {
          return (
            error instanceof Error
            && /refused to overwrite/.test(error.message)
            && /immutable/.test(error.message)
          );
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('writeSeedParArtifact rejects artifact whose parValue disagrees with parBaseline under scoringConfig', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::inconsistent::group';
      const parBaseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, parBaseline);
      const baseArtifact = createSeedArtifact(scenarioKey, parBaseline, scoringConfig);
      const mismatchedArtifact: SeedParArtifact = {
        ...baseArtifact,
        parValue: baseArtifact.parValue + 999,
      };
      await assert.rejects(
        writeSeedParArtifact(mismatchedArtifact, scoringConfig, workspace, PAR_VERSION),
        (error: unknown) => {
          return (
            error instanceof Error
            && /does not equal computeParScore/.test(error.message)
          );
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('readSeedParArtifact returns the written artifact', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::seed-readback::group';
      const parBaseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, parBaseline);
      const artifact = createSeedArtifact(scenarioKey, parBaseline, scoringConfig);
      await writeSeedParArtifact(artifact, scoringConfig, workspace, PAR_VERSION);
      const readBack = await readSeedParArtifact(scenarioKey, workspace, PAR_VERSION);
      assert.notEqual(readBack, null);
      assert.equal(readBack?.scenarioKey, scenarioKey);
      assert.equal(readBack?.source, 'seed');
      assert.equal(readBack?.parValue, artifact.parValue);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('readSeedParArtifact returns null for non-existent scenario', async () => {
    const workspace = await createTempWorkspace();
    try {
      const readBack = await readSeedParArtifact(
        'missing-seed::mastermind::group',
        workspace,
        PAR_VERSION,
      );
      assert.equal(readBack, null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('written seed artifact carries source: "seed" and all four parBaseline fields round-trip unchanged', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::baseline-round-trip::group';
      const parBaseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, parBaseline);
      const artifact = createSeedArtifact(scenarioKey, parBaseline, scoringConfig);
      await writeSeedParArtifact(artifact, scoringConfig, workspace, PAR_VERSION);
      const readBack = await readSeedParArtifact(scenarioKey, workspace, PAR_VERSION);
      assert.notEqual(readBack, null);
      assert.equal(readBack?.source, 'seed');
      assert.equal(readBack?.parBaseline.roundsPar, parBaseline.roundsPar);
      assert.equal(readBack?.parBaseline.bystandersPar, parBaseline.bystandersPar);
      assert.equal(readBack?.parBaseline.victoryPointsPar, parBaseline.victoryPointsPar);
      assert.equal(readBack?.parBaseline.escapesPar, parBaseline.escapesPar);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('buildParIndex("seed") and buildParIndex("simulation") build independent indices with correct source stamps', async () => {
    const workspace = await createTempWorkspace();
    try {
      const simKey = 'alpha-scheme::sim-only::group';
      const seedKey = 'beta-scheme::seed-only::group';
      const simResult = createSimulationResult(simKey);
      await writeSimulationParArtifact(
        simResult,
        buildSimScoringConfig(simResult),
        workspace,
        PAR_VERSION,
      );
      const seedBaseline = createTestParBaseline();
      const seedConfig = createTestScoringConfig(seedKey, seedBaseline);
      await writeSeedParArtifact(
        createSeedArtifact(seedKey, seedBaseline, seedConfig),
        seedConfig,
        workspace,
        PAR_VERSION,
      );
      const simIndex = await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const seedIndex = await buildParIndex(workspace, 'seed', PAR_VERSION);
      assert.equal(simIndex.source, 'simulation');
      assert.equal(seedIndex.source, 'seed');
      assert.equal(simIndex.scenarioCount, 1);
      assert.equal(seedIndex.scenarioCount, 1);
      assert.ok(simIndex.scenarios[simKey]);
      assert.ok(seedIndex.scenarios[seedKey]);
      assert.equal(simIndex.scenarios[seedKey], undefined);
      assert.equal(seedIndex.scenarios[simKey], undefined);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('index scenarios keys are sorted alphabetically (both classes)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const keys = [
        'zeta-scheme::mastermind::group',
        'alpha-scheme::mastermind::group',
        'mu-scheme::mastermind::group',
      ];
      for (const key of keys) {
        const simResult = createSimulationResult(key);
        await writeSimulationParArtifact(
          simResult,
          buildSimScoringConfig(simResult),
          workspace,
          PAR_VERSION,
        );
      }
      const simIndex = await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const indexKeyOrder = Object.keys(simIndex.scenarios);
      const expected = [...keys].sort();
      assert.deepEqual(indexKeyOrder, expected);

      for (const key of keys) {
        const baseline = createTestParBaseline();
        const config = createTestScoringConfig(key, baseline);
        await writeSeedParArtifact(
          createSeedArtifact(key, baseline, config),
          config,
          workspace,
          PAR_VERSION,
        );
      }
      const seedIndex = await buildParIndex(workspace, 'seed', PAR_VERSION);
      const seedKeyOrder = Object.keys(seedIndex.scenarios);
      assert.deepEqual(seedKeyOrder, expected);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('index includes artifactHash for each scenario', async () => {
    const workspace = await createTempWorkspace();
    try {
      const key = 'alpha-scheme::hash-in-index::group';
      const hashResult = createSimulationResult(key);
      await writeSimulationParArtifact(
        hashResult,
        buildSimScoringConfig(hashResult),
        workspace,
        PAR_VERSION,
      );
      const index = await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const entry = index.scenarios[key];
      assert.ok(entry !== undefined);
      assert.match(entry.artifactHash, /^sha256:[0-9a-f]{64}$/);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('lookupParFromIndex finds existing scenario; returns null otherwise', async () => {
    const workspace = await createTempWorkspace();
    try {
      const presentKey = 'alpha-scheme::present::group';
      const presentResult = createSimulationResult(presentKey);
      await writeSimulationParArtifact(
        presentResult,
        buildSimScoringConfig(presentResult),
        workspace,
        PAR_VERSION,
      );
      const index = await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const hit = lookupParFromIndex(index, presentKey);
      assert.notEqual(hit, null);
      assert.equal(hit?.parValue, createSimulationResult(presentKey).parValue);
      const miss = lookupParFromIndex(index, 'missing::mastermind::group');
      assert.equal(miss, null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('resolveParForScenario returns sim when only sim exists', async () => {
    const workspace = await createTempWorkspace();
    try {
      const key = 'alpha-scheme::sim-resolve::group';
      const simRes = createSimulationResult(key);
      await writeSimulationParArtifact(
        simRes,
        buildSimScoringConfig(simRes),
        workspace,
        PAR_VERSION,
      );
      await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const resolution = await resolveParForScenario(key, workspace, PAR_VERSION);
      assert.notEqual(resolution, null);
      assert.equal(resolution?.source, 'simulation');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('resolveParForScenario returns seed when only seed exists', async () => {
    const workspace = await createTempWorkspace();
    try {
      const key = 'alpha-scheme::seed-resolve::group';
      const baseline = createTestParBaseline();
      const config = createTestScoringConfig(key, baseline);
      await writeSeedParArtifact(
        createSeedArtifact(key, baseline, config),
        config,
        workspace,
        PAR_VERSION,
      );
      await buildParIndex(workspace, 'seed', PAR_VERSION);
      const resolution = await resolveParForScenario(key, workspace, PAR_VERSION);
      assert.notEqual(resolution, null);
      assert.equal(resolution?.source, 'seed');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('resolveParForScenario returns sim when both exist (precedence rule)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const key = 'alpha-scheme::both-classes::group';
      const bothSimResult = createSimulationResult(key);
      await writeSimulationParArtifact(
        bothSimResult,
        buildSimScoringConfig(bothSimResult),
        workspace,
        PAR_VERSION,
      );
      const baseline = createTestParBaseline();
      const config = createTestScoringConfig(key, baseline);
      await writeSeedParArtifact(
        createSeedArtifact(key, baseline, config),
        config,
        workspace,
        PAR_VERSION,
      );
      await buildParIndex(workspace, 'simulation', PAR_VERSION);
      await buildParIndex(workspace, 'seed', PAR_VERSION);
      const resolution = await resolveParForScenario(key, workspace, PAR_VERSION);
      assert.notEqual(resolution, null);
      assert.equal(resolution?.source, 'simulation');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('resolveParForScenario returns null when neither exists', async () => {
    const workspace = await createTempWorkspace();
    try {
      const resolution = await resolveParForScenario(
        'nobody::home::group',
        workspace,
        PAR_VERSION,
      );
      assert.equal(resolution, null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('resolveParForScenario throws ParStoreReadError on malformed or truncated index (does not fall through)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const simRoot = sourceClassRoot(workspace, 'simulation', PAR_VERSION);
      await mkdir(simRoot, { recursive: true });
      await writeFile(posix.join(simRoot, 'index.json'), '{ broken json', 'utf8');
      await assert.rejects(
        resolveParForScenario('any::key::at-all', workspace, PAR_VERSION),
        (error: unknown) => error instanceof ParStoreReadError,
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('validateParStore("simulation") passes for a valid sim store', async () => {
    const workspace = await createTempWorkspace();
    try {
      const key = 'alpha-scheme::valid-store::group';
      const validResult = createSimulationResult(key);
      await writeSimulationParArtifact(
        validResult,
        buildSimScoringConfig(validResult),
        workspace,
        PAR_VERSION,
      );
      await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const result = await validateParStore(workspace, 'simulation', PAR_VERSION);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
      assert.equal(result.source, 'simulation');
      assert.equal(result.scenariosChecked, 1);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('validateParStore("simulation") flags non-T2 artifact as not publishable', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::non-t2::group';
      const shard = scenarioKeyToShard(scenarioKey);
      const filename = scenarioKeyToFilename(scenarioKey);
      const scenarioDir = posix.join(
        sourceClassRoot(workspace, 'simulation', PAR_VERSION),
        'scenarios',
        shard,
      );
      await mkdir(scenarioDir, { recursive: true });
      const artifactWithoutHash = {
        scenarioKey,
        source: 'simulation',
        parValue: 5500,
        percentileUsed: 55,
        sampleSize: 500,
        generatedAt: '2026-04-23T12:00:00.000Z',
        simulation: {
          policyTier: 'T4',
          policyVersion: 'NearOptimal/v1',
          seedSetHash: 'djb2:aaaaaa',
        },
        scoring: {
          scoringConfigVersion: 1,
          rawScoreSemanticsVersion: 1,
        },
        scoringConfig: createTestScoringConfig(scenarioKey, createTestParBaseline()),
      };
      const artifactHash = computeArtifactHash(artifactWithoutHash);
      const artifact = { ...artifactWithoutHash, artifactHash };
      await writeFile(
        posix.join(scenarioDir, filename),
        JSON.stringify(artifact),
        'utf8',
      );
      await buildParIndex(workspace, 'simulation', PAR_VERSION);
      const result = await validateParStore(workspace, 'simulation', PAR_VERSION);
      assert.equal(result.isValid, false);
      const nonT2Errors = result.errors.filter(
        (entry) => entry.errorType === 'non-t2-policy-tier',
      );
      assert.equal(nonT2Errors.length, 1);
      assert.equal(nonT2Errors[0]?.scenarioKey, scenarioKey);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('validateParStore("seed") flags artifact whose source field is "simulation" but lives under seed/', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::wrong-class::group';
      const shard = scenarioKeyToShard(scenarioKey);
      const filename = scenarioKeyToFilename(scenarioKey);
      const scenarioDir = posix.join(
        sourceClassRoot(workspace, 'seed', PAR_VERSION),
        'scenarios',
        shard,
      );
      await mkdir(scenarioDir, { recursive: true });
      const mismatchArtifact = {
        scenarioKey,
        source: 'simulation',
        parValue: 5500,
        percentileUsed: 55,
        sampleSize: 500,
        generatedAt: '2026-04-23T12:00:00.000Z',
        simulation: {
          policyTier: 'T2',
          policyVersion: 'CompetentHeuristic/v1',
          seedSetHash: 'djb2:aaaa',
        },
        scoring: {
          scoringConfigVersion: 1,
          rawScoreSemanticsVersion: 1,
        },
        scoringConfig: createTestScoringConfig(scenarioKey, createTestParBaseline()),
      };
      const artifactHash = computeArtifactHash(mismatchArtifact);
      const finalArtifact = { ...mismatchArtifact, artifactHash };
      await writeFile(
        posix.join(scenarioDir, filename),
        JSON.stringify(finalArtifact),
        'utf8',
      );
      await buildParIndex(workspace, 'seed', PAR_VERSION);
      const result = await validateParStore(workspace, 'seed', PAR_VERSION);
      assert.equal(result.isValid, false);
      const sourceMismatchErrors = result.errors.filter(
        (entry) => entry.errorType === 'source-class-mismatch',
      );
      assert.equal(sourceMismatchErrors.length, 1);
      assert.equal(sourceMismatchErrors[0]?.scenarioKey, scenarioKey);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('validateParStoreCoverage reports seed-only, sim-covered, and missing scenarios; missingCount matches missing.length', async () => {
    const workspace = await createTempWorkspace();
    try {
      const simKey = 'alpha-scheme::covered-sim::group';
      const seedKey = 'beta-scheme::covered-seed::group';
      const missingKey = 'gamma-scheme::missing::group';

      const coverageSimResult = createSimulationResult(simKey);
      await writeSimulationParArtifact(
        coverageSimResult,
        buildSimScoringConfig(coverageSimResult),
        workspace,
        PAR_VERSION,
      );
      await buildParIndex(workspace, 'simulation', PAR_VERSION);

      const baseline = createTestParBaseline();
      const config = createTestScoringConfig(seedKey, baseline);
      await writeSeedParArtifact(
        createSeedArtifact(seedKey, baseline, config),
        config,
        workspace,
        PAR_VERSION,
      );
      await buildParIndex(workspace, 'seed', PAR_VERSION);

      const coverage = await validateParStoreCoverage(
        workspace,
        PAR_VERSION,
        [simKey, seedKey, missingKey],
      );
      assert.equal(coverage.expectedCount, 3);
      assert.equal(coverage.bothCount, 0);
      assert.equal(coverage.simulationOnlyCount, 1);
      assert.equal(coverage.seedOnlyCount, 1);
      assert.equal(coverage.missingCount, 1);
      assert.equal(coverage.missing.length, coverage.missingCount);
      assert.deepEqual([...coverage.missing], [missingKey]);
      assert.deepEqual([...coverage.seedOnly], [seedKey]);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('computeArtifactHash produces identical hash for different key insertion order; changes when any non-hash field changes', () => {
    const sameContentA = {
      scenarioKey: 'alpha::m::g',
      source: 'seed',
      parValue: 100,
      rationale: 'baseline A',
    };
    const sameContentB = {
      rationale: 'baseline A',
      source: 'seed',
      parValue: 100,
      scenarioKey: 'alpha::m::g',
    };
    const hashA = computeArtifactHash(sameContentA);
    const hashB = computeArtifactHash(sameContentB);
    assert.equal(hashA, hashB);

    const differentContent = { ...sameContentA, parValue: 101 };
    const hashDifferent = computeArtifactHash(differentContent);
    assert.notEqual(hashA, hashDifferent);

    const withArtifactHashField = {
      ...sameContentA,
      artifactHash: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    };
    const hashWithField = computeArtifactHash(withArtifactHashField);
    assert.equal(hashWithField, hashA);
  });

  test('loadParIndex is exported as the startup-time primitive; returns null for a missing index; round-trips a written index', async () => {
    assert.equal(typeof loadParIndex, 'function', 'loadParIndex must be exported');

    const workspace = await createTempWorkspace();
    try {
      const missing = await loadParIndex(workspace, PAR_VERSION, 'simulation');
      assert.equal(missing, null);

      const scenarioKey = 'alpha::m::g';
      const baseline = createTestParBaseline();
      const scoringConfig = createTestScoringConfig(scenarioKey, baseline);
      const artifact = createSeedArtifact(scenarioKey, baseline, scoringConfig);
      await writeSeedParArtifact(artifact, scoringConfig, workspace, PAR_VERSION);
      await buildParIndex(workspace, 'seed', PAR_VERSION);

      const loaded = await loadParIndex(workspace, PAR_VERSION, 'seed');
      assert.notEqual(loaded, null);
      assert.equal(loaded?.source, 'seed');
      assert.equal(loaded?.parVersion, PAR_VERSION);
      assert.equal(loaded?.scenarioCount, 1);
      assert.ok(loaded?.scenarios[scenarioKey], 'scenario must appear in loaded index');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  // why: WP-053a +3 validator tests for the D-5306 / D-5306c invariants.
  // These tests bypass the writer guards by constructing artifacts inline
  // via writeFile, then assert validateParStore surfaces the locked error
  // type strings ('scoring_config_invalid' / 'scoring_config_version_mismatch'
  // / 'par_baseline_redundancy_drift'). The writers refuse to produce
  // drift-broken artifacts in production; these tests exercise the
  // post-tamper detection path that protects the trust surface.

  test('validateParStore rejects artifact missing scoringConfig with errorType scoring_config_invalid', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::missing-config::group';
      const shard = scenarioKeyToShard(scenarioKey);
      const filename = scenarioKeyToFilename(scenarioKey);
      const scenarioDir = posix.join(
        sourceClassRoot(workspace, 'simulation', PAR_VERSION),
        'scenarios',
        shard,
      );
      await mkdir(scenarioDir, { recursive: true });
      // why: hand-built artifact that omits scoringConfig entirely. buildParIndex
      // will throw before validateParStore can run, so this test calls validate
      // against an artifact written without index materialization (skips the
      // index-presence check via separate index.json placeholder).
      const baseArtifact = {
        scenarioKey,
        source: 'simulation',
        parValue: 5500,
        percentileUsed: 55,
        sampleSize: 500,
        generatedAt: '2026-04-23T12:00:00.000Z',
        simulation: {
          policyTier: 'T2',
          policyVersion: 'CompetentHeuristic/v1',
          seedSetHash: 'djb2:abc',
        },
        scoring: {
          scoringConfigVersion: 1,
          rawScoreSemanticsVersion: 1,
        },
      };
      const artifactHash = computeArtifactHash(baseArtifact);
      const finalArtifact = { ...baseArtifact, artifactHash };
      await writeFile(
        posix.join(scenarioDir, filename),
        JSON.stringify(finalArtifact),
        'utf8',
      );
      // why: hand-written index.json so validateParStore can run; the index
      // entry includes a placeholder scoringConfig so isParIndexShape passes,
      // but the on-disk artifact lacks it — that is the drift case under test.
      const placeholderConfig = createTestScoringConfig(scenarioKey, createTestParBaseline());
      const indexPath = posix.join(
        sourceClassRoot(workspace, 'simulation', PAR_VERSION),
        'index.json',
      );
      await writeFile(
        indexPath,
        JSON.stringify({
          parVersion: PAR_VERSION,
          source: 'simulation',
          generatedAt: '2026-04-23T12:00:00.000Z',
          scenarioCount: 1,
          scenarios: {
            [scenarioKey]: {
              path: posix.join(shard, filename),
              parValue: 5500,
              artifactHash,
              scoringConfig: placeholderConfig,
            },
          },
        }),
        'utf8',
      );

      const result = await validateParStore(workspace, 'simulation', PAR_VERSION);
      assert.equal(result.isValid, false);
      const configMissingErrors = result.errors.filter(
        (entry) => entry.errorType === 'scoring_config_invalid',
      );
      assert.equal(configMissingErrors.length, 1);
      assert.equal(configMissingErrors[0]?.scenarioKey, scenarioKey);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('validateParStore rejects artifact whose scoringConfig.scoringConfigVersion disagrees with scoring.scoringConfigVersion', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::version-mismatch::group';
      const shard = scenarioKeyToShard(scenarioKey);
      const filename = scenarioKeyToFilename(scenarioKey);
      const scenarioDir = posix.join(
        sourceClassRoot(workspace, 'simulation', PAR_VERSION),
        'scenarios',
        shard,
      );
      await mkdir(scenarioDir, { recursive: true });
      // why: artifact carries scoring.scoringConfigVersion = 1 but
      // scoringConfig.scoringConfigVersion = 99 — the locked invariant
      // requires the two to match (D-5306).
      const driftConfig: ScenarioScoringConfig = {
        ...createTestScoringConfig(scenarioKey, createTestParBaseline()),
        scoringConfigVersion: 99,
      };
      const baseArtifact = {
        scenarioKey,
        source: 'simulation',
        parValue: 5500,
        percentileUsed: 55,
        sampleSize: 500,
        generatedAt: '2026-04-23T12:00:00.000Z',
        simulation: {
          policyTier: 'T2',
          policyVersion: 'CompetentHeuristic/v1',
          seedSetHash: 'djb2:def',
        },
        scoring: {
          scoringConfigVersion: 1,
          rawScoreSemanticsVersion: 1,
        },
        scoringConfig: driftConfig,
      };
      const artifactHash = computeArtifactHash(baseArtifact);
      const finalArtifact = { ...baseArtifact, artifactHash };
      await writeFile(
        posix.join(scenarioDir, filename),
        JSON.stringify(finalArtifact),
        'utf8',
      );
      await buildParIndex(workspace, 'simulation', PAR_VERSION);

      const result = await validateParStore(workspace, 'simulation', PAR_VERSION);
      assert.equal(result.isValid, false);
      const versionErrors = result.errors.filter(
        (entry) => entry.errorType === 'scoring_config_version_mismatch',
      );
      assert.equal(versionErrors.length, 1);
      assert.equal(versionErrors[0]?.scenarioKey, scenarioKey);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('validateParStore rejects SeedParArtifact whose parBaseline disagrees with scoringConfig.parBaseline (D-5306c)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'alpha-scheme::baseline-drift::group';
      const shard = scenarioKeyToShard(scenarioKey);
      const filename = scenarioKeyToFilename(scenarioKey);
      const scenarioDir = posix.join(
        sourceClassRoot(workspace, 'seed', PAR_VERSION),
        'scenarios',
        shard,
      );
      await mkdir(scenarioDir, { recursive: true });
      // why: seed artifact carries parBaseline.roundsPar = 5 but the
      // embedded scoringConfig.parBaseline.roundsPar = 99 — the D-5306c
      // one-cycle audit invariant requires field-wise equality.
      const artifactBaseline = createTestParBaseline();
      const driftedConfigBaseline = {
        ...artifactBaseline,
        roundsPar: 99,
      };
      const driftedConfig: ScenarioScoringConfig = {
        ...createTestScoringConfig(scenarioKey, driftedConfigBaseline),
        parBaseline: driftedConfigBaseline,
      };
      const baseArtifact = {
        scenarioKey,
        source: 'seed',
        parBaseline: artifactBaseline,
        parValue: computeParScore({
          ...createTestScoringConfig(scenarioKey, artifactBaseline),
          parBaseline: artifactBaseline,
        }),
        scoring: {
          scoringConfigVersion: 1,
          rawScoreSemanticsVersion: 1,
        },
        authoredAt: '2026-04-23T10:00:00.000Z',
        authoredBy: 'test-author',
        rationale: 'WP-053a baseline drift fixture.',
        scoringConfig: driftedConfig,
      };
      const artifactHash = computeArtifactHash(baseArtifact);
      const finalArtifact = { ...baseArtifact, artifactHash };
      await writeFile(
        posix.join(scenarioDir, filename),
        JSON.stringify(finalArtifact),
        'utf8',
      );
      await buildParIndex(workspace, 'seed', PAR_VERSION);

      const result = await validateParStore(workspace, 'seed', PAR_VERSION);
      assert.equal(result.isValid, false);
      const driftErrors = result.errors.filter(
        (entry) => entry.errorType === 'par_baseline_redundancy_drift',
      );
      assert.equal(driftErrors.length, 1);
      assert.equal(driftErrors[0]?.scenarioKey, scenarioKey);
    } finally {
      await removeWorkspace(workspace);
    }
  });
});

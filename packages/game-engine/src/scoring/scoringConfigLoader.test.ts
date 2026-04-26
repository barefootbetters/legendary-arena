/**
 * Tests for the ScenarioScoringConfig loader (WP-053a / D-5306a).
 *
 * Exactly four tests inside a fresh top-level describe block, per the
 * post-WP-031 wrap-in-describe convention. Engine baseline shifts from
 * 513 / 115 / 0 → 522 / 116 / 0 (+9 tests / +1 suite at the engine level;
 * +4 from this file). Tests cover:
 *   - Valid file load (deepEqual against the embedded fixture literal)
 *   - Throws on missing file (error message includes the file path)
 *   - Throws on invalid JSON (parse failure surfaces with file path)
 *   - Throws on invalid config (validateScoringConfig rejection
 *     propagates verbatim through the loader)
 *
 * Uses `node:test`, `node:assert/strict`, `node:fs/promises`, `node:os`.
 * No `boardgame.io` import. Per-test temp directory under `tmpdir()`,
 * cleaned up in a `finally` block.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ScenarioScoringConfig } from './parScoring.types.js';
import { scenarioKeyToFilename } from '../simulation/par.storage.js';
import { loadScoringConfigForScenario } from './scoringConfigLoader.js';

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'wp053a-loader-'));
}

async function removeWorkspace(workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true });
}

function buildValidScoringConfig(scenarioKey: string): ScenarioScoringConfig {
  return {
    scenarioKey,
    weights: {
      roundCost: 50,
      bystanderReward: 200,
      victoryPointReward: 10,
    },
    caps: {
      bystanderCap: null,
      victoryPointCap: null,
    },
    penaltyEventWeights: {
      villainEscaped: 100,
      bystanderLost: 300,
      schemeTwistNegative: 50,
      mastermindTacticUntaken: 25,
      scenarioSpecificPenalty: 40,
    },
    parBaseline: {
      roundsPar: 20,
      bystandersPar: 5,
      victoryPointsPar: 30,
      escapesPar: 1,
    },
    scoringConfigVersion: 1,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
  };
}

describe('scoringConfigLoader (WP-053a)', () => {
  test('loadScoringConfigForScenario reads a valid file and returns the parsed ScenarioScoringConfig', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey =
        'test-scheme-par::test-mastermind-par::test-villain-group-par';
      const expected = buildValidScoringConfig(scenarioKey);
      const filename = scenarioKeyToFilename(scenarioKey);
      await writeFile(
        join(workspace, filename),
        JSON.stringify(expected),
        'utf8',
      );

      const loaded = await loadScoringConfigForScenario(scenarioKey, workspace);

      assert.deepEqual(
        loaded,
        expected,
        'Loaded config must structurally equal the file contents.',
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('loadScoringConfigForScenario throws a full-sentence error including the file path when the file is missing', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'absent-scheme::absent-mastermind::absent-villains';
      const expectedFilename = scenarioKeyToFilename(scenarioKey);
      const expectedPath = join(workspace, expectedFilename);

      await assert.rejects(
        () => loadScoringConfigForScenario(scenarioKey, workspace),
        (error: Error) => {
          assert.ok(
            error.message.includes(expectedPath),
            `Error message must include the missing file path; got: ${error.message}`,
          );
          assert.ok(
            error.message.length > 30,
            'Error message must be a full sentence, not a terse fragment.',
          );
          return true;
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('loadScoringConfigForScenario throws when the file contains invalid JSON', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey = 'broken-scheme::broken-mastermind::broken-villains';
      const filename = scenarioKeyToFilename(scenarioKey);
      await writeFile(
        join(workspace, filename),
        '{ this is not valid json',
        'utf8',
      );

      await assert.rejects(
        () => loadScoringConfigForScenario(scenarioKey, workspace),
        (error: Error) => {
          assert.ok(
            /JSON/i.test(error.message),
            `Error message must mention JSON parsing; got: ${error.message}`,
          );
          return true;
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('loadScoringConfigForScenario propagates validateScoringConfig rejection (validator-driven failure)', async () => {
    const workspace = await createTempWorkspace();
    try {
      const scenarioKey =
        'invalid-scheme::invalid-mastermind::invalid-villains';
      const valid = buildValidScoringConfig(scenarioKey);
      // why: omit penaltyEventWeights.villainEscaped to trigger
      // validateScoringConfig's per-PenaltyEventType presence check.
      // The loader joins validator errors with '; ' and embeds the result
      // in the thrown message — verify a non-trivial, validator-shaped
      // rejection path rather than simulating a structural shape miss.
      const invalid = {
        ...valid,
        penaltyEventWeights: {
          bystanderLost: 300,
          schemeTwistNegative: 50,
          mastermindTacticUntaken: 25,
          scenarioSpecificPenalty: 40,
        },
      };
      const filename = scenarioKeyToFilename(scenarioKey);
      await writeFile(
        join(workspace, filename),
        JSON.stringify(invalid),
        'utf8',
      );

      await assert.rejects(
        () => loadScoringConfigForScenario(scenarioKey, workspace),
        (error: Error) => {
          assert.ok(
            /rejected scoring config/.test(error.message),
            `Error message must indicate validator rejection; got: ${error.message}`,
          );
          return true;
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

});

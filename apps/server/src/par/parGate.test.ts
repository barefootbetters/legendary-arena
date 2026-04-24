/**
 * Tests for the server-layer PAR publication gate (WP-051).
 *
 * Exactly thirteen tests inside one describe block per EC-051 Test Count
 * Lock. Coverage:
 *   - loadParIndex smoke (3) — engine-surface verification from the server
 *     boundary
 *   - checkParPublished base behavior (3) — sim-only hit, absent→null,
 *     dual-null fail-closed
 *   - createParGate integration (3) — bound gate equivalence, no-fs-at-
 *     request-time invariant, version isolation
 *   - Dual-class precedence D-5101 / D-5003 (3) — sim-only, seed-only,
 *     both-present sim-wins
 *   - Aliasing guard — copilot #17 (1) — two calls return identity-distinct
 *     objects; mutating result1 does not affect result2 or the index
 *
 * Fixtures are hand-authored index.json files under mkdtemp workspaces
 * rooted at node:os.tmpdir(). Tests may import node:fs/promises freely —
 * the fs-free boundary is enforced on parGate.mjs only. Every test cleans
 * up its workspace in a finally block.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// @ts-ignore — importing .mjs from .ts; tsx resolves this at runtime.
import { checkParPublished, createParGate } from './parGate.mjs';
// @ts-ignore — loadParIndex is re-exported from the engine package root.
import { loadParIndex } from '@legendary-arena/game-engine';

type ParArtifactSource = 'seed' | 'simulation';

interface IndexEntry {
  readonly path: string;
  readonly parValue: number;
  readonly artifactHash: string;
}

interface WrittenIndex {
  readonly parVersion: string;
  readonly source: ParArtifactSource;
  readonly generatedAt: string;
  readonly scenarioCount: number;
  readonly scenarios: Record<string, IndexEntry>;
}

function sourceDirectoryName(source: ParArtifactSource): string {
  return source === 'seed' ? 'seed' : 'sim';
}

async function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'wp051-gate-'));
}

async function removeWorkspace(workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true });
}

async function writeHandAuthoredIndex(
  workspace: string,
  source: ParArtifactSource,
  parVersion: string,
  scenarios: Record<string, IndexEntry>,
): Promise<WrittenIndex> {
  const classDirectory = join(
    workspace,
    sourceDirectoryName(source),
    parVersion,
  );
  await mkdir(classDirectory, { recursive: true });
  const sortedKeys = Object.keys(scenarios).sort();
  const sortedScenarios: Record<string, IndexEntry> = {};
  for (const key of sortedKeys) {
    sortedScenarios[key] = scenarios[key]!;
  }
  const index: WrittenIndex = {
    parVersion,
    source,
    generatedAt: '2026-04-23T00:00:00.000Z',
    scenarioCount: sortedKeys.length,
    scenarios: sortedScenarios,
  };
  await writeFile(
    join(classDirectory, 'index.json'),
    JSON.stringify(index),
    'utf8',
  );
  return index;
}

function createEntry(
  scenarioKey: string,
  parValue: number,
  hashSuffix: string,
): IndexEntry {
  return {
    path: `${scenarioKey.slice(0, 2)}/${scenarioKey}.json`,
    parValue,
    artifactHash: `sha256-test-${hashSuffix}`,
  };
}

describe('PAR publication gate (WP-051)', () => {
  test('loadParIndex returns a parsed ParIndex with expected source/parVersion/scenarios for a valid hand-authored index', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'alpha-scenario': createEntry('alpha-scenario', 100, 'a'),
      });

      const loaded = await loadParIndex(workspace, 'v1', 'simulation');

      assert.notEqual(loaded, null, 'loadParIndex must return a parsed index for a well-formed file.');
      assert.equal(loaded.parVersion, 'v1');
      assert.equal(loaded.source, 'simulation');
      assert.equal(loaded.scenarioCount, 1);
      assert.equal(loaded.scenarios['alpha-scenario'].parValue, 100);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('loadParIndex returns null for a missing index directory', async () => {
    const workspace = await createWorkspace();
    try {
      const loaded = await loadParIndex(workspace, 'v1', 'simulation');
      assert.equal(loaded, null, 'loadParIndex must return null when no index.json exists under the class root.');
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('loadParIndex throws ParStoreReadError for an index whose source field disagrees with its directory', async () => {
    const workspace = await createWorkspace();
    try {
      // why: write an index under the seed directory but stamped with source
      // "simulation" to trigger the cross-class source-stamp mismatch path.
      const seedDirectory = join(workspace, 'seed', 'v1');
      await mkdir(seedDirectory, { recursive: true });
      await writeFile(
        join(seedDirectory, 'index.json'),
        JSON.stringify({
          parVersion: 'v1',
          source: 'simulation',
          generatedAt: '2026-04-23T00:00:00.000Z',
          scenarioCount: 0,
          scenarios: {},
        }),
        'utf8',
      );

      await assert.rejects(
        () => loadParIndex(workspace, 'v1', 'seed'),
        (error: Error) => {
          assert.equal(error.name, 'ParStoreReadError');
          assert.ok(
            error.message.length > 20,
            'ParStoreReadError message must be a full sentence, not a terse fragment.',
          );
          return true;
        },
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('checkParPublished returns {parValue, parVersion, source: "simulation"} for a sim-only scenario', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'sim-only': createEntry('sim-only', 250, 'sim-only'),
      });
      const simulationIndex = await loadParIndex(workspace, 'v1', 'simulation');
      const seedIndex = await loadParIndex(workspace, 'v1', 'seed');

      const result = checkParPublished(simulationIndex, seedIndex, 'sim-only');

      assert.deepEqual(result, {
        parValue: 250,
        parVersion: 'v1',
        source: 'simulation',
      });
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('checkParPublished returns null for a scenario absent from both indices', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'present-sim': createEntry('present-sim', 1, 'p1'),
      });
      await writeHandAuthoredIndex(workspace, 'seed', 'v1', {
        'present-seed': createEntry('present-seed', 2, 'p2'),
      });
      const simulationIndex = await loadParIndex(workspace, 'v1', 'simulation');
      const seedIndex = await loadParIndex(workspace, 'v1', 'seed');

      const result = checkParPublished(
        simulationIndex,
        seedIndex,
        'missing-scenario',
      );

      assert.equal(result, null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('checkParPublished returns null when both indices are null (dual-null fail closed)', () => {
    const result = checkParPublished(null, null, 'any-scenario-key');
    assert.equal(result, null, 'Dual-null must fail closed — competitive submissions disabled.');
  });

  test('createParGate returns a working gate whose checkParPublished matches module-level semantics on the loaded indices', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'integration-sim': createEntry('integration-sim', 77, 'i1'),
      });
      await writeHandAuthoredIndex(workspace, 'seed', 'v1', {
        'integration-seed': createEntry('integration-seed', 88, 'i2'),
      });

      const gate = await createParGate(workspace, 'v1');

      assert.equal(gate.simulationScenarioCount, 1);
      assert.equal(gate.seedScenarioCount, 1);

      const simulationHit = gate.checkParPublished('integration-sim');
      assert.deepEqual(simulationHit, {
        parValue: 77,
        parVersion: 'v1',
        source: 'simulation',
      });

      const seedHit = gate.checkParPublished('integration-seed');
      assert.deepEqual(seedHit, {
        parValue: 88,
        parVersion: 'v1',
        source: 'seed',
      });

      const miss = gate.checkParPublished('not-published');
      assert.equal(miss, null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('gate check performs zero filesystem IO at request time — delete the backing directory, subsequent checks still return correct results', async () => {
    const workspace = await createWorkspace();
    await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
      'invariant-check': createEntry('invariant-check', 42, 'inv'),
    });

    const gate = await createParGate(workspace, 'v1');

    // why: delete the backing directory immediately after gate construction.
    // Any per-request filesystem read would fail here — a passing assertion
    // below proves the gate is closed over in-memory data only (D-5101).
    await rm(workspace, { recursive: true, force: true });

    const firstCheck = gate.checkParPublished('invariant-check');
    const secondCheck = gate.checkParPublished('invariant-check');
    const missCheck = gate.checkParPublished('never-published');

    assert.deepEqual(firstCheck, {
      parValue: 42,
      parVersion: 'v1',
      source: 'simulation',
    });
    assert.deepEqual(secondCheck, {
      parValue: 42,
      parVersion: 'v1',
      source: 'simulation',
    });
    assert.equal(missCheck, null);
  });

  test('version isolation: a scenario published only under v1 does not appear when the gate is constructed with v2', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'version-scoped': createEntry('version-scoped', 500, 'vs'),
      });

      const v2Gate = await createParGate(workspace, 'v2');

      assert.equal(v2Gate.simulationScenarioCount, 0);
      assert.equal(v2Gate.seedScenarioCount, 0);
      assert.equal(v2Gate.checkParPublished('version-scoped'), null);
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('dual-class precedence: sim-only scenario returns source "simulation"', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'precedence-sim-only': createEntry('precedence-sim-only', 10, 'd1'),
      });
      await writeHandAuthoredIndex(workspace, 'seed', 'v1', {
        'unrelated-seed-scenario': createEntry(
          'unrelated-seed-scenario',
          20,
          'd2',
        ),
      });

      const gate = await createParGate(workspace, 'v1');
      const result = gate.checkParPublished('precedence-sim-only');

      assert.deepEqual(result, {
        parValue: 10,
        parVersion: 'v1',
        source: 'simulation',
      });
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('dual-class precedence: seed-only scenario returns source "seed" (graceful degradation)', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'unrelated-sim-scenario': createEntry(
          'unrelated-sim-scenario',
          30,
          'd3',
        ),
      });
      await writeHandAuthoredIndex(workspace, 'seed', 'v1', {
        'precedence-seed-only': createEntry('precedence-seed-only', 40, 'd4'),
      });

      const gate = await createParGate(workspace, 'v1');
      const result = gate.checkParPublished('precedence-seed-only');

      assert.deepEqual(result, {
        parValue: 40,
        parVersion: 'v1',
        source: 'seed',
      });
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('dual-class precedence: both-present with differing parValue returns sim parValue and source "simulation" (D-5101)', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'both-present': createEntry('both-present', 111, 'sim'),
      });
      await writeHandAuthoredIndex(workspace, 'seed', 'v1', {
        'both-present': createEntry('both-present', 999, 'seed'),
      });

      const gate = await createParGate(workspace, 'v1');
      const result = gate.checkParPublished('both-present');

      assert.deepEqual(
        result,
        { parValue: 111, parVersion: 'v1', source: 'simulation' },
        'Simulation index must win when both classes cover the scenario; seed parValue must not leak into the result.',
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });

  test('aliasing guard: two sequential calls return identity-distinct objects with equal fields; mutating result1 does not affect result2 or the index', async () => {
    const workspace = await createWorkspace();
    try {
      await writeHandAuthoredIndex(workspace, 'simulation', 'v1', {
        'aliasing-check': createEntry('aliasing-check', 321, 'ali'),
      });
      const simulationIndex = await loadParIndex(workspace, 'v1', 'simulation');
      const seedIndex = null;

      const firstResult = checkParPublished(
        simulationIndex,
        seedIndex,
        'aliasing-check',
      );
      const secondResult = checkParPublished(
        simulationIndex,
        seedIndex,
        'aliasing-check',
      );

      assert.notEqual(firstResult, null);
      assert.notEqual(secondResult, null);
      assert.notStrictEqual(
        firstResult,
        secondResult,
        'Each checkParPublished call must construct a fresh object literal — identity equality would mean the gate is aliasing the index.',
      );
      assert.equal(firstResult.parValue, secondResult.parValue);
      assert.equal(firstResult.parVersion, secondResult.parVersion);
      assert.equal(firstResult.source, secondResult.source);

      // why: mutating result1 must not observably change result2 nor the
      // underlying index — the aliasing guard test per copilot #17.
      firstResult.parValue = -1;

      assert.equal(
        secondResult.parValue,
        321,
        'Mutating the first result must not corrupt a subsequent gate call.',
      );
      assert.equal(
        simulationIndex.scenarios['aliasing-check'].parValue,
        321,
        'Mutating the first result must not corrupt the in-memory index.',
      );
    } finally {
      await removeWorkspace(workspace);
    }
  });
});

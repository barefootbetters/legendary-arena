/**
 * Tests for the legends snapshot logic (WP-142).
 *
 * Pure logic tests — no R2 mocked at this layer, no database access.
 * Validates byte-identity, sort order, PII exclusion, and clock-free
 * invariants per EC-157 §Test Plan.
 *
 * Authority: WP-142 §G; EC-157 §Test Plan.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGlobalTopSnapshot,
  buildScenarioSnapshot,
  deriveBoardName,
  extractSnapshotFields,
  serializeSnapshot,
  buildBoardList,
  UNCLAIMED_HANDLE_LABEL,
} from './legends.logic.js';

import type {
  ClaimedHandle,
  GlobalTopLeaderboard,
  PublicLeaderboardEntry,
  ScenarioLeaderboard,
} from '../leaderboards/leaderboard.types.js';

/**
 * A claimed-handle map that labels each entry with its playerDisplayName (WP-579
 * builder tests keep their handle assertions this way). Requires distinct
 * replayHashes per entry (makeEntry derives one from the name by default).
 */
function claimedHandles(entries: PublicLeaderboardEntry[]): Map<string, ClaimedHandle> {
  const handles = new Map<string, ClaimedHandle>();
  for (const entry of entries) {
    handles.set(entry.replayHash, {
      handle: entry.playerDisplayName,
      handleCanonical: entry.playerDisplayName.toLowerCase(),
    });
  }
  return handles;
}

/** No claimed handles — every row falls back to the neutral label. */
const NO_HANDLES: ReadonlyMap<string, ClaimedHandle> = new Map();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<PublicLeaderboardEntry> = {}): PublicLeaderboardEntry {
  // why: WP-579 — the snapshot handle now comes from a replayHash-keyed map, so
  // each distinctly-named entry needs a distinct replayHash by default (an
  // explicit replayHash override still wins via the spread).
  const playerDisplayName = overrides.playerDisplayName ?? 'Alice';
  return {
    rank: 1,
    replayHash: `hash-${playerDisplayName}`,
    scenarioKey: 'scheme-mastermind-villains',
    finalScore: 42,
    rawScore: 40,
    parVersion: 'v1',
    scoringConfigVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
    playerDisplayName,
  };
}

function makeGlobalLeaderboard(
  entries: PublicLeaderboardEntry[],
): GlobalTopLeaderboard {
  return {
    entries,
    totalEligibleEntries: entries.length,
  };
}

function makeScenarioLeaderboard(
  scenarioKey: string,
  entries: PublicLeaderboardEntry[],
): ScenarioLeaderboard {
  return {
    scenarioKey,
    entries,
    totalEligibleEntries: entries.length,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('legends logic (WP-142)', () => {
  test('buildGlobalTopSnapshot produces byte-identical output for identical input', () => {
    const entries = [
      makeEntry({ rank: 1, playerDisplayName: 'Alice', finalScore: 42, scenarioKey: 'sc-a' }),
      makeEntry({ rank: 2, playerDisplayName: 'Bob', finalScore: 50, scenarioKey: 'sc-b' }),
    ];
    const leaderboard = makeGlobalLeaderboard(entries);

    const handles = claimedHandles(entries);
    const snapshot1 = buildGlobalTopSnapshot(leaderboard, handles);
    const snapshot2 = buildGlobalTopSnapshot(leaderboard, handles);

    const json1 = serializeSnapshot(snapshot1);
    const json2 = serializeSnapshot(snapshot2);

    assert.equal(json1, json2, 'Two identical inputs must produce byte-identical JSON output.');
  });

  test('buildScenarioSnapshot produces byte-identical output for identical input', () => {
    const entries = [
      makeEntry({ rank: 1, playerDisplayName: 'Alice', finalScore: 42 }),
      makeEntry({ rank: 2, playerDisplayName: 'Bob', finalScore: 50 }),
    ];
    const leaderboard = makeScenarioLeaderboard('my-scenario', entries);

    const handles = claimedHandles(entries);
    const snapshot1 = buildScenarioSnapshot(leaderboard, handles);
    const snapshot2 = buildScenarioSnapshot(leaderboard, handles);

    const json1 = serializeSnapshot(snapshot1);
    const json2 = serializeSnapshot(snapshot2);

    assert.equal(json1, json2, 'Two identical inputs must produce byte-identical JSON output.');
  });

  test('entries are sorted by rank ASC, then handle ASC', () => {
    const entries = [
      makeEntry({ rank: 3, playerDisplayName: 'Zara', finalScore: 100 }),
      makeEntry({ rank: 1, playerDisplayName: 'Charlie', finalScore: 30 }),
      makeEntry({ rank: 1, playerDisplayName: 'Alice', finalScore: 30 }),
      makeEntry({ rank: 2, playerDisplayName: 'Bob', finalScore: 50 }),
    ];
    const leaderboard = makeScenarioLeaderboard('test-scenario', entries);
    const snapshot = buildScenarioSnapshot(leaderboard, claimedHandles(entries));

    assert.equal(snapshot.entries.length, 4);
    assert.equal(snapshot.entries[0].handle, 'Alice');
    assert.equal(snapshot.entries[0].rank, 1);
    assert.equal(snapshot.entries[1].handle, 'Charlie');
    assert.equal(snapshot.entries[1].rank, 1);
    assert.equal(snapshot.entries[2].handle, 'Bob');
    assert.equal(snapshot.entries[2].rank, 2);
    assert.equal(snapshot.entries[3].handle, 'Zara');
    assert.equal(snapshot.entries[3].rank, 3);
  });

  test('global-top entries are sorted by rank ASC, then handle ASC', () => {
    const entries = [
      makeEntry({ rank: 2, playerDisplayName: 'Beta', finalScore: 50, scenarioKey: 'sc-b' }),
      makeEntry({ rank: 1, playerDisplayName: 'Zeta', finalScore: 30, scenarioKey: 'sc-a' }),
      makeEntry({ rank: 1, playerDisplayName: 'Alpha', finalScore: 30, scenarioKey: 'sc-a' }),
    ];
    const leaderboard = makeGlobalLeaderboard(entries);
    const snapshot = buildGlobalTopSnapshot(leaderboard, claimedHandles(entries));

    assert.equal(snapshot.entries[0].handle, 'Alpha');
    assert.equal(snapshot.entries[1].handle, 'Zeta');
    assert.equal(snapshot.entries[2].handle, 'Beta');
  });

  test('snapshot entries contain only public fields — no PII', () => {
    const entry = makeEntry({
      rank: 1,
      replayHash: 'secret-hash-value',
      playerDisplayName: 'Visible Handle',
      scenarioKey: 'sc-test',
      finalScore: 42,
      rawScore: 40,
      parVersion: 'v1',
      scoringConfigVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const snapshotFields = extractSnapshotFields(entry);
    const fieldNames = Object.keys(snapshotFields).sort();

    assert.deepEqual(fieldNames, ['handle', 'rank', 'score']);
    assert.equal(snapshotFields.handle, 'Visible Handle');
    assert.equal(snapshotFields.rank, 1);
    assert.equal(snapshotFields.score, 42);

    const scenarioSnapshot = buildScenarioSnapshot(
      makeScenarioLeaderboard('test', [entry]),
      NO_HANDLES,
    );
    const scenarioEntryKeys = Object.keys(scenarioSnapshot.entries[0]).sort();
    assert.deepEqual(scenarioEntryKeys, ['handle', 'rank', 'score']);
    // why: WP-579 — an unclaimed row shows the neutral label, NOT the
    // display_name (which can be an email local-part). No PII leaks.
    assert.equal(scenarioSnapshot.entries[0].handle, UNCLAIMED_HANDLE_LABEL);
    assert.equal(serializeSnapshot(scenarioSnapshot).includes('Visible Handle'), false);

    const globalSnapshot = buildGlobalTopSnapshot(
      makeGlobalLeaderboard([entry]),
      NO_HANDLES,
    );
    const globalEntryKeys = Object.keys(globalSnapshot.entries[0]).sort();
    assert.deepEqual(globalEntryKeys, ['handle', 'rank', 'scenarioKey', 'score']);
  });

  test('builders do not call Date.now or new Date — no clock dependency', () => {
    const entries = [makeEntry()];
    const leaderboard = makeScenarioLeaderboard('test', entries);
    const snapshot = buildScenarioSnapshot(leaderboard, NO_HANDLES);

    const json = serializeSnapshot(snapshot);
    assert.equal(json.includes('generatedAt'), false);
    assert.equal(json.includes('Date'), false);

    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.board, 'scenario-test');
    assert.equal(snapshot.rowCount, 1);
  });

  test('deriveBoardName produces lowercase kebab-case with scenario- prefix', () => {
    assert.equal(deriveBoardName('My-Scenario-Key'), 'scenario-my-scenario-key');
    assert.equal(deriveBoardName('already-lower'), 'scenario-already-lower');
  });

  test('buildBoardList returns global-top first, then scenario boards sorted ASC', () => {
    const boards = buildBoardList(['zeta-scenario', 'alpha-scenario', 'mid-scenario']);
    assert.deepEqual(boards, [
      'global-top',
      'scenario-alpha-scenario',
      'scenario-mid-scenario',
      'scenario-zeta-scenario',
    ]);
  });

  test('empty leaderboard produces zero-row snapshot', () => {
    const leaderboard = makeScenarioLeaderboard('empty-test', []);
    const snapshot = buildScenarioSnapshot(leaderboard, NO_HANDLES);

    assert.equal(snapshot.entries.length, 0);
    assert.equal(snapshot.rowCount, 0);
    assert.equal(snapshot.board, 'scenario-empty-test');
    assert.equal(snapshot.schemaVersion, 1);
  });

  test('rowCount matches entries length', () => {
    const entries = [
      makeEntry({ rank: 1, playerDisplayName: 'A' }),
      makeEntry({ rank: 2, playerDisplayName: 'B' }),
      makeEntry({ rank: 3, playerDisplayName: 'C' }),
    ];
    const leaderboard = makeScenarioLeaderboard('count-test', entries);
    const snapshot = buildScenarioSnapshot(leaderboard, claimedHandles(entries));

    assert.equal(snapshot.rowCount, snapshot.entries.length);
    assert.equal(snapshot.rowCount, 3);
  });
});

describe('legends handle → profile link (WP-579 / D-24388)', () => {
  test('a claimed handle sets the snapshot handle + handleCanonical (drives the profile link)', () => {
    const entries = [makeEntry({ rank: 1, playerDisplayName: 'ignored-display-name', replayHash: 'rh-claimed' })];
    const handles = new Map<string, ClaimedHandle>([
      ['rh-claimed', { handle: 'AliceTheGreat', handleCanonical: 'alicethegreat' }],
    ]);
    const snapshot = buildScenarioSnapshot(makeScenarioLeaderboard('sc', entries), handles);
    assert.equal(snapshot.entries[0].handle, 'AliceTheGreat', 'claimed handle, not the display_name');
    assert.equal(snapshot.entries[0].handleCanonical, 'alicethegreat', 'canonical drives the URL');
  });

  test('an unclaimed row uses the neutral label and OMITS handleCanonical (no link, no PII)', () => {
    const entries = [makeEntry({ rank: 1, replayHash: 'rh-unclaimed' })];
    const snapshot = buildScenarioSnapshot(makeScenarioLeaderboard('sc', entries), NO_HANDLES);
    assert.equal(snapshot.entries[0].handle, UNCLAIMED_HANDLE_LABEL);
    assert.equal('handleCanonical' in snapshot.entries[0], false, 'omit-when-absent → no link');
  });

  test('global-top: claimed and unclaimed rows are handled per row', () => {
    const entries = [
      makeEntry({ rank: 1, playerDisplayName: 'claimed', replayHash: 'g-1' }),
      makeEntry({ rank: 2, playerDisplayName: 'unclaimed', replayHash: 'g-2' }),
    ];
    const handles = new Map<string, ClaimedHandle>([
      ['g-1', { handle: 'Claimed', handleCanonical: 'claimed' }],
    ]);
    const snapshot = buildGlobalTopSnapshot(makeGlobalLeaderboard(entries), handles);
    const byRank = [...snapshot.entries].sort((a, b) => a.rank - b.rank);
    assert.equal(byRank[0].handle, 'Claimed');
    assert.equal(byRank[0].handleCanonical, 'claimed');
    assert.equal(byRank[1].handle, UNCLAIMED_HANDLE_LABEL);
    assert.equal('handleCanonical' in byRank[1], false);
  });
});

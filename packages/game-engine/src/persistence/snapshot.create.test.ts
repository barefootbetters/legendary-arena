/**
 * Tests for snapshot creation and validation.
 *
 * Covers createSnapshot (pure function, frozen output, zone counts,
 * determinism) and validateSnapshotShape (valid and invalid inputs).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSnapshot } from './snapshot.create.js';
import { validateSnapshotShape } from './snapshot.validate.js';
import type { LegendaryGameState } from '../types.js';
import type { SnapshotContext } from './snapshot.create.js';

/**
 * Build a minimal mock LegendaryGameState for snapshot testing.
 *
 * Contains all required fields with plausible test values. Zone arrays
 * have known lengths so count assertions are deterministic.
 */
function buildMockGameState(): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'scheme-midtown-bank-robbery',
      mastermindId: 'mastermind-red-skull',
      villainGroupIds: ['villain-hydra'],
      henchmanGroupIds: ['henchman-hand-ninjas'],
      heroDeckIds: ['hero-spider-man', 'hero-wolverine'],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 12,
    },
    selection: {
      schemeId: 'scheme-midtown-bank-robbery',
      mastermindId: 'mastermind-red-skull',
      villainGroupIds: ['villain-hydra'],
      henchmanGroupIds: ['henchman-hand-ninjas'],
      heroDeckIds: ['hero-spider-man', 'hero-wolverine'],
    },
    currentStage: 'main',
    playerZones: {
      '0': {
        deck: ['card-a', 'card-b', 'card-c'],
        hand: ['card-d', 'card-e'],
        discard: ['card-f'],
        inPlay: [],
        victory: ['card-g', 'card-h'],
      },
      '1': {
        deck: ['card-i', 'card-j'],
        hand: ['card-k'],
        discard: [],
        inPlay: ['card-l', 'card-m', 'card-n'],
        victory: [],
      },
    },
    piles: {
      bystanders: ['bystander-1', 'bystander-2'],
      wounds: ['wound-1'],
      officers: ['officer-1', 'officer-2', 'officer-3'],
      sidekicks: ['sidekick-1'],
    },
    messages: ['Turn 1 started.', 'Player 0 drew 6 cards.'],
    counters: { escapedVillains: 2, schemeLoss: 0, mastermindDefeated: 0 },
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: 2, ready: { '0': true, '1': true }, started: true },
  };
}

/**
 * Build a minimal mock SnapshotContext for testing.
 */
function buildMockContext(): SnapshotContext {
  return {
    turn: 5,
    phase: 'play',
    currentPlayer: '0',
  };
}

describe('createSnapshot', () => {
  it('returns a MatchSnapshot with correct zone counts', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();
    const snapshot = createSnapshot(gameState, context, 'match-001');

    assert.strictEqual(snapshot.matchId, 'match-001');
    assert.strictEqual(snapshot.turn, 5);
    assert.strictEqual(snapshot.phase, 'play');
    assert.strictEqual(snapshot.activePlayer, '0');
    assert.strictEqual(snapshot.players.length, 2);

    const player0 = snapshot.players[0];
    assert.strictEqual(player0.playerId, '0');
    assert.strictEqual(player0.deckCount, 3);
    assert.strictEqual(player0.handCount, 2);
    assert.strictEqual(player0.discardCount, 1);
    assert.strictEqual(player0.inPlayCount, 0);
    assert.strictEqual(player0.victoryCount, 2);

    const player1 = snapshot.players[1];
    assert.strictEqual(player1.playerId, '1');
    assert.strictEqual(player1.deckCount, 2);
    assert.strictEqual(player1.handCount, 1);
    assert.strictEqual(player1.discardCount, 0);
    assert.strictEqual(player1.inPlayCount, 3);
    assert.strictEqual(player1.victoryCount, 0);
  });

  it('produces JSON-serializable output', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();
    const snapshot = createSnapshot(gameState, context, 'match-002');

    const serialized = JSON.stringify(snapshot);
    assert.ok(typeof serialized === 'string');
    assert.ok(serialized.length > 0);

    const parsed = JSON.parse(serialized);
    assert.strictEqual(parsed.matchId, 'match-002');
  });

  it('does NOT contain hookRegistry, lobby, or currentStage as keys', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();
    const snapshot = createSnapshot(gameState, context, 'match-003');

    const snapshotKeys = Object.keys(snapshot);
    const expectedKeys = [
      'matchId',
      'snapshotAt',
      'turn',
      'phase',
      'activePlayer',
      'players',
      'counters',
      'messages',
    ];

    // why: outcome is optional and not present when game is ongoing
    // (no endgame conditions met in the mock), so the key set should
    // be exactly the required keys.
    assert.deepStrictEqual(snapshotKeys.sort(), expectedKeys.sort());

    assert.strictEqual('hookRegistry' in snapshot, false);
    assert.strictEqual('lobby' in snapshot, false);
    assert.strictEqual('currentStage' in snapshot, false);
  });

  it('called twice on the same G produces identical snapshots', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();

    const snapshot1 = createSnapshot(gameState, context, 'match-004');
    const snapshot2 = createSnapshot(gameState, context, 'match-004');

    // why: snapshotAt may differ by milliseconds between calls, so we
    // compare all fields except snapshotAt for determinism.
    assert.strictEqual(snapshot1.matchId, snapshot2.matchId);
    assert.strictEqual(snapshot1.turn, snapshot2.turn);
    assert.strictEqual(snapshot1.phase, snapshot2.phase);
    assert.strictEqual(snapshot1.activePlayer, snapshot2.activePlayer);
    assert.deepStrictEqual(snapshot1.players, snapshot2.players);
    assert.deepStrictEqual(snapshot1.counters, snapshot2.counters);
    assert.deepStrictEqual(snapshot1.messages, snapshot2.messages);
    assert.strictEqual(snapshot1.outcome, snapshot2.outcome);
  });

  it('zone counts match source zone array lengths', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();
    const snapshot = createSnapshot(gameState, context, 'match-005');

    for (const playerSnapshot of snapshot.players) {
      const zones = gameState.playerZones[playerSnapshot.playerId];
      assert.strictEqual(playerSnapshot.deckCount, zones.deck.length);
      assert.strictEqual(playerSnapshot.handCount, zones.hand.length);
      assert.strictEqual(playerSnapshot.discardCount, zones.discard.length);
      assert.strictEqual(playerSnapshot.inPlayCount, zones.inPlay.length);
      assert.strictEqual(playerSnapshot.victoryCount, zones.victory.length);
    }
  });
});

describe('validateSnapshotShape', () => {
  it('returns { ok: true } on a valid snapshot', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();
    const snapshot = createSnapshot(gameState, context, 'match-006');

    const result = validateSnapshotShape(snapshot);
    assert.deepStrictEqual(result, { ok: true });
  });

  it('returns { ok: false } when turn is missing', () => {
    const gameState = buildMockGameState();
    const context = buildMockContext();
    const snapshot = createSnapshot(gameState, context, 'match-007');

    // Remove the turn field to simulate an invalid snapshot
    const invalidSnapshot = { ...snapshot } as Record<string, unknown>;
    delete invalidSnapshot.turn;

    const result = validateSnapshotShape(invalidSnapshot);
    assert.strictEqual(result.ok, false);

    if (!result.ok) {
      const turnError = result.errors.find(
        (error) => error.path === 'turn',
      );
      assert.ok(turnError !== undefined, 'Expected an error for missing turn field.');
      assert.strictEqual(turnError.code, 'MISSING_FIELD');
    }
  });
});

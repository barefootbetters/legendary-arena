/**
 * Unit tests for the shared onBegin-parity helper (WP-266, updated WP-701).
 *
 * applyOnBeginParity mirrors the play-phase onBegin resets for the three
 * observation-only per-turn loops (simulation runner, PAR aggregator, replay
 * fixture harness). Since WP-701 / D-24520 the helper is RESETS ONLY — the new
 * hand is drawn at the END of the previous turn (applyEndOfTurnCleanup) and the
 * initial hands are dealt at setup, so onBegin no longer draws and the helper
 * takes only (gameState, playerId). These tests verify the wrapper behaviour:
 * villainRevealedThisTurn is reset to false, hasDrawnThisTurn is set to true
 * (the incoming seat already holds its hand, so the scaffold drawCards move
 * stays a guarded no-op), the hand is left untouched, and a missing seat is a
 * safe no-op that still resets the flags. The end-of-turn draw is covered in
 * moves/endOfTurnCleanup.logic.test.ts. WP-744 / D-24567 adds the deferred-grant
 * turn-boundary clear: deferredConditionalGrants and the WP-656 defeat edge flag are
 * left ABSENT, and a G that never had either key gains neither (oracle safety).
 * No boardgame.io import — the helper is pure.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyOnBeginParity } from './onBeginParity.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';

/**
 * Builds a valid 9-field MatchSetupConfig fixture (mirrors simulation.test.ts).
 *
 * @returns A complete MatchSetupConfig for the minimal mock registry.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Minimal CardRegistryReader returning an empty card list (buildInitialGameState
 * handles narrow mocks gracefully — see simulation.test.ts).
 *
 * @returns A registry reader exposing an empty listCards.
 */
function createMockRegistry(): CardRegistryReader {
  return { ...makeCardRegistryReader(), listCards: () => [] };
}

/**
 * Builds a real LegendaryGameState and replaces player 0's zones with a known
 * deck/hand/discard so the helper's (non-)effect on the hand is observable
 * regardless of what the minimal mock registry produced at setup.
 *
 * @param deck - the deck contents to install for player 0.
 * @param hand - the hand contents to install for player 0.
 * @param discard - the discard contents to install for player 0.
 * @returns the built game state and a direct reference to player 0's zones.
 */
function makeStateWithDeck(deck: string[], hand: string[], discard: string[]) {
  const gameState = buildInitialGameState(
    createTestConfig(),
    createMockRegistry(),
    makeMockCtx({ numPlayers: 2 }),
  );
  const zones = gameState.playerZones['0'];
  assert.ok(zones, 'player 0 zones must exist in the built state');
  zones.deck = [...deck];
  zones.hand = [...hand];
  zones.discard = [...discard];
  return { gameState, zones };
}

describe('applyOnBeginParity (WP-266 / WP-701)', () => {
  it('resets villainRevealedThisTurn to false and sets hasDrawnThisTurn true', () => {
    const { gameState } = makeStateWithDeck(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], [], []);
    gameState.villainRevealedThisTurn = true;
    gameState.hasDrawnThisTurn = false;

    applyOnBeginParity(gameState, '0');

    assert.equal(gameState.villainRevealedThisTurn, false);
    // why: WP-701 / D-24520 — the incoming seat already holds its hand (dealt at
    // its own end-of-turn, or at setup for turn 1), so the flag is set TRUE to keep
    // the scaffold drawCards move a guarded no-op all turn.
    assert.equal(gameState.hasDrawnThisTurn, true);
  });

  it('does NOT draw — the incoming seat hand is left untouched (draw is at end of turn now)', () => {
    const { gameState, zones } = makeStateWithDeck(
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'],
      ['h1', 'h2'],
      [],
    );

    applyOnBeginParity(gameState, '0');

    // why: WP-701 / D-24520 — onBegin no longer draws; the hand/deck/discard are
    // unchanged. The end-of-turn draw is covered in endOfTurnCleanup.logic.test.ts.
    assert.deepEqual(zones.hand, ['h1', 'h2']);
    assert.deepEqual(zones.deck, ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']);
    assert.deepEqual(zones.discard, []);
    // why: WP-642 — with no draw, the mirror pushes no deckReshuffled notable event.
    assert.equal(gameState.notableEvents.length, 0);
  });

  it('sets the flags even for a missing seat (no draw ever ran, so no zones are touched)', () => {
    const { gameState, zones } = makeStateWithDeck(['c1'], ['h1'], []);
    gameState.villainRevealedThisTurn = true;
    gameState.hasDrawnThisTurn = false;

    // why: WP-701 / D-24520 — the helper is resets-only and reads no zones, so an
    // unknown seat id cannot throw; the two global-per-turn flags reset regardless,
    // and player 0's zones are left untouched.
    applyOnBeginParity(gameState, 'nonexistent-seat');

    assert.equal(gameState.villainRevealedThisTurn, false);
    assert.equal(gameState.hasDrawnThisTurn, true);
    assert.deepEqual(zones.hand, ['h1']);
    assert.deepEqual(zones.deck, ['c1']);
  });

  it('resets the WP-379 heal lock (hasActedThisTurn / hasHealedThisTurn) like game.ts onBegin', () => {
    const { gameState } = makeStateWithDeck(['c1'], ['h1'], []);
    // why: a harness fight/recruit (or heal) on the previous turn leaves these set;
    // live onBegin clears them, so the mirror must too or the lock carries across
    // turns and the harness G diverges from live play.
    gameState.hasActedThisTurn = true;
    gameState.hasHealedThisTurn = true;

    applyOnBeginParity(gameState, '0');

    assert.equal(gameState.hasActedThisTurn, false);
    assert.equal(gameState.hasHealedThisTurn, false);
  });

  it('drops deferredConditionalGrants and the defeat edge flag at the turn boundary (WP-744 / D-24567)', () => {
    const { gameState } = makeStateWithDeck(['c1'], ['h1'], []);
    gameState.deferredConditionalGrants = [
      { playerId: '0', cardId: 'core-hero-emma-frost-diamond-form', hookIndex: 0 },
    ];
    gameState.villainOrMastermindDefeatedSinceResolve = true;

    applyOnBeginParity(gameState, '0');

    // why: WP-744 / D-24567 — mirrors game.ts onBegin. The whole-turn window ends at
    // the turn boundary, so both keys must be ABSENT (not merely falsy): a present-
    // but-empty key would change the hashed G shape the live path produces.
    assert.equal('deferredConditionalGrants' in gameState, false);
    assert.equal('villainOrMastermindDefeatedSinceResolve' in gameState, false);
  });

  it('creates neither deferred-grant key on a G that never had them (oracle safety, WP-744 / D-24567)', () => {
    const { gameState } = makeStateWithDeck(['c1'], ['h1'], []);
    // why: precondition — a fresh setup never records a deferred grant or a defeat
    // edge, so the guarded clears must leave the key set byte-unchanged (this is what
    // keeps the sentinel finalStateHash and PRE_WP080_HASH oracles stable).
    assert.equal('deferredConditionalGrants' in gameState, false);
    assert.equal('villainOrMastermindDefeatedSinceResolve' in gameState, false);
    const keysBefore = Object.keys(gameState).sort();

    applyOnBeginParity(gameState, '0');

    assert.equal('deferredConditionalGrants' in gameState, false);
    assert.equal('villainOrMastermindDefeatedSinceResolve' in gameState, false);
    assert.deepEqual(Object.keys(gameState).sort(), keysBefore);
  });
});

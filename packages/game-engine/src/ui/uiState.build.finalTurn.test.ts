/**
 * Contract tests for the UIState.finalTurn projection (WP-367 / D-24159).
 *
 * `finalTurn` is present ONLY while the deck-exhaustion latch
 * (counters.finalTurnTriggered) is active AND the game has not yet ended. Once
 * the game is over (gameOver set — including the tie), the endgame screen
 * supersedes the banner, so finalTurn is omitted.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUIState } from './uiState.build.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';

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

function createMockRegistry(): CardRegistryReader {
  return { ...makeCardRegistryReader(), listCards: () => [] };
}

const mockCtx = {
  phase: 'play' as string | null,
  turn: 1,
  currentPlayer: '0',
};

function createTestGameState(): LegendaryGameState {
  return buildInitialGameState(createTestConfig(), createMockRegistry(), makeMockCtx());
}

describe('UIState.finalTurn projection (WP-367 / D-24159)', () => {
  it('is absent when the final-turn latch is not set', () => {
    const gameState = createTestGameState();
    const result = buildUIState(gameState, mockCtx);
    assert.equal(result.finalTurn, undefined);
  });

  it('is present with a villain-deck reason when latched and the villain deck is empty', () => {
    const gameState = createTestGameState();
    gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] = 1;
    gameState.villainDeck.deck = [];

    const result = buildUIState(gameState, mockCtx);

    assert.ok(result.finalTurn, 'finalTurn must be projected while latched and mid-game');
    assert.match(result.finalTurn.reason, /villain deck is empty/);
    assert.equal(result.finalTurn.villainDeckRemaining, 0);
    assert.equal(result.finalTurn.heroDeckRemaining, gameState.heroDeck.length);
  });

  it('names the hero deck when it is the empty one', () => {
    const gameState = createTestGameState();
    gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] = 1;
    // why: villain-deck-empty is checked first, so keep the villain deck
    // non-empty to isolate the hero-deck reason (the mock empties both).
    gameState.villainDeck.deck = ['v-keep'];
    gameState.heroDeck = [];

    const result = buildUIState(gameState, mockCtx);

    assert.ok(result.finalTurn);
    assert.match(result.finalTurn.reason, /hero deck is empty/);
    assert.equal(result.finalTurn.heroDeckRemaining, 0);
  });

  // why: the latch is sticky, so a card effect can refill the deck after the
  // latch trips. The banner is still shown (final turn persists), with a generic
  // reason because neither deck currently reads empty.
  it('stays present with a generic reason when the deck refilled after latching', () => {
    const gameState = createTestGameState();
    gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] = 1;
    // why: both decks non-empty (refilled after the latch) but the latch
    // persists — the mock's heroDeck is empty by default, so fill both.
    gameState.villainDeck.deck = ['refilled-v'];
    gameState.heroDeck = ['refilled-h'];

    const result = buildUIState(gameState, mockCtx);

    assert.ok(result.finalTurn);
    assert.match(result.finalTurn.reason, /A deck ran out/);
  });

  // why: once the tie is resolved the game is over — the gameOver projection
  // takes over and the warning banner must be suppressed.
  it('is suppressed once the game has ended (tie resolved)', () => {
    const gameState = createTestGameState();
    gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED] = 1;
    gameState.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE] = 1;

    const result = buildUIState(gameState, mockCtx);

    assert.equal(result.finalTurn, undefined, 'no banner once the game is over');
    assert.ok(result.gameOver, 'gameOver must be projected for the tie');
    assert.equal(result.gameOver.outcome, 'tie');
  });
});

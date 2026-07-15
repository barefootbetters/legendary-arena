/**
 * VP scoring unit tests for WP-020.
 *
 * Tests computeFinalScores with minimal mock G objects.
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeFinalScores } from './scoring.logic.js';
import {
  VP_VILLAIN,
  VP_HENCHMAN,
  VP_BYSTANDER,
  VP_TACTIC,
  VP_WOUND,
} from './scoring.types.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { buildDefaultHookDefinitions } from '../rules/ruleRuntime.impl.js';
import { initializeCity, initializeHq } from '../board/city.logic.js';

// ---------------------------------------------------------------------------
// Mock G factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal LegendaryGameState for scoring tests.
 * Only the fields scoring reads need to be meaningful.
 */
function createMockGameState(options: {
  playerZones: Record<string, {
    deck: string[];
    hand: string[];
    discard: string[];
    inPlay: string[];
    victory: string[];
  }>;
  villainDeckCardTypes?: Record<string, string>;
  tacticsDefeated?: string[];
  ko?: string[];
  cardVictoryPoints?: Record<string, number>;
}): LegendaryGameState {
  const config = {
    schemeId: 'test-scheme',
    mastermindId: 'test-mastermind',
    villainGroupIds: ['test-villain-group'],
    henchmanGroupIds: ['test-henchman-group'],
    heroDeckIds: ['test-hero-deck'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };

  return {
    matchConfiguration: config,
    selection: {
      schemeId: config.schemeId,
      mastermindId: config.mastermindId,
      villainGroupIds: [...config.villainGroupIds],
      henchmanGroupIds: [...config.henchmanGroupIds],
      heroDeckIds: [...config.heroDeckIds],
    },
    currentStage: 'main',
    playerZones: options.playerZones,
    piles: {
      bystanders: [],
      wounds: [],
      officers: [],
      sidekicks: [],
    },
    messages: [],
    counters: {},
    hookRegistry: buildDefaultHookDefinitions(config),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: (options.villainDeckCardTypes ?? {}) as Record<CardExtId, any>,
    ko: (options.ko ?? []) as CardExtId[],
    attachedBystanders: {},
    mastermind: {
      id: 'test-mastermind' as CardExtId,
      baseCardId: 'test-mastermind-base' as CardExtId,
      tacticsDeck: [],
      tacticsDefeated: (options.tacticsDefeated ?? []) as CardExtId[],
    },
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    // why: D-24157 — omit-when-empty (absent ≡ fallback), matching the setup
    // conditional-spread; existing tests pass no map and exercise the fallback path.
    ...(options.cardVictoryPoints
      ? { cardVictoryPoints: options.cardVictoryPoints as Record<CardExtId, number> }
      : {}),
    city: initializeCity(),
    hq: initializeHq(),
    lobby: {
      requiredPlayers: 1,
      ready: {},
      started: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeFinalScores', () => {
  it('empty victory pile: player scores 0 total VP', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
    });

    const result = computeFinalScores(gameState);

    assert.strictEqual(result.players.length, 1);
    assert.strictEqual(result.players[0]!.totalVP, 0);
    assert.strictEqual(result.players[0]!.villainVP, 0);
    assert.strictEqual(result.players[0]!.henchmanVP, 0);
    assert.strictEqual(result.players[0]!.bystanderVP, 0);
    assert.strictEqual(result.players[0]!.woundVP, 0);
  });

  it('victory pile with 2 villains + 1 bystander: scores 3 VP', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          victory: ['villain-a', 'villain-b', 'pile-bystander'],
        },
      },
      villainDeckCardTypes: {
        'villain-a': 'villain',
        'villain-b': 'villain',
        // pile-bystander is NOT in villainDeckCardTypes — it's a rescued
        // supply-pile bystander identified by BYSTANDER_EXT_ID
      },
    });

    const result = computeFinalScores(gameState);

    assert.strictEqual(result.players[0]!.villainVP, 2 * VP_VILLAIN);
    assert.strictEqual(result.players[0]!.bystanderVP, 1 * VP_BYSTANDER);
    assert.strictEqual(result.players[0]!.totalVP, 3);
  });

  it('wound in discard: -1 VP per wound', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: ['pile-wound'],
          hand: [],
          discard: ['pile-wound', 'pile-wound'],
          inPlay: [],
          victory: [],
        },
      },
    });

    const result = computeFinalScores(gameState);

    assert.strictEqual(result.players[0]!.woundVP, 3 * VP_WOUND);
    assert.strictEqual(result.players[0]!.totalVP, -3);
  });

  it('tactic defeated: scores only for the player who defeated it, not every player (D-24176)', () => {
    // Player 0 defeated both tactics (both in their victory pile); player 1
    // defeated none. Only player 0 scores the tactic VP.
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['tactic-1', 'tactic-2'] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      tacticsDefeated: ['tactic-1', 'tactic-2'],
    });

    const result = computeFinalScores(gameState);

    assert.strictEqual(result.players[0]!.tacticVP, 2 * VP_TACTIC);
    assert.strictEqual(result.players[1]!.tacticVP, 0);
    assert.strictEqual(result.players[0]!.totalVP, 10);
    assert.strictEqual(result.players[1]!.totalVP, 0);
  });

  it('tactic defeated: splits VP by which player earned each tactic (D-24176)', () => {
    // Player 0 defeated tactic-1; player 1 defeated tactic-2.
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['tactic-1'] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: ['tactic-2'] },
      },
      tacticsDefeated: ['tactic-1', 'tactic-2'],
    });

    const result = computeFinalScores(gameState);

    assert.strictEqual(result.players[0]!.tacticVP, 1 * VP_TACTIC);
    assert.strictEqual(result.players[1]!.tacticVP, 1 * VP_TACTIC);
  });

  it('multiple players: each gets independent score', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          victory: ['villain-x', 'henchman-y'],
        },
        '1': {
          deck: [],
          hand: [],
          discard: ['pile-wound'],
          inPlay: [],
          victory: ['bystander-deck-01'],
        },
      },
      villainDeckCardTypes: {
        'villain-x': 'villain',
        'henchman-y': 'henchman',
        'bystander-deck-01': 'bystander',
      },
    });

    const result = computeFinalScores(gameState);

    // Player 0: 1 villain + 1 henchman = 2 VP
    assert.strictEqual(result.players[0]!.villainVP, 1);
    assert.strictEqual(result.players[0]!.henchmanVP, 1);
    assert.strictEqual(result.players[0]!.totalVP, 2);

    // Player 1: 1 bystander - 1 wound = 0 VP
    assert.strictEqual(result.players[1]!.bystanderVP, 1);
    assert.strictEqual(result.players[1]!.woundVP, -1);
    assert.strictEqual(result.players[1]!.totalVP, 0);

    assert.strictEqual(result.winner, '0');
  });

  it('tie: winner is null', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          victory: ['villain-a'],
        },
        '1': {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          victory: ['henchman-b'],
        },
      },
      villainDeckCardTypes: {
        'villain-a': 'villain',
        'henchman-b': 'henchman',
      },
    });

    const result = computeFinalScores(gameState);

    // Both have 1 VP
    assert.strictEqual(result.players[0]!.totalVP, 1);
    assert.strictEqual(result.players[1]!.totalVP, 1);
    assert.strictEqual(result.winner, null);
  });

  it('KO pile cards: contribute 0 VP', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      villainDeckCardTypes: {
        'ko-villain': 'villain',
      },
      ko: ['ko-villain'],
    });

    const result = computeFinalScores(gameState);

    // KO pile is not scored — only victory piles count
    assert.strictEqual(result.players[0]!.villainVP, 0);
    assert.strictEqual(result.players[0]!.totalVP, 0);
  });

  it('computeFinalScores does not mutate input G', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: ['pile-wound'],
          hand: [],
          discard: [],
          inPlay: [],
          victory: ['villain-z'],
        },
      },
      villainDeckCardTypes: {
        'villain-z': 'villain',
      },
      tacticsDefeated: ['tactic-a'],
    });

    const beforeJson = JSON.stringify(gameState);

    computeFinalScores(gameState);

    const afterJson = JSON.stringify(gameState);

    assert.strictEqual(
      beforeJson,
      afterJson,
      'G must not be mutated by computeFinalScores',
    );
  });
});

// ---------------------------------------------------------------------------
// Printed-VP scoring (WP-365 / D-24157)
// ---------------------------------------------------------------------------

describe('computeFinalScores — printed VP (D-24157)', () => {
  it('scores villains by their printed vp (the sGTM7LWSIHy fix: 2+2+4 = 8, not 3)', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: [], hand: [], discard: [], inPlay: [],
          victory: ['v-super-skrull', 'v-shapeshifters', 'v-juggernaut'],
        },
      },
      villainDeckCardTypes: {
        'v-super-skrull': 'villain',
        'v-shapeshifters': 'villain',
        'v-juggernaut': 'villain',
      },
      cardVictoryPoints: {
        'v-super-skrull': 2,
        'v-shapeshifters': 2,
        'v-juggernaut': 4,
      },
    });

    const result = computeFinalScores(gameState);
    assert.equal(result.players[0]!.villainVP, 8);
  });

  it('falls back to VP_VILLAIN for a villain with no printed vp (never scores 0)', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['v-known', 'v-null-vp'] },
      },
      villainDeckCardTypes: { 'v-known': 'villain', 'v-null-vp': 'villain' },
      // v-null-vp is absent from the map → fallback 1; v-known → printed 4
      cardVictoryPoints: { 'v-known': 4 },
    });

    const result = computeFinalScores(gameState);
    assert.equal(result.players[0]!.villainVP, 5); // 4 (printed) + 1 (fallback)
  });

  it('scores henchmen by their printed vp with a fallback', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['h-a', 'h-b'] },
      },
      villainDeckCardTypes: { 'h-a': 'henchman', 'h-b': 'henchman' },
      cardVictoryPoints: { 'h-a': 3 }, // h-b absent → fallback 1
    });

    const result = computeFinalScores(gameState);
    assert.equal(result.players[0]!.henchmanVP, 4); // 3 + 1
  });

  it('scores tactics by the mastermind printed vp, keyed by baseCardId', () => {
    const gameState = createMockGameState({
      // the defeating player holds the 4 tactics in their victory pile (D-24176)
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['t1', 't2', 't3', 't4'] } },
      tacticsDefeated: ['t1', 't2', 't3', 't4'],
      // 'test-mastermind-base' is the mock's baseCardId
      cardVictoryPoints: { 'test-mastermind-base': 5 },
    });

    const result = computeFinalScores(gameState);
    assert.equal(result.players[0]!.tacticVP, 20); // 4 × 5
  });

  it('falls back to VP_TACTIC (5) when the mastermind has no printed vp', () => {
    const gameState = createMockGameState({
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['t1', 't2'] } },
      tacticsDefeated: ['t1', 't2'],
      // no cardVictoryPoints → mastermind fallback 5
    });

    const result = computeFinalScores(gameState);
    assert.equal(result.players[0]!.tacticVP, 10); // 2 × 5
  });

  it('leaves bystander VP (1 each) and wound VP (−1 each) unaffected by printed vp', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': {
          deck: ['pile-wound'], hand: [], discard: [], inPlay: [],
          victory: ['v-big', 'pile-bystander', 'pile-bystander'],
        },
      },
      villainDeckCardTypes: { 'v-big': 'villain' },
      cardVictoryPoints: { 'v-big': 4 },
    });

    const result = computeFinalScores(gameState);
    const breakdown = result.players[0]!;
    assert.equal(breakdown.villainVP, 4);
    assert.equal(breakdown.bystanderVP, 2); // 2 × 1, unchanged
    assert.equal(breakdown.woundVP, -1); // 1 × -1, unchanged
  });

  it('absent cardVictoryPoints reproduces the pre-WP-365 flat behavior (backward-compatible)', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: ['v1', 'v2', 'v3'] },
      },
      villainDeckCardTypes: { v1: 'villain', v2: 'villain', v3: 'villain' },
      // no cardVictoryPoints → each villain scores the flat fallback 1
    });

    const result = computeFinalScores(gameState);
    assert.equal(result.players[0]!.villainVP, 3);
  });
});

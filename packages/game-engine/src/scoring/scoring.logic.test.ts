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

  it('tactic defeated: +5 VP per tactic (awarded to all players)', () => {
    const gameState = createMockGameState({
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      tacticsDefeated: ['tactic-1', 'tactic-2'],
    });

    const result = computeFinalScores(gameState);

    // Both players should get tactic VP
    assert.strictEqual(result.players[0]!.tacticVP, 2 * VP_TACTIC);
    assert.strictEqual(result.players[1]!.tacticVP, 2 * VP_TACTIC);
    assert.strictEqual(result.players[0]!.totalVP, 10);
    assert.strictEqual(result.players[1]!.totalVP, 10);
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

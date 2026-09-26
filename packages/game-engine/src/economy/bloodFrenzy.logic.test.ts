/**
 * Tests for the shared Blood Frenzy helpers (WP-765 / D-24598).
 *
 * Includes the scoring-parity pin: victoryPointValueForCard summed over a
 * Victory Pile must equal computeFinalScores' non-Wound VP breakdown.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  victoryPointValueForCard,
  countDistinctVictoryPointValues,
} from './bloodFrenzy.logic.js';
import { computeFinalScores } from '../scoring/scoring.logic.js';
import { VP_TACTIC, VP_UNDERCOVER, VP_VILLAIN, VP_HENCHMAN } from '../scoring/scoring.types.js';
import { BYSTANDER_EXT_ID } from '../setup/buildInitialGameState.js';
import type { LegendaryGameState } from '../types.js';

/**
 * Builds the minimal G slice scoring and the Blood Frenzy helpers read.
 */
function makeVictoryState(options: {
  victory: string[];
  undercover?: string[];
  villainDeckCardTypes?: Record<string, string>;
  cardVictoryPoints?: Record<string, number>;
  tacticsDefeated?: string[];
}): LegendaryGameState {
  return {
    playerZones: {
      '0': {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: options.victory,
        undercover: options.undercover ?? [],
      },
    },
    villainDeckCardTypes: options.villainDeckCardTypes ?? {},
    mastermind: {
      baseCardId: 'mm-base',
      tacticsDefeated: options.tacticsDefeated ?? [],
    },
    cardTraits: {},
    ...(options.cardVictoryPoints !== undefined ? { cardVictoryPoints: options.cardVictoryPoints } : {}),
  } as unknown as LegendaryGameState;
}

describe('victoryPointValueForCard (WP-765 / D-24598)', () => {
  it('reads a villain\'s printed VP, falling back to VP_VILLAIN', () => {
    const G = makeVictoryState({
      victory: ['villain-a', 'villain-b'],
      villainDeckCardTypes: { 'villain-a': 'villain', 'villain-b': 'villain' },
      cardVictoryPoints: { 'villain-a': 4 },
    });
    assert.equal(victoryPointValueForCard(G, '0', 'villain-a'), 4);
    assert.equal(victoryPointValueForCard(G, '0', 'villain-b'), VP_VILLAIN);
  });

  it('reads a henchman\'s printed VP, falling back to VP_HENCHMAN', () => {
    const G = makeVictoryState({
      victory: ['hench-a', 'hench-b'],
      villainDeckCardTypes: { 'hench-a': 'henchman', 'hench-b': 'henchman' },
      cardVictoryPoints: { 'hench-a': 0 },
    });
    assert.equal(victoryPointValueForCard(G, '0', 'hench-a'), 0, 'a printed 0 is a value, not a fallback');
    assert.equal(victoryPointValueForCard(G, '0', 'hench-b'), VP_HENCHMAN);
  });

  it('scores a defeated tactic at the mastermind\'s printed VP, falling back to VP_TACTIC', () => {
    const withPrinted = makeVictoryState({
      victory: ['tactic-1'],
      tacticsDefeated: ['tactic-1'],
      cardVictoryPoints: { 'mm-base': 6 },
    });
    assert.equal(victoryPointValueForCard(withPrinted, '0', 'tactic-1'), 6);
    const withoutPrinted = makeVictoryState({ victory: ['tactic-1'], tacticsDefeated: ['tactic-1'] });
    assert.equal(victoryPointValueForCard(withoutPrinted, '0', 'tactic-1'), VP_TACTIC);
  });

  it('scores an Undercover card at VP_UNDERCOVER and a no-value card as null', () => {
    const G = makeVictoryState({ victory: ['agent-1', 'twist-1'], undercover: ['agent-1'] });
    assert.equal(victoryPointValueForCard(G, '0', 'agent-1'), VP_UNDERCOVER);
    assert.equal(victoryPointValueForCard(G, '0', 'twist-1'), null);
  });

  it('returns null for an unknown player', () => {
    const G = makeVictoryState({ victory: [] });
    assert.equal(victoryPointValueForCard(G, '9', 'anything'), null);
  });
});

describe('countDistinctVictoryPointValues (WP-765 / D-24598)', () => {
  it('counts distinct values, not cards: {Bystander 1, Bystander 1, Villain 2, Villain 3} → 3', () => {
    const G = makeVictoryState({
      victory: [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, 'villain-2', 'villain-3'],
      villainDeckCardTypes: { 'villain-2': 'villain', 'villain-3': 'villain' },
      cardVictoryPoints: { 'villain-2': 2, 'villain-3': 3 },
    });
    assert.equal(countDistinctVictoryPointValues(G, '0'), 3);
  });

  it('ignores no-value cards and returns 0 for an empty or absent pile', () => {
    const empty = makeVictoryState({ victory: [] });
    assert.equal(countDistinctVictoryPointValues(empty, '0'), 0);
    assert.equal(countDistinctVictoryPointValues(empty, '9'), 0);
    const onlyTwists = makeVictoryState({ victory: ['twist-1', 'twist-2'] });
    assert.equal(countDistinctVictoryPointValues(onlyTwists, '0'), 0);
  });
});

describe('Blood Frenzy scoring parity (WP-765 / D-24598)', () => {
  it('the per-card VP summed over the Victory Pile equals computeFinalScores\' non-Wound breakdown', () => {
    const G = makeVictoryState({
      victory: [
        'villain-a',
        'villain-b',
        'hench-a',
        BYSTANDER_EXT_ID,
        'bystander-villain-deck-01',
        'tactic-1',
        'agent-1',
        'twist-1',
      ],
      undercover: ['agent-1'],
      villainDeckCardTypes: {
        'villain-a': 'villain',
        'villain-b': 'villain',
        'hench-a': 'henchman',
        'bystander-villain-deck-01': 'bystander',
      },
      cardVictoryPoints: { 'villain-a': 3, 'hench-a': 2, 'mm-base': 6 },
      tacticsDefeated: ['tactic-1'],
    });

    let summed = 0;
    const zones = G.playerZones['0']!;
    for (const cardId of zones.victory) {
      const value = victoryPointValueForCard(G, '0', cardId);
      if (value !== null) {
        summed += value;
      }
    }

    const breakdown = computeFinalScores(G).players[0]!;
    const scored = breakdown.villainVP + breakdown.henchmanVP + breakdown.bystanderVP
      + breakdown.tacticVP + breakdown.undercoverVP;
    assert.equal(summed, scored, 'the Blood Frenzy mirror must score every card exactly as computeFinalScores does');
    // why: villain 3 + villain fallback 1 + henchman 2 + bystander 1 + bystander 1 +
    // tactic 6 + undercover 1 — pinned so a silent change to both sides still shows.
    assert.equal(summed, 15);
    assert.equal(countDistinctVictoryPointValues(G, '0'), 4, 'distinct values {3, 1, 2, 6}');
  });
});

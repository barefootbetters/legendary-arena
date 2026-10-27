/**
 * Tests for Arnim Zola's shared "less than 2 printed Attack" reads (WP-821 / D-24754).
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import {
  hasLessThanTwoPrintedAttack,
  listCrushEligibleTargets,
  listZolaWeakHqSlots,
  ZOLA_PRINTED_ATTACK_LIMIT,
} from './arnimZola.logic.js';

/**
 * Builds a minimal state with card stats, an HQ and player 0's hand and played cards.
 * The S.H.I.E.L.D. starters carry their real setup stats (Agent attack 0, Trooper 1).
 *
 * @param hq - The HQ slots.
 * @param zones - Player 0's hand and played cards.
 * @returns A LegendaryGameState carrying only the fields the reads use.
 */
function makeZolaReadState(
  hq: (string | null)[] = [null, null, null, null, null],
  zones: { hand?: string[]; inPlay?: string[] } = {},
): LegendaryGameState {
  return {
    hq,
    cardStats: {
      atk0: { attack: 0, cost: 2 },
      atk1: { attack: 1, cost: 3 },
      atk2: { attack: 2, cost: 4 },
      atk3: { attack: 3, cost: 5 },
      'starting-shield-agent': { attack: 0, cost: 0 },
      'starting-shield-trooper': { attack: 1, cost: 0 },
    },
    playerZones: {
      '0': { deck: [], hand: [...(zones.hand ?? [])], discard: [], inPlay: [...(zones.inPlay ?? [])], victory: [] },
    },
  } as unknown as LegendaryGameState;
}

describe('WP-821 arnimZola.logic — the shared "less than 2 printed Attack" reads (D-24754)', () => {
  it('Z1: printed Attack 0 and 1 qualify, 2 and 3 do not, and a card with no stats reads 0', () => {
    const G = makeZolaReadState();
    assert.equal(ZOLA_PRINTED_ATTACK_LIMIT, 2);
    assert.deepEqual(
      ['atk0', 'atk1', 'atk2', 'atk3', 'no-stats-card'].map((cardId) => hasLessThanTwoPrintedAttack(G, cardId)),
      [true, true, false, false, true],
    );
  });

  it('Z2: lists the weak HQ slots in ascending order, skipping empty slots', () => {
    const G = makeZolaReadState(['atk2', 'atk1', null, 'atk0', 'atk3']);
    assert.deepEqual(listZolaWeakHqSlots(G), [1, 3]);
  });

  it('Z3: lists hand then played targets, skipping Wounds and duplicate ids within a zone', () => {
    const G = makeZolaReadState([null, null, null, null, null], {
      hand: ['pile-wound', 'starting-shield-agent', 'starting-shield-agent', 'atk2', 'atk1'],
      inPlay: ['starting-shield-trooper', 'atk3'],
    });
    assert.deepEqual(listCrushEligibleTargets(G, '0'), [
      { zone: 'hand', cardId: 'starting-shield-agent' },
      { zone: 'hand', cardId: 'atk1' },
      { zone: 'inPlay', cardId: 'starting-shield-trooper' },
    ]);
    assert.deepEqual(listCrushEligibleTargets(G, '9'), [], 'an unknown player has no targets');
  });
});

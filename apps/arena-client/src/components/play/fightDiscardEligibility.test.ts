/**
 * Behavior tests for the hand's fight discard eligibility (WP-817 / D-24750).
 *
 * Uses node:test and node:assert only.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { UICityCard, UICityState } from '@legendary-arena/game-engine';
import { fightDiscardEligibleCardIds } from './fightDiscardEligibility';

/** A minimal City villain, optionally with a fight discard cost. */
function villain(extId: string, fightDiscardCosts?: number[]): UICityCard {
  const card: UICityCard = {
    extId,
    type: 'villain',
    keywords: [],
    display: { extId, name: extId, imageUrl: '', cost: 3 },
    attachedHeroes: [],
    attachedHeroDisplay: [],
    attachedBystanderCount: 0,
    fightCost: 3,
  };
  if (fightDiscardCosts !== undefined) {
    card.fightDiscardCosts = fightDiscardCosts;
  }
  return card;
}

function cityWith(...spaces: (UICityCard | null)[]): UICityState {
  return { spaces, escapedPile: [] };
}

const PRIMUS_CITY = cityWith(villain('primus', [2, 3, 5, 7]), null, villain('electro'), null, null);

describe('fightDiscardEligibleCardIds', () => {
  test('lists the hand cards whose engine cost pays the discard, in hand order', () => {
    const eligible = fightDiscardEligibleCardIds(
      PRIMUS_CITY,
      ['cost-4', 'cost-5', 'cost-0', 'cost-2'],
      [4, 5, 0, 2],
      true,
    );
    assert.deepEqual(eligible, ['cost-5', 'cost-2']);
  });

  test('reads handCosts, so an Officer (printed cost null, engine cost 3) counts', () => {
    assert.deepEqual(
      fightDiscardEligibleCardIds(PRIMUS_CITY, ['pile-shield-officer'], [3], true),
      ['pile-shield-officer'],
    );
  });

  test('lists a repeated card id once', () => {
    assert.deepEqual(
      fightDiscardEligibleCardIds(PRIMUS_CITY, ['agent', 'agent'], [3, 3], true),
      ['agent'],
    );
  });

  test('a null hand cost is never eligible', () => {
    assert.deepEqual(fightDiscardEligibleCardIds(PRIMUS_CITY, ['unknown'], [null], true), []);
  });

  test('is empty on another player\'s turn', () => {
    assert.deepEqual(fightDiscardEligibleCardIds(PRIMUS_CITY, ['cost-5'], [5], false), []);
  });

  test('is empty when no City villain has a fight discard cost', () => {
    const city = cityWith(villain('electro'), null, null, null, null);
    assert.deepEqual(fightDiscardEligibleCardIds(city, ['cost-5'], [5], true), []);
  });

  test('is empty with a redacted or absent hand, hand costs, or City', () => {
    assert.deepEqual(fightDiscardEligibleCardIds(PRIMUS_CITY, undefined, [5], true), []);
    assert.deepEqual(fightDiscardEligibleCardIds(PRIMUS_CITY, ['cost-5'], undefined, true), []);
    assert.deepEqual(fightDiscardEligibleCardIds(undefined, ['cost-5'], [5], true), []);
  });

  test('unions the costs of every discard-cost villain in the City', () => {
    const city = cityWith(villain('primus-a', [2]), villain('primus-b', [7]), null, null, null);
    assert.deepEqual(
      fightDiscardEligibleCardIds(city, ['cost-2', 'cost-3', 'cost-7'], [2, 3, 7], true),
      ['cost-2', 'cost-7'],
    );
  });
});

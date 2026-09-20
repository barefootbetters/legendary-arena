/**
 * Tests for heroClauseValue — the per-clause attack/recruit value summer behind
 * the Realized Value % signal (WP-709 / D-24532).
 *
 * Covers: flat attack/recruit magnitude, the two summed, count-scaled
 * magnitude × floor(count / perEach) (via the real resolveCountSource over a
 * cost-four-plus board), perEach normalization, absent-countSource → 0, a
 * non-value effect → 0, an effects-less hook → 0, and that the count read is a
 * pure pass over settled zones. node:test + node:assert only. No boardgame.io.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { heroClauseValue } from './heroClauseValue.derive.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';

/** A hook carrying only the given legacy effects (the value helper reads nothing else). */
function hookWith(effects: HeroEffectDescriptor[]): HeroAbilityHook {
  return { timing: 'onPlay', effects } as unknown as HeroAbilityHook;
}

/**
 * Minimal state whose inPlay + cardStats.cost feed the
 * `cost-four-plus-played-this-turn` count source (self-excludes the trigger).
 */
function makeStateWithCosts(inPlay: string[], costs: Record<string, number>): LegendaryGameState {
  const cardStats: Record<string, { cost: number }> = {};
  for (const id of Object.keys(costs)) {
    cardStats[id] = { cost: costs[id]! };
  }
  return {
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay, victory: [] } },
    cardStats,
  } as unknown as LegendaryGameState;
}

/** A bare state for the flat / non-value cases (no count source is read). */
function bareState(): LegendaryGameState {
  return {
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] } },
  } as unknown as LegendaryGameState;
}

describe('heroClauseValue (WP-709)', () => {
  it('returns the magnitude of a flat attack effect', () => {
    const value = heroClauseValue(bareState(), '0', 'card#0', hookWith([{ type: 'attack', magnitude: 3 }]));
    assert.equal(value, 3);
  });

  it('returns the magnitude of a flat recruit effect', () => {
    const value = heroClauseValue(bareState(), '0', 'card#0', hookWith([{ type: 'recruit', magnitude: 2 }]));
    assert.equal(value, 2);
  });

  it('sums a flat attack and a flat recruit effect on the same hook', () => {
    const value = heroClauseValue(
      bareState(),
      '0',
      'card#0',
      hookWith([{ type: 'attack', magnitude: 3 }, { type: 'recruit', magnitude: 2 }]),
    );
    assert.equal(value, 5);
  });

  it('treats a flat effect with no magnitude as 0', () => {
    const value = heroClauseValue(bareState(), '0', 'card#0', hookWith([{ type: 'attack' }]));
    assert.equal(value, 0);
  });

  it('computes count-scaled value = magnitude × floor(count / perEach), perEach absent → 1', () => {
    // inPlay: trigger + two other cost-4+ cards → count 2 (trigger self-excluded).
    const state = makeStateWithCosts(
      ['big#0', 'other-a#0', 'other-b#0'],
      { 'big#0': 5, 'other-a#0': 4, 'other-b#0': 6 },
    );
    const value = heroClauseValue(state, '0', 'big#0', hookWith([
      { type: 'attack-per-count', magnitude: 1, countSource: 'cost-four-plus-played-this-turn' },
    ]));
    assert.equal(value, 2, 'magnitude 1 × floor(2 / 1)');
  });

  it('applies the perEach divisor (floor) to the count', () => {
    // count 3 (three other cost-4+ cards), perEach 2 → floor(3/2) = 1.
    const state = makeStateWithCosts(
      ['big#0', 'a#0', 'b#0', 'c#0'],
      { 'big#0': 5, 'a#0': 4, 'b#0': 4, 'c#0': 4 },
    );
    const value = heroClauseValue(state, '0', 'big#0', hookWith([
      { type: 'recruit-per-count', magnitude: 3, perEach: 2, countSource: 'cost-four-plus-played-this-turn' },
    ]));
    assert.equal(value, 3, 'magnitude 3 × floor(3 / 2) = 3 × 1');
  });

  it('normalizes perEach <= 0 to 1', () => {
    const state = makeStateWithCosts(['big#0', 'a#0'], { 'big#0': 5, 'a#0': 4 });
    const value = heroClauseValue(state, '0', 'big#0', hookWith([
      { type: 'attack-per-count', magnitude: 2, perEach: 0, countSource: 'cost-four-plus-played-this-turn' },
    ]));
    assert.equal(value, 2, 'perEach 0 → 1; magnitude 2 × floor(1 / 1)');
  });

  it('returns 0 for a count-scaled effect with no countSource', () => {
    const value = heroClauseValue(bareState(), '0', 'card#0', hookWith([
      { type: 'attack-per-count', magnitude: 5 },
    ]));
    assert.equal(value, 0);
  });

  it('returns 0 for a non-value effect (draw)', () => {
    const value = heroClauseValue(bareState(), '0', 'card#0', hookWith([{ type: 'draw', magnitude: 2 }]));
    assert.equal(value, 0);
  });

  it('returns 0 for a hook with no legacy effects', () => {
    const hook = { timing: 'onPlay' } as unknown as HeroAbilityHook;
    assert.equal(heroClauseValue(bareState(), '0', 'card#0', hook), 0);
  });

  it('mixes a flat and a count-scaled value effect on one hook', () => {
    const state = makeStateWithCosts(['big#0', 'a#0'], { 'big#0': 5, 'a#0': 4 });
    const value = heroClauseValue(state, '0', 'big#0', hookWith([
      { type: 'attack', magnitude: 2 },
      { type: 'attack-per-count', magnitude: 1, countSource: 'cost-four-plus-played-this-turn' },
    ]));
    assert.equal(value, 3, 'flat 2 + count-scaled (1 × floor(1/1)) 1');
  });
});

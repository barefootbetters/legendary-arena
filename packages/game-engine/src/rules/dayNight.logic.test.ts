/**
 * Tests for computeDayNight (WP-765 / D-24598).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDayNight } from './dayNight.logic.js';
import type { LegendaryGameState } from '../types.js';

/**
 * Builds a minimal G carrying only the HQ and the printed-cost stats the
 * helper reads. Each slot entry is either null (empty) or [cardId, cost].
 */
function makeDayNightState(slots: ([string, number] | null)[]): LegendaryGameState {
  const hq: (string | null)[] = [];
  const cardStats: Record<string, { attack: number; recruit: number; cost: number; fightCost: number; fightCostMode: 'static'; fightCostBase: number }> = {};
  for (const slot of slots) {
    if (slot === null) {
      hq.push(null);
    } else {
      hq.push(slot[0]);
      cardStats[slot[0]] = { attack: 0, recruit: 0, cost: slot[1], fightCost: 0, fightCostMode: 'static', fightCostBase: 0 };
    }
  }
  return { hq, cardStats } as unknown as LegendaryGameState;
}

describe('computeDayNight (WP-765 / D-24598)', () => {
  it('returns moonlight when most HQ Heroes have odd printed costs', () => {
    const G = makeDayNightState([['h1', 3], ['h2', 5], ['h3', 7], ['h4', 2], ['h5', 4]]);
    assert.equal(computeDayNight(G), 'moonlight');
  });

  it('returns sunlight when most HQ Heroes have even printed costs', () => {
    const G = makeDayNightState([['h1', 2], ['h2', 4], ['h3', 6], ['h4', 3], ['h5', 0]]);
    assert.equal(computeDayNight(G), 'sunlight', 'a 0 cost is even');
  });

  it('returns neither on a tie', () => {
    const G = makeDayNightState([['h1', 2], ['h2', 3], null, ['h4', 4], ['h5', 5]]);
    assert.equal(computeDayNight(G), 'neither');
  });

  it('returns neither for an empty HQ', () => {
    const G = makeDayNightState([null, null, null, null, null]);
    assert.equal(computeDayNight(G), 'neither');
  });

  it('skips null slots when counting', () => {
    const G = makeDayNightState([null, ['h2', 3], null, null, null]);
    assert.equal(computeDayNight(G), 'moonlight', 'one odd Hero and four empty slots is Moonlight');
  });

  it('reads only the printed cardStats cost (runtime cost modifiers are ignored)', () => {
    const G = makeDayNightState([['h1', 3], ['h2', 5], ['h3', 4]]);
    // why: a runtime cost modifier would live elsewhere on G; the helper must read
    // only the printed cardStats cost, so an unrelated field changes nothing.
    (G as unknown as { hqCostModifiers: Record<string, number> }).hqCostModifiers = { h1: -1, h2: -1 };
    assert.equal(computeDayNight(G), 'moonlight');
  });

  it('skips an HQ card with no cardStats row', () => {
    const G = makeDayNightState([['h1', 2]]);
    (G.hq as unknown as (string | null)[]).push('unknown-card');
    assert.equal(computeDayNight(G), 'sunlight');
  });

  it('returns neither (never throws) when hq or cardStats is absent', () => {
    assert.equal(computeDayNight({} as LegendaryGameState), 'neither');
    assert.equal(computeDayNight({ hq: ['h1'] } as unknown as LegendaryGameState), 'neither');
    assert.equal(computeDayNight({ cardStats: {} } as unknown as LegendaryGameState), 'neither');
  });
});

/**
 * Tests for resolveFightCost (WP-214).
 *
 * Covers static and dynamic fight cost resolution, edge cases, and
 * backward compatibility with pre-WP-214 static villains.
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { resolveFightCost } from './economy.resolve.js';
import { KILLBOT_TWISTS_NEXT_TO_SCHEME } from '../types.js';

/**
 * Builds a minimal G suitable for resolveFightCost tests.
 */
function makeG(options: {
  cardStats?: Record<string, { fightCost: number; fightCostMode: 'static' | 'dynamic'; fightCostBase: number; cost?: number }>;
  villainAttachedHeroes?: Record<string, CardExtId[]>;
}): LegendaryGameState {
  return {
    cardStats: options.cardStats ?? {},
    villainAttachedHeroes: options.villainAttachedHeroes ?? {},
  } as unknown as LegendaryGameState;
}

// ---------------------------------------------------------------------------
// Static villains
// ---------------------------------------------------------------------------

describe('resolveFightCost — static villain', () => {
  it('returns fightCost directly for static villain', () => {
    const G = makeG({
      cardStats: {
        'villain-a': { fightCost: 7, fightCostMode: 'static', fightCostBase: 0 },
      },
    });
    assert.equal(resolveFightCost(G, 'villain-a' as CardExtId), 7);
  });

  it('returns 0 when cardStats entry is missing', () => {
    const G = makeG({ cardStats: {} });
    assert.equal(resolveFightCost(G, 'no-entry' as CardExtId), 0);
  });

  it('static villain is unaffected by any attached heroes (backward compat)', () => {
    const G = makeG({
      cardStats: {
        'villain-static': { fightCost: 5, fightCostMode: 'static', fightCostBase: 0, cost: 0 },
        'hero-1': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 4 },
      },
      villainAttachedHeroes: { 'villain-static': ['hero-1' as CardExtId] },
    });
    assert.equal(resolveFightCost(G, 'villain-static' as CardExtId), 5);
  });
});

// ---------------------------------------------------------------------------
// Dynamic villains — vAttack: "*"
// ---------------------------------------------------------------------------

describe('resolveFightCost — dynamic villain (vAttack: "*")', () => {
  it('returns captured hero recruit cost for vAttack "*" with one hero', () => {
    const G = makeG({
      cardStats: {
        'villain-skrull': { fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 0, cost: 0 },
        'hero-spider-man': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 5 },
      },
      villainAttachedHeroes: { 'villain-skrull': ['hero-spider-man' as CardExtId] },
    });
    assert.equal(resolveFightCost(G, 'villain-skrull' as CardExtId), 5);
  });

  it('returns 0 for vAttack "*" with no captured heroes', () => {
    const G = makeG({
      cardStats: {
        'villain-skrull': { fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 0, cost: 0 },
      },
      villainAttachedHeroes: {},
    });
    assert.equal(resolveFightCost(G, 'villain-skrull' as CardExtId), 0);
  });

  it('guards undefined villainAttachedHeroes entry (returns 0, not NaN)', () => {
    const G = makeG({
      cardStats: {
        'villain-skrull': { fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 0, cost: 0 },
      },
      // villainAttachedHeroes has no entry for villain-skrull
    });
    const cost = resolveFightCost(G, 'villain-skrull' as CardExtId);
    assert.equal(cost, 0);
    assert.ok(Number.isFinite(cost));
  });
});

// ---------------------------------------------------------------------------
// Dynamic villains — vAttack: "N+"
// ---------------------------------------------------------------------------

describe('resolveFightCost — dynamic villain (vAttack: "N+")', () => {
  it('returns base + captured hero cost for vAttack "N+"', () => {
    const G = makeG({
      cardStats: {
        'villain-np': { fightCost: 4, fightCostMode: 'dynamic', fightCostBase: 4, cost: 0 },
        'hero-a': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 3 },
      },
      villainAttachedHeroes: { 'villain-np': ['hero-a' as CardExtId] },
    });
    assert.equal(resolveFightCost(G, 'villain-np' as CardExtId), 7);
  });

  it('returns base when no heroes captured (vAttack "N+" with empty)', () => {
    const G = makeG({
      cardStats: {
        'villain-np': { fightCost: 4, fightCostMode: 'dynamic', fightCostBase: 4, cost: 0 },
      },
    });
    assert.equal(resolveFightCost(G, 'villain-np' as CardExtId), 4);
  });
});

// ---------------------------------------------------------------------------
// Dynamic villains — multiple captured heroes
// ---------------------------------------------------------------------------

describe('resolveFightCost — multiple captured heroes', () => {
  it('sums recruit costs of all captured heroes', () => {
    const G = makeG({
      cardStats: {
        'villain-skrull': { fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 0, cost: 0 },
        'hero-1': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 3 },
        'hero-2': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 5 },
        'hero-3': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 2 },
      },
      villainAttachedHeroes: {
        'villain-skrull': ['hero-1' as CardExtId, 'hero-2' as CardExtId, 'hero-3' as CardExtId],
      },
    });
    assert.equal(resolveFightCost(G, 'villain-skrull' as CardExtId), 10);
  });

  it('treats missing cardStats for a captured hero as 0 (no NaN)', () => {
    const G = makeG({
      cardStats: {
        'villain-skrull': { fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 0, cost: 0 },
        'hero-known': { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 4 },
        // hero-unknown has no entry
      },
      villainAttachedHeroes: {
        'villain-skrull': ['hero-known' as CardExtId, 'hero-unknown' as CardExtId],
      },
    });
    const cost = resolveFightCost(G, 'villain-skrull' as CardExtId);
    assert.equal(cost, 4);
    assert.ok(Number.isFinite(cost));
  });
});

// ---------------------------------------------------------------------------
// Converted Killbot villains (WP-513 / D-24325) — attack = twist counter
// ---------------------------------------------------------------------------

describe('resolveFightCost — converted Killbot villain', () => {
  /** A G where `killbotId` is a converted Killbot and the twist counter = `count`. */
  function makeKillbotG(killbotId: string, count: number): LegendaryGameState {
    return {
      cardStats: {}, // converted bystanders have NO cardStats row — overlay-first must win
      villainAttachedHeroes: {},
      convertedVillainOrigins: { [killbotId]: 'killbot' },
      counters: { [KILLBOT_TWISTS_NEXT_TO_SCHEME]: count },
    } as unknown as LegendaryGameState;
  }

  it('resolves attack = the per-scheme twist counter (overlay-first, no cardStats row)', () => {
    const G = makeKillbotG('bystander-villain-deck-00', 3);
    assert.equal(resolveFightCost(G, 'bystander-villain-deck-00' as CardExtId), 3);
  });

  it('scales with the counter — 3 at setup, 8 after five Killbots twists', () => {
    const G = makeKillbotG('bystander-villain-deck-00', 8);
    assert.equal(resolveFightCost(G, 'bystander-villain-deck-00' as CardExtId), 8);
  });

  it('a non-converted card falls through to the normal cardStats path (0 when absent)', () => {
    const G = makeKillbotG('bystander-villain-deck-00', 5);
    // 'other-villain' has no origin and no cardStats → the pre-existing 0 fallback.
    assert.equal(resolveFightCost(G, 'other-villain' as CardExtId), 0);
  });
});

// ---------------------------------------------------------------------------
// Converted Skrull villains (WP-514 / D-24327) — attack = Hero cost + 2 (PROXY)
// ---------------------------------------------------------------------------

describe('resolveFightCost — converted Skrull villain', () => {
  /** A G where `skrullId` is a converted Skrull whose Hero cost is `cost`. */
  function makeSkrullG(skrullId: string, cost: number): LegendaryGameState {
    return {
      // a converted Hero DOES have a cardStats row (heroes carry cost); the skrull
      // attack reads that cost + 2 (a documented proxy for the printed VP + 2).
      cardStats: {
        [skrullId]: { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost },
      },
      villainAttachedHeroes: {},
      convertedVillainOrigins: { [skrullId]: 'skrull' },
      counters: {},
    } as unknown as LegendaryGameState;
  }

  it('resolves attack = the Hero cost + 2 (overlay-first)', () => {
    const G = makeSkrullG('core/x-men/cyclops-determination-00', 2);
    assert.equal(resolveFightCost(G, 'core/x-men/cyclops-determination-00' as CardExtId), 4);
  });

  it('a 6-cost Hero Skrull attacks for 8', () => {
    const G = makeSkrullG('core/x-men/wolverine-berserker-rage-00', 6);
    assert.equal(resolveFightCost(G, 'core/x-men/wolverine-berserker-rage-00' as CardExtId), 8);
  });

  it('a 0-cost / missing-cost Skrull attacks for 2 (no NaN)', () => {
    const G = makeSkrullG('hero-no-cost', 0);
    const cost = resolveFightCost(G, 'hero-no-cost' as CardExtId);
    assert.equal(cost, 2);
    assert.ok(Number.isFinite(cost));
  });

  it('a non-converted villain is unaffected by the skrull branch', () => {
    const G = makeSkrullG('hero-a', 3);
    // 'plain-villain' has no origin and no cardStats → the pre-existing 0 fallback.
    assert.equal(resolveFightCost(G, 'plain-villain' as CardExtId), 0);
  });
});

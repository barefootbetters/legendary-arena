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
import {
  resolveFightCost,
  resolveMastermindFightCost,
  darkPortalLocations,
  DARK_PORTAL_ATTACK_BONUS,
} from './economy.resolve.js';
import { KILLBOT_TWISTS_NEXT_TO_SCHEME, DARK_PORTAL_COUNT } from '../types.js';

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

// ---------------------------------------------------------------------------
// Portals Dark-Portal villain buff (WP-539 / D-24348)
// ---------------------------------------------------------------------------

describe('resolveFightCost — Portals Dark-Portal villain buff', () => {
  const PORTALS = 'core/portals-to-the-dark-dimension';

  /** A G under `schemeId` with `villainId` at `cityIndex` (-1 = not in city) and `count` Dark Portals. */
  function makePortalsG(
    schemeId: string,
    villainId: string,
    cityIndex: number,
    count: number,
    fightCost = 3,
  ): LegendaryGameState {
    const city: (string | null)[] = [null, null, null, null, null];
    if (cityIndex >= 0) city[cityIndex] = villainId;
    return {
      cardStats: { [villainId]: { fightCost, fightCostMode: 'static', fightCostBase: 0 } },
      villainAttachedHeroes: {},
      selection: { schemeId },
      city,
      counters: { [DARK_PORTAL_COUNT]: count },
    } as unknown as LegendaryGameState;
  }

  it("adds +1 to a villain in a portal'd city space (leftmost=Bridge=index 4 at count 2)", () => {
    // space index 4 is portal'd once count >= 6 - 4 = 2.
    assert.equal(resolveFightCost(makePortalsG(PORTALS, 'v', 4, 2), 'v' as CardExtId), 4);
  });

  it("no bonus for an unportal'd space (index 4 at count 1 = the Mastermind portal only)", () => {
    assert.equal(resolveFightCost(makePortalsG(PORTALS, 'v', 4, 1), 'v' as CardExtId), 3);
  });

  it("the entry space (Sewers, index 0) is portal'd only at count 6", () => {
    assert.equal(resolveFightCost(makePortalsG(PORTALS, 'v', 0, 5), 'v' as CardExtId), 3);
    assert.equal(resolveFightCost(makePortalsG(PORTALS, 'v', 0, 6), 'v' as CardExtId), 4);
  });

  it('applies no bonus under a non-Portals scheme', () => {
    assert.equal(resolveFightCost(makePortalsG('core/midtown-bank-robbery', 'v', 4, 2), 'v' as CardExtId), 3);
  });

  it('applies no bonus to a villain not in the city', () => {
    assert.equal(resolveFightCost(makePortalsG(PORTALS, 'v', -1, 6), 'v' as CardExtId), 3);
  });
});

// ---------------------------------------------------------------------------
// resolveMastermindFightCost (WP-539 / D-24348)
// ---------------------------------------------------------------------------

describe('resolveMastermindFightCost', () => {
  const PORTALS = 'core/portals-to-the-dark-dimension';

  function makeMastermindG(schemeId: string, count: number, baseFightCost = 7): LegendaryGameState {
    return {
      cardStats: { 'mm-base': { fightCost: baseFightCost, fightCostMode: 'static', fightCostBase: 0 } },
      mastermind: { baseCardId: 'mm-base' },
      selection: { schemeId },
      counters: { [DARK_PORTAL_COUNT]: count },
    } as unknown as LegendaryGameState;
  }

  it('returns the base fightCost when the scheme is not Portals', () => {
    assert.equal(resolveMastermindFightCost(makeMastermindG('core/midtown-bank-robbery', 3)), 7);
  });

  it('returns base when Portals but no Dark Portal placed yet (count 0)', () => {
    assert.equal(resolveMastermindFightCost(makeMastermindG(PORTALS, 0)), 7);
  });

  it('returns base + 1 once the twist-1 Mastermind portal is placed, not stacking', () => {
    assert.equal(resolveMastermindFightCost(makeMastermindG(PORTALS, 1)), 8);
    assert.equal(resolveMastermindFightCost(makeMastermindG(PORTALS, 6)), 8);
  });
});

// ---------------------------------------------------------------------------
// darkPortalLocations — the single-source portal→location mapping (WP-728 / D-24549)
// ---------------------------------------------------------------------------

describe('darkPortalLocations (WP-728 / D-24549)', () => {
  const PORTALS = 'core/portals-to-the-dark-dimension';

  /** A G under `schemeId` with `count` Dark Portals placed. */
  function makeLocationsG(schemeId: string, count: number): LegendaryGameState {
    return {
      selection: { schemeId },
      counters: { [DARK_PORTAL_COUNT]: count },
    } as unknown as LegendaryGameState;
  }

  it('yields no portals for a non-Portals scheme, whatever the counter', () => {
    assert.deepEqual(darkPortalLocations(makeLocationsG('core/midtown-bank-robbery', 6)), {
      onMastermind: false,
      citySpaceIndices: [],
    });
  });

  it('yields no portals under Portals before the first twist (count 0)', () => {
    assert.deepEqual(darkPortalLocations(makeLocationsG(PORTALS, 0)), {
      onMastermind: false,
      citySpaceIndices: [],
    });
  });

  it('opens only the Mastermind portal at count 1 (twist 1)', () => {
    assert.deepEqual(darkPortalLocations(makeLocationsG(PORTALS, 1)), {
      onMastermind: true,
      citySpaceIndices: [],
    });
  });

  it('fills the leftmost city space (Bridge = index 4) first, at count 2', () => {
    assert.deepEqual(darkPortalLocations(makeLocationsG(PORTALS, 2)), {
      onMastermind: true,
      citySpaceIndices: [4],
    });
  });

  it('fills every city space by count 6, ascending (Sewers 0 … Bridge 4)', () => {
    assert.deepEqual(darkPortalLocations(makeLocationsG(PORTALS, 6)), {
      onMastermind: true,
      citySpaceIndices: [0, 1, 2, 3, 4],
    });
  });

  it('tolerates a partial G (missing selection/counters) as no portals', () => {
    assert.deepEqual(darkPortalLocations({} as unknown as LegendaryGameState), {
      onMastermind: false,
      citySpaceIndices: [],
    });
  });
});

describe('DARK_PORTAL_ATTACK_BONUS (WP-728 / D-24549)', () => {
  // why: the single-source bonus value — combat and the UIState projection both
  // read it, so it must stay 1 (WP-539's printed Dark-Portal buff) or every
  // portal'd fight requirement and the board overlay shift together.
  it('is 1 (the printed Dark-Portal +1 attack)', () => {
    assert.equal(DARK_PORTAL_ATTACK_BONUS, 1);
  });
});

// ---------------------------------------------------------------------------
// Midtown Bank Robbery family — +1 attack per Bystander a Villain has (WP-748 / D-24572)
// ---------------------------------------------------------------------------

describe('resolveFightCost — Midtown Bank Robbery family Bystander bonus (WP-748)', () => {
  const MIDTOWN = 'core/midtown-bank-robbery';
  const FAMILY_SCHEME_IDS = [
    MIDTOWN,
    'co2e/bank-robbery-hostage-crisis',
    'msp1/destroy-the-cities-of-earth',
  ];

  /** A G under `schemeId` with static villain `v` (cost 3) holding `bystanderCount` Bystanders. */
  function makeBystanderG(schemeId: string, bystanderCount: number): LegendaryGameState {
    const bystanders: CardExtId[] = [];
    for (let index = 0; index < bystanderCount; index++) {
      bystanders.push(`bystander-${index}` as CardExtId);
    }
    return {
      cardStats: { v: { fightCost: 3, fightCostMode: 'static', fightCostBase: 0 } },
      villainAttachedHeroes: {},
      selection: { schemeId },
      city: [null, null, null, null, 'v'],
      counters: {},
      attachedBystanders: { v: bystanders },
    } as unknown as LegendaryGameState;
  }

  it('Midtown: a 3-cost villain holding 2 Bystanders costs 5; holding none, 3', () => {
    assert.equal(resolveFightCost(makeBystanderG(MIDTOWN, 2), 'v' as CardExtId), 5);
    assert.equal(resolveFightCost(makeBystanderG(MIDTOWN, 0), 'v' as CardExtId), 3);
  });

  it('every family scheme (core, co2e, msp1) applies +1 per Bystander', () => {
    for (const schemeId of FAMILY_SCHEME_IDS) {
      assert.equal(
        resolveFightCost(makeBystanderG(schemeId, 3), 'v' as CardExtId),
        6,
        `${schemeId} must add +1 per attached Bystander`,
      );
    }
  });

  it('a non-family scheme adds nothing for attached Bystanders', () => {
    assert.equal(resolveFightCost(makeBystanderG('core/legacy-virus-the', 2), 'v' as CardExtId), 3);
  });

  it('stacks on a dynamic N+ villain: base + captured hero cost + Bystanders', () => {
    const gameState = {
      cardStats: {
        v: { fightCost: 0, fightCostMode: 'dynamic', fightCostBase: 2 },
        hero: { fightCost: 0, fightCostMode: 'static', fightCostBase: 0, cost: 4 },
      },
      villainAttachedHeroes: { v: ['hero'] },
      selection: { schemeId: MIDTOWN },
      city: [null, null, null, null, 'v'],
      counters: {},
      attachedBystanders: { v: ['bystander-0'] },
    } as unknown as LegendaryGameState;
    assert.equal(resolveFightCost(gameState, 'v' as CardExtId), 2 + 4 + 1);
  });

  it('a G with no attachedBystanders map resolves to the base under Midtown (no throw)', () => {
    const gameState = {
      cardStats: { v: { fightCost: 3, fightCostMode: 'static', fightCostBase: 0 } },
      villainAttachedHeroes: {},
      selection: { schemeId: MIDTOWN },
      city: [null, null, null, null, 'v'],
      counters: {},
    } as unknown as LegendaryGameState;
    assert.equal(resolveFightCost(gameState, 'v' as CardExtId), 3);
  });

  it('Mastermind isolation: Bystanders under its key never change resolveMastermindFightCost', () => {
    function makeMidtownMastermindG(bystandersUnderMastermind: CardExtId[]): LegendaryGameState {
      return {
        cardStats: { 'mm-base': { fightCost: 7, fightCostMode: 'static', fightCostBase: 0 } },
        mastermind: { baseCardId: 'mm-base' },
        selection: { schemeId: MIDTOWN },
        counters: {},
        attachedBystanders: { 'mm-base': bystandersUnderMastermind },
      } as unknown as LegendaryGameState;
    }
    const withBystanders = resolveMastermindFightCost(
      makeMidtownMastermindG(['bystander-0', 'bystander-1'] as CardExtId[]),
    );
    const withoutBystanders = resolveMastermindFightCost(makeMidtownMastermindG([]));
    assert.equal(withBystanders, withoutBystanders);
    assert.equal(withBystanders, 7);
  });
});

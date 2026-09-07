/**
 * Diamond Form over-fire fix (WP-656 / D-24467).
 *
 * "Whenever you defeat a Villain or Mastermind this turn, you get +3 Recruit."
 * Formerly parsed to a flat unconditional onPlay recruit:3 (a +3 on play, with or
 * without a defeat). These tests pin the corrected behaviour: the +3 fires once per
 * qualifying defeat this turn (edge-triggered) and NOT on play. The fight sites that
 * set the defeat signal are covered in fightVillain.test.ts / fightMastermind.test.ts;
 * here the signal is set directly to exercise the resolution economics.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recordDeferredConditionalGrant } from './deferredConditionalGrants.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from './heroEffects.execute.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const mockCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/** Minimal state with Diamond Form in play and the supplied hooks. */
function makeState(hooks: HeroAbilityHook[]): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), inPlay: ['diamond-form'] } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    heroAbilityHooks: hooks,
    cardTraits: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

// Diamond Form: +3 recruit gated on the new edge-triggered defeat condition.
const DIAMOND_HOOK = [
  {
    cardId: 'diamond-form',
    timing: 'onPlay',
    keywords: ['recruit', 'conditional'],
    conditions: [{ type: 'defeatedVillainOrMastermindThisTurn', value: '1' }],
    effects: [{ type: 'recruit', magnitude: 3 }],
  },
] as unknown as HeroAbilityHook[];

/** Simulates a fight-site defeat: sets the edge flag gated on a pending grant. */
function signalDefeat(G: LegendaryGameState): void {
  if (G.deferredConditionalGrants !== undefined && G.deferredConditionalGrants.length > 0) {
    G.villainOrMastermindDefeatedSinceResolve = true;
  }
}

describe('Diamond Form over-fire fix (WP-656 / D-24467)', () => {
  it('AC-1 / NEGATIVE: playing Diamond Form with no defeat grants 0 (the flat +3 on play is gone)', () => {
    const G = makeState(DIAMOND_HOOK);
    executeHeroEffects(G, mockCtx, '0', 'diamond-form');

    assert.equal(G.turnEconomy.recruit, 0, 'no free +3 Recruit on play');
    assert.equal(G.deferredConditionalGrants?.length, 1, 'the ability is waiting, not fired');
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting/);

    // A whole turn of non-defeat resolutions still grants nothing.
    resolveDeferredHeroGrants(G, mockCtx);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 0, 'no defeat all turn -> still 0');
  });

  it('AC-2: defeating one Villain grants +3', () => {
    const G = makeState(DIAMOND_HOOK);
    executeHeroEffects(G, mockCtx, '0', 'diamond-form');

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 3, 'one qualifying defeat -> +3');
    assert.match(G.messages[G.messages.length - 1]!.text, /applied/);
  });

  it('AC-4: edge-triggered per defeat — defeat -> recruit -> defeat -> play grants EXACTLY +6', () => {
    const G = makeState(DIAMOND_HOOK);
    executeHeroEffects(G, mockCtx, '0', 'diamond-form');

    // Move 1: fightVillain (defeat 1)
    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 3, 'defeat 1 -> +3');

    // Move 2: recruit (non-defeat) — must NOT re-fire (edge, not sticky)
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 3, 'a non-defeat move between defeats grants nothing');

    // Move 3: fightVillain (defeat 2)
    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 6, 'defeat 2 -> +3 (repeatable, not a one-shot)');

    // Move 4: play (non-defeat, trailing) — must NOT re-fire
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 6, 'no trailing +3 after the last defeat — +6, not +9');
  });

  it('AC-5: the grant does NOT carry into the next turn', () => {
    const G = makeState(DIAMOND_HOOK);
    executeHeroEffects(G, mockCtx, '0', 'diamond-form');

    // Turn boundary clear (game.ts onBegin does this beside clearDeferredConditionalGrants).
    delete G.deferredConditionalGrants;
    delete G.villainOrMastermindDefeatedSinceResolve;

    // A defeat next turn without Diamond Form re-played grants nothing.
    G.villainOrMastermindDefeatedSinceResolve = true;
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 0, 'a defeat next turn without a pending grant grants nothing');
  });

  it('multi-copy: two Diamond Forms each fire per defeat (+12 over two defeats)', () => {
    const G = makeState(DIAMOND_HOOK);
    recordDeferredConditionalGrant(G, '0', 'diamond-form', 0);
    recordDeferredConditionalGrant(G, '0', 'diamond-form', 0);

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 6, 'two copies each fire on defeat 1');

    resolveDeferredHeroGrants(G, mockCtx); // non-defeat move
    assert.equal(G.turnEconomy.recruit, 6);

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 12, 'two copies each fire again on defeat 2');
  });

  it('AC-7: the condition never throws on malformed / absent state', () => {
    // A game with a pending grant but no economy/flag set must resolve to a safe no-op.
    const G = makeState(DIAMOND_HOOK);
    recordDeferredConditionalGrant(G, '0', 'diamond-form', 0);
    assert.doesNotThrow(() => resolveDeferredHeroGrants(G, mockCtx));
    assert.equal(G.turnEconomy.recruit, 0, 'no flag -> safe no-op, no grant');
  });
});

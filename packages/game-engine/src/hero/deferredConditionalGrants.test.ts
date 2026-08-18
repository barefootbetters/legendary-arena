/**
 * Tests for the wait-and-see window on numeric-threshold hero conditions
 * (WP-568 / D-24377).
 *
 * Covers the deferral record, the per-move re-check, idempotence, the turn-boundary
 * clear, the deliberate scope boundary (class/team gates stay on-play), and the
 * lazy-field absence that keeps both sentinel oracles byte-unchanged.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAIT_AND_SEE_CONDITION_TYPES,
  isWaitAndSeeCondition,
  recordDeferredConditionalGrant,
  clearDeferredConditionalGrants,
  resolveDeferredConditionalGrants,
} from './deferredConditionalGrants.js';
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

/**
 * Minimal state carrying the supplied hooks and one card in play.
 *
 * @param hooks - The hero ability hooks for the state.
 * @param recruit - Gross recruit made this turn.
 * @returns A minimal LegendaryGameState.
 */
function makeState(hooks: HeroAbilityHook[], recruit = 0): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: { ...makeTurnEconomy(), recruit },
    playerZones: { '0': { ...makePlayerZones(), inPlay: ['hero-x'] } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    heroAbilityHooks: hooks,
    cardTraits: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const RECRUIT_HOOK = [
  {
    cardId: 'hero-x',
    timing: 'onPlay',
    keywords: ['attack'],
    conditions: [{ type: 'recruitMadeThisTurnAtLeast', value: '8' }],
    effects: [{ type: 'attack', magnitude: 3 }],
  },
] as unknown as HeroAbilityHook[];

describe('wait-and-see scope (WP-568 / D-24377 section 1)', () => {
  it('covers exactly the two NUMERIC-THRESHOLD condition types', () => {
    assert.deepEqual([...WAIT_AND_SEE_CONDITION_TYPES], [
      'recruitMadeThisTurnAtLeast',
      'distinctHeroClassesAtLeast',
    ]);
  });

  it('AC-5: heroClassMatch and requiresTeam stay ON-PLAY', () => {
    // why: an OPERATOR exclusion, not an oversight. All four live types are "this
    // turn" scoped in substance (the class gates read inPlay, which clears each
    // turn); converting them would change every [hc:X] card in the game and remove
    // play-ordering skill from class synergy.
    assert.equal(isWaitAndSeeCondition({ type: 'heroClassMatch', value: 'tech' }), false);
    assert.equal(isWaitAndSeeCondition({ type: 'requiresTeam', value: 'x-men' }), false);
    assert.equal(isWaitAndSeeCondition({ type: 'recruitMadeThisTurnAtLeast', value: '8' }), true);
    assert.equal(isWaitAndSeeCondition({ type: 'distinctHeroClassesAtLeast', value: '3' }), true);
  });
});

describe('the lazy G field (WP-568 / D-24377 section 6)', () => {
  it('AC-7: absent on a game where nothing defers', () => {
    // why: laziness is what keeps BOTH sentinel oracles byte-unchanged. A field
    // written unconditionally would re-pin every committed fixture.
    const G = makeState([]);
    assert.equal(G.deferredConditionalGrants, undefined);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.deferredConditionalGrants, undefined);
  });

  it('materializes only on the first deferral, and clears back to absent', () => {
    const G = makeState([]);
    recordDeferredConditionalGrant(G, '0', 'hero-x', 0);
    assert.equal(G.deferredConditionalGrants?.length, 1);
    clearDeferredConditionalGrants(G);
    assert.equal(G.deferredConditionalGrants, undefined);
  });
});

describe('deferral and firing (WP-568)', () => {
  it('AC-1: a below-threshold play WAITS, then fires when the threshold is reached', () => {
    const G = makeState(RECRUIT_HOOK, 5);
    executeHeroEffects(G, mockCtx, '0', 'hero-x');

    assert.equal(G.turnEconomy.attack, 0, 'nothing granted at play time');
    assert.equal(G.deferredConditionalGrants?.length, 1, 'the gate deferred');
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting/);

    // the turn's recruit crosses the threshold on a later move
    G.turnEconomy.recruit = 9;
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.attack, 3, 'the +3 attack applied retroactively');
    assert.equal(G.deferredConditionalGrants, undefined, 'the entry was consumed');
    assert.match(G.messages[G.messages.length - 1]!.text, /applied/);
  });

  it('AC-2: never fires when the threshold is not reached', () => {
    const G = makeState(RECRUIT_HOOK, 5);
    executeHeroEffects(G, mockCtx, '0', 'hero-x');
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.deferredConditionalGrants?.length, 1, 'still waiting, not fired');
  });

  it('AC-3: IDEMPOTENCE — crossed, dropped, re-crossed grants exactly ONCE', () => {
    // why: the first test to write. The entry is removed as it fires, so a
    // threshold that oscillates within one turn cannot double-grant.
    const G = makeState(RECRUIT_HOOK, 5);
    executeHeroEffects(G, mockCtx, '0', 'hero-x');

    G.turnEconomy.recruit = 9;
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 3);

    G.turnEconomy.recruit = 2;
    resolveDeferredHeroGrants(G, mockCtx);
    G.turnEconomy.recruit = 12;
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.attack, 3, 'granted exactly once across the oscillation');
  });

  it('AC-4: a deferred grant does NOT survive into the next turn', () => {
    const G = makeState(RECRUIT_HOOK, 5);
    executeHeroEffects(G, mockCtx, '0', 'hero-x');
    assert.equal(G.deferredConditionalGrants?.length, 1);

    clearDeferredConditionalGrants(G); // the turn boundary
    G.turnEconomy.recruit = 12;
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.attack, 0, 'a threshold reached NEXT turn must not fire it');
  });

  it('a satisfied gate at play time never defers at all', () => {
    const G = makeState(RECRUIT_HOOK, 10);
    executeHeroEffects(G, mockCtx, '0', 'hero-x');
    assert.equal(G.turnEconomy.attack, 3, 'fired immediately');
    assert.equal(G.deferredConditionalGrants, undefined, 'nothing deferred');
  });
});

describe('resolveDeferredConditionalGrants ordering (WP-568)', () => {
  it('AC-10: fires in INSERTION order, stably', () => {
    const G = makeState([]);
    recordDeferredConditionalGrant(G, '0', 'card-a', 0);
    recordDeferredConditionalGrant(G, '0', 'card-b', 1);
    recordDeferredConditionalGrant(G, '0', 'card-c', 2);

    const fired: string[] = [];
    resolveDeferredConditionalGrants(G, () => true, (entry) => {
      fired.push(entry.cardId);
    });

    assert.deepEqual(fired, ['card-a', 'card-b', 'card-c']);
    assert.equal(G.deferredConditionalGrants, undefined);
  });

  it('keeps unfired entries and consumes only those that can fire', () => {
    const G = makeState([]);
    recordDeferredConditionalGrant(G, '0', 'ready', 0);
    recordDeferredConditionalGrant(G, '0', 'waiting', 1);

    resolveDeferredConditionalGrants(G, (entry) => entry.cardId === 'ready', () => {});

    assert.equal(G.deferredConditionalGrants?.length, 1);
    assert.equal(G.deferredConditionalGrants?.[0]!.cardId, 'waiting');
  });
});

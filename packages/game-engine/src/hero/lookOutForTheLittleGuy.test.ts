/**
 * Look Out for the Little Guy (amwp Ant-Man) reveals and draws (D-24806).
 *
 * Its second line reads "Reveal the top card of your deck. If it's [hc:strength] or has
 * [keyword:Size-Changing] draw it." Before D-24806 the parser read the line's Size-Changing token
 * as the card's own Size-Changing (D-24801), so the line built a second `size-changing` hook and
 * the reveal never ran. These tests build the REAL hooks from the committed data/cards/amwp.json
 * and play the card through the real hero executor.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { describeRevealPredicate } from './revealLog.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// amwpWaspSizeChanging.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const LOOK_OUT = 'amwp/ant-man/look-out-for-the-little-guy#0' as CardExtId;
const STRENGTH_TOP = 'test/hero/strength-top#0' as CardExtId;
const SIZE_CHANGING_TOP = 'test/hero/size-changing-top#0' as CardExtId;
const MICROSCOPIC_TOP = 'test/hero/microscopic-top#0' as CardExtId;
const PLAIN_TOP = 'test/hero/plain-top#0' as CardExtId;
const SECOND_CARD = 'test/hero/second-card#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real amwp Ant-Man hooks from the committed card data.
 *
 * @returns Every hook the hero deck produces.
 */
function buildAntManHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'amwp.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'amwp' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['amwp/ant-man'] } as unknown as MatchConfiguration);
}

/**
 * A two-seat state with Look Out for the Little Guy in play and the given deck top.
 *
 * @param deckTop - The card on top of player 0's deck.
 * @returns A LegendaryGameState sufficient for the hero executor.
 */
function makeState(deckTop: CardExtId): LegendaryGameState {
  const stat = makeCardStatEntry({ cost: 3 });
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), inPlay: [LOOK_OUT], deck: [deckTop, SECOND_CARD], hand: [] },
      '1': { ...makePlayerZones() },
    },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: buildAntManHooks(),
    villainAbilityHooks: [],
    cardStats: {
      [LOOK_OUT]: stat, [STRENGTH_TOP]: stat, [SIZE_CHANGING_TOP]: stat, [MICROSCOPIC_TOP]: stat,
      [PLAIN_TOP]: stat, [SECOND_CARD]: stat,
    },
    cardTraits: {
      [LOOK_OUT]: { heroClass: 'strength', team: null },
      [STRENGTH_TOP]: { heroClass: 'strength', team: null },
      [SIZE_CHANGING_TOP]: { heroClass: 'covert', team: null },
      [MICROSCOPIC_TOP]: { heroClass: 'tech', team: null },
      [PLAIN_TOP]: { heroClass: 'covert', team: null },
      [SECOND_CARD]: { heroClass: 'ranged', team: null },
    },
    cardSizeChangingClasses: { [LOOK_OUT]: ['strength'], [SIZE_CHANGING_TOP]: ['ranged'] },
    cardMicroscopicSizeChangingClasses: { [MICROSCOPIC_TOP]: ['tech', 'tech'] },
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

describe('Look Out for the Little Guy: "If it\'s [Strength] or has Size-Changing, draw it" (D-24806)', () => {
  it('line 2 parses to the reveal rule, not a second Size-Changing of the card', () => {
    const hooks = buildAntManHooks().filter((hook) => hook.cardId === LOOK_OUT);
    assert.equal(hooks.length, 2, 'two ability lines, two hooks');
    assert.deepStrictEqual(hooks[0]!.sizeChangingClasses, ['strength'], 'line 1 is the printed Size-Changing [Strength]');
    const revealHook = hooks[1]!;
    assert.deepStrictEqual(revealHook.keywords, ['reveal']);
    assert.deepStrictEqual(revealHook.effects, [{
      type: 'reveal',
      revealCount: 1,
      revealRules: [{ predicate: { kind: 'hero-class-or-size-changing', traitValue: 'strength' }, actions: [{ kind: 'draw' }] }],
    }]);
    assert.equal(revealHook.sizeChangingClasses, undefined, 'the Size-Changing token is the reveal criterion');
    assert.equal(revealHook.conditions, undefined, 'the [hc:strength] is the reveal criterion, not a play gate');
  });

  it('draws a revealed Strength card', () => {
    const G = makeState(STRENGTH_TOP);
    executeHeroEffects(G, mockCtx, '0', LOOK_OUT);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [STRENGTH_TOP]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [SECOND_CARD]);
  });

  it('draws a revealed non-Strength card that has Size-Changing', () => {
    const G = makeState(SIZE_CHANGING_TOP);
    executeHeroEffects(G, mockCtx, '0', LOOK_OUT);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [SIZE_CHANGING_TOP]);
  });

  it('draws a revealed card with Microscopic Size-Changing (a type of Size-Changing, rules v23 p.30)', () => {
    const G = makeState(MICROSCOPIC_TOP);
    executeHeroEffects(G, mockCtx, '0', LOOK_OUT);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [MICROSCOPIC_TOP]);
  });

  it('leaves any other revealed card on top of the deck', () => {
    const G = makeState(PLAIN_TOP);
    executeHeroEffects(G, mockCtx, '0', LOOK_OUT);
    assert.deepStrictEqual(G.playerZones['0']!.hand, []);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [PLAIN_TOP, SECOND_CARD], 'a non-match stays on top');
  });

  it('the reveal log names both halves of the criterion', () => {
    assert.equal(
      describeRevealPredicate({ kind: 'hero-class-or-size-changing', traitValue: 'strength' }),
      'a strength card or a card with Size-Changing',
    );
  });
});

/**
 * "The first time that one of your Heroes … is KO'd this turn" — Doctor Voodoo's Possessed by
 * Brother's Spirit (WP-856 / D-24792).
 *
 * The printed line was parsed to a flat on-play +4 Recruit AND +4 Attack (a phantom on every
 * play). These tests build the REAL hooks from the committed data/cards/dstr.json (and
 * dkcy.json for Bishop's Whatever the Cost / Absorb Energies), drive the real KO sites, and
 * resolve through resolveDeferredHeroGrants, so they pin the parse, the Hero-only owner signal,
 * the one-shot firing and the +4 Recruit / +4 Attack choose-one together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from './heroEffects.execute.js';
import { OWNED_HERO_KOED_CONDITION_TYPE } from './heroConditions.evaluate.js';
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { resolveKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { resolveCountScaledChoice } from '../moves/countScaledChoice.resolve.js';
import { healWounds } from '../moves/healWounds.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const POSSESSED = 'dstr/doctor-voodoo/posessed-by-brothers-spirit#0' as CardExtId;
const OTHER_COVERT = 'test/covert-hero/sneak#0' as CardExtId;
const PLAIN_HERO = 'test/plain-hero/punch#0' as CardExtId;
const COVERT_ONE = 'test/covert-hero/one#0' as CardExtId;
const COVERT_TWO = 'test/covert-hero/two#0' as CardExtId;
const COVERT_THREE = 'test/covert-hero/three#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for Doctor Voodoo and Bishop from the committed card data.
 *
 * @returns Every hook the two hero decks produce.
 */
function buildHooks(): HeroAbilityHook[] {
  const sets: Record<string, unknown> = {
    dstr: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'dstr.json'), 'utf8')),
    dkcy: JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'dkcy.json'), 'utf8')),
  };
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildHeroAbilityHooks(
    registry,
    { heroDeckIds: ['dstr/doctor-voodoo', 'dkcy/bishop'] } as unknown as MatchConfiguration,
  );
}

/**
 * A two-seat state wide enough for the hero executor, the KO moves, the Red Skull strike and a
 * villain Fight effect.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[]): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'core/red-skull',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['dstr/doctor-voodoo', 'dkcy/bishop'],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'core/red-skull',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['dstr/doctor-voodoo', 'dkcy/bishop'],
    },
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
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
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
    cardStats: {},
    cardTraits: {
      [OTHER_COVERT]: { heroClass: 'covert' },
      [COVERT_ONE]: { heroClass: 'covert' },
      [COVERT_TWO]: { heroClass: 'covert' },
      [COVERT_THREE]: { heroClass: 'covert' },
    },
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card for player 0: puts it in play and runs its hooks.
 *
 * @param G - The game state.
 * @param cardId - The card to play.
 */
function playCard(G: LegendaryGameState, cardId: CardExtId): void {
  G.playerZones['0']!.inPlay.push(cardId);
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * The move context a KO or choice move reads.
 *
 * @param G - The game state.
 * @param playerID - The acting player.
 * @returns A move context.
 */
function moveContext(G: LegendaryGameState, playerID: string): never {
  return { G, playerID, ctx: { ...mockCtx.ctx, currentPlayer: playerID }, random: mockCtx.random } as never;
}

/**
 * KOs one of player 0's Heroes from the discard pile through the real KO-from-discard move.
 *
 * @param G - The game state.
 * @param cardId - The Hero in the discard pile to KO.
 */
function koFromDiscard(G: LegendaryGameState, cardId: CardExtId): void {
  G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }];
  resolveKoDiscardChoice(moveContext(G, '0'), { cardIds: [cardId] });
}

describe('Possessed by Brother\'s Spirit parse (WP-856 / D-24792)', () => {
  it('the copy carries the Hero-KO condition and only the gated choose-one', () => {
    const hook = buildHooks().find((candidate) => candidate.cardId === POSSESSED);
    assert.ok(hook !== undefined, 'the dstr data builds a hook for the card');
    assert.deepEqual(hook.conditions, [{ type: OWNED_HERO_KOED_CONDITION_TYPE, value: '1' }]);
    assert.deepEqual(hook.effects, [{
      type: 'count-scaled-choose',
      countScaledChoiceOptions: [{ kind: 'flat-recruit', magnitude: 4 }, { kind: 'flat-attack', magnitude: 4 }],
    }], 'no unconditional recruit or attack');
  });
});

describe('Possessed by Brother\'s Spirit play and first-Hero-KO grant (WP-856 / D-24792)', () => {
  it('AC-1: playing it gives 0 Recruit, 0 Attack and logs the waiting line', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);

    assert.equal(G.turnEconomy.recruit, 0);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.deferredConditionalGrants?.length, 1);
    assert.match(
      G.messages[G.messages.length - 1]!.text,
      /ability is waiting — it needs a Hero of yours to be KO'd this turn\. It will apply if you reach it this turn\.$/,
    );

    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingCountScaledChoice, undefined, 'a move with no KO parks nothing');
  });

  it('AC-2: Whatever the Cost\'s KO through resolveOptionalKoReward parks the +4 / +4 choice', () => {
    const hooks = buildHooks();
    const G = makeState(hooks);
    G.playerZones['0']!.inPlay.push(OTHER_COVERT);
    playCard(G, POSSESSED);
    G.playerZones['0']!.hand.push(PLAIN_HERO);
    playCard(G, 'dkcy/bishop/whatever-the-cost#0' as CardExtId);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingOptionalKoRewards?.length, 1, 'Whatever the Cost parks its optional KO');

    resolveOptionalKoReward(moveContext(G, '0'), { zone: 'hand', cardId: PLAIN_HERO });
    assert.deepEqual(G.ownedHeroesKoedSinceResolve, { '0': 1 }, 'the KO site records the Hero for its owner');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.pendingCountScaledChoice?.length, 1);
    assert.deepEqual(G.pendingCountScaledChoice![0], {
      playerID: '0',
      cardId: POSSESSED,
      options: [{ kind: 'flat-recruit', magnitude: 4 }, { kind: 'flat-attack', magnitude: 4 }],
    });
    assert.equal(Object.hasOwn(G, 'ownedHeroesKoedSinceResolve'), false, 'the count is consumed');
  });

  it('AC-2: choosing option 0 gives exactly +4 Recruit', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    G.playerZones['0']!.discard.push(PLAIN_HERO);
    koFromDiscard(G, PLAIN_HERO);
    resolveDeferredHeroGrants(G, mockCtx);

    resolveCountScaledChoice(moveContext(G, '0'), { optionIndex: 0 });

    assert.equal(G.turnEconomy.recruit, 4);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.pendingCountScaledChoice?.length ?? 0, 0, 'the choice is answered');
  });

  it('AC-2: choosing option 1 gives exactly +4 Attack', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    G.playerZones['0']!.discard.push(PLAIN_HERO);
    koFromDiscard(G, PLAIN_HERO);
    resolveDeferredHeroGrants(G, mockCtx);

    resolveCountScaledChoice(moveContext(G, '0'), { optionIndex: 1 });

    assert.equal(G.turnEconomy.attack, 4);
    assert.equal(G.turnEconomy.recruit, 0);
  });

  it('AC-3: a second Hero KO the same turn parks nothing more and records nothing', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    G.playerZones['0']!.discard.push(PLAIN_HERO, OTHER_COVERT);
    koFromDiscard(G, PLAIN_HERO);
    resolveDeferredHeroGrants(G, mockCtx);
    resolveCountScaledChoice(moveContext(G, '0'), { optionIndex: 0 });

    koFromDiscard(G, OTHER_COVERT);
    assert.equal(G.ko.length, 2, 'the second KO happened');
    assert.equal(Object.hasOwn(G, 'ownedHeroesKoedSinceResolve'), false, 'no waiting grant -> no key');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.pendingCountScaledChoice?.length ?? 0, 0);
    assert.equal(G.turnEconomy.recruit, 4, 'only the first time paid');
  });

  it('AC-4: a Wound KO parks nothing and records no Hero count; a later Hero KO still fires', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    G.playerZones['0']!.hand.push(WOUND_EXT_ID);

    healWounds(moveContext(G, '0'));
    assert.deepEqual(G.ko, [WOUND_EXT_ID], 'the Wound was KO\'d');
    assert.equal(Object.hasOwn(G, 'ownedHeroesKoedSinceResolve'), false, 'a Wound is not a Hero');
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false, 'no Absorb waits, so no owned-card key');
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingCountScaledChoice, undefined);
    assert.equal(G.deferredConditionalGrants?.length, 1, 'still waiting for a Hero');

    G.playerZones['0']!.discard.push(PLAIN_HERO);
    koFromDiscard(G, PLAIN_HERO);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingCountScaledChoice?.length, 1, 'the first HERO KO is the trigger');
  });

  it('AC-3 / AC-5: a Hero KO before the play gives nothing and creates no count key', () => {
    const G = makeState(buildHooks());
    G.playerZones['0']!.discard.push(PLAIN_HERO);

    koFromDiscard(G, PLAIN_HERO);
    assert.equal(G.ko.length, 1, 'the KO happened');
    assert.equal(Object.hasOwn(G, 'ownedHeroesKoedSinceResolve'), false, 'no waiting grant -> no key');
    resolveDeferredHeroGrants(G, mockCtx);

    playCard(G, POSSESSED);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingCountScaledChoice, undefined, 'RS-1: armed at play');
  });

  it('one move KOing three of the player\'s Heroes records 3, parks ONE choice, and pays exactly +4', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    G.playerZones['0']!.hand.push(COVERT_ONE, COVERT_TWO, COVERT_THREE);
    const villain = 'test/villain/destroyer#0' as CardExtId;
    const villainHook: VillainAbilityHook = {
      cardId: villain,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'ko-heroes-current-by-trait', requireKind: 'hero-class', requireValue: 'covert' }],
    };
    G.villainAbilityHooks = [villainHook];

    executeVillainAbilities(G, { currentPlayer: '0', turn: 1 }, villain, 'onFight');
    assert.equal(G.ko.length, 3, 'all three covert Heroes were KO\'d');
    assert.deepEqual(G.ownedHeroesKoedSinceResolve, { '0': 3 });
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.pendingCountScaledChoice?.length, 1, 'the first time only: one choice');
    resolveCountScaledChoice(moveContext(G, '0'), { optionIndex: 0 });
    assert.equal(G.turnEconomy.recruit, 4, 'exactly +4, not +12');
  });

  it('Absorb Energies and Possessed both waiting: one Hero KO gives +2 Recruit and one choice', () => {
    const G = makeState(buildHooks());
    playCard(G, 'dkcy/bishop/absorb-energies#0' as CardExtId);
    playCard(G, POSSESSED);
    G.playerZones['0']!.discard.push(PLAIN_HERO);

    koFromDiscard(G, PLAIN_HERO);
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '0': 1 });
    assert.deepEqual(G.ownedHeroesKoedSinceResolve, { '0': 1 });
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 2, 'Absorb Energies paid its +2');
    assert.equal(G.pendingCountScaledChoice?.length, 1, 'Possessed parked its choice');
  });

  it('a Hero count already above 0 at play still records the grant (always-defer)', () => {
    const G = makeState(buildHooks());
    // why: a Hero KO earlier in this same move.
    G.ownedHeroesKoedSinceResolve = { '0': 1 };

    playCard(G, POSSESSED);

    assert.equal(G.deferredConditionalGrants?.length, 1, 'it waits');
    assert.equal(G.pendingCountScaledChoice, undefined, 'nothing parks at play');
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting — it needs a Hero of yours/);
  });

  it('the turn boundary clears the waiting grant and the count', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    G.ownedHeroesKoedSinceResolve = { '0': 1 };

    applyOnBeginParity(G, '0');

    assert.equal(Object.hasOwn(G, 'deferredConditionalGrants'), false);
    assert.equal(Object.hasOwn(G, 'ownedHeroesKoedSinceResolve'), false);
  });

  it('AC-5: with no Hero-KO grant waiting, a Hero KO leaves no count key', () => {
    const G = makeState(buildHooks());
    G.playerZones['0']!.discard.push(PLAIN_HERO);

    koFromDiscard(G, PLAIN_HERO);

    assert.equal(G.ko.length, 1);
    assert.equal(Object.hasOwn(G, 'ownedHeroesKoedSinceResolve'), false);
  });
});

describe('Possessed by Brother\'s Spirit owner routing and queues (WP-856 / D-24792)', () => {
  it('AC-4: another player\'s Hero KO\'d by the Red Skull strike parks nothing for the active player', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    // why: the active player holds no Hero in hand, so only player 1 loses one.
    G.playerZones['1']!.hand.push(PLAIN_HERO);

    mastermindStrikeHandler(G, {}, { cardId: 'strike-card' }, {});
    assert.deepEqual(G.ko, [PLAIN_HERO]);
    assert.deepEqual(G.ownedHeroesKoedSinceResolve, { '1': 1 }, 'routed to the owner, not the active player');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.pendingCountScaledChoice, undefined);
    assert.equal(G.deferredConditionalGrants?.length, 1, 'player 0 still waits');
  });

  it('a koHeroChoice owing two and the parked choose-one both stay open and each resolves', () => {
    const G = makeState(buildHooks());
    playCard(G, POSSESSED);
    // why: more KO-able Heroes than are owed, so the second KO stays a real choice instead
    // of being auto-resolved inside resolveKoHeroChoice.
    G.playerZones['0']!.hand.push(COVERT_ONE, COVERT_TWO, COVERT_THREE);
    G.pendingKoHeroChoices = [{ choiceType: 'ko-hero', playerID: '0', remaining: 2 }];

    resolveKoHeroChoice(moveContext(G, '0'), { zone: 'hand', cardId: COVERT_ONE });
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingKoHeroChoices?.length, 1, 'one more KO is owed');
    assert.equal(G.pendingCountScaledChoice?.length, 1, 'the choose-one parked beside it');

    resolveCountScaledChoice(moveContext(G, '0'), { optionIndex: 1 });
    assert.equal(G.turnEconomy.attack, 4);

    resolveKoHeroChoice(moveContext(G, '0'), { zone: 'hand', cardId: COVERT_TWO });
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingKoHeroChoices?.length ?? 0, 0, 'the KO queue is done');
    assert.equal(G.pendingCountScaledChoice?.length ?? 0, 0, 'no second choice (the first time only)');
  });
});

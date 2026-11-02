/**
 * "KO'd from your deck this turn" readers — Miek's Metamorphosis, No-Name's Bursting with Life
 * and World-Spanning Hunger (WP-859 / D-24795).
 *
 * The three printed lines read a turn-scoped record of the cards KO'd from each player's deck
 * (G.cardsKoedFromDeckThisTurn). Metamorphosis and Bursting with Life Feast, then Transform once a
 * card with an Attack icon / a non-grey Hero has been KO'd from the deck this turn; World-Spanning
 * Hunger Feasts three times and gives +2 Attack for each non-grey Hero KO'd from the deck this
 * turn, counted at resolution.
 *
 * These tests build the REAL hooks from the committed card data (data/cards/wwhk.json and
 * vill.json) through a getSet stub, drive executeHeroEffects, resolve the parked Feasts through
 * resolveRevealTopDispose and the other real KO moves, and run the real LegendaryGame play-phase
 * turn.onMove after each move, so the parse, the record, the deferred Transform and the reward
 * are pinned together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LegendaryGame } from '../game.js';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildTransformSideDeck, buildTransformTargets } from '../setup/buildHeroDeck.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import {
  ATTACK_ICON_DECK_KO_CONDITION_TYPE,
  NON_GREY_HERO_DECK_KO_CONDITION_TYPE,
} from './heroConditions.evaluate.js';
import { resolveRevealTopDispose } from '../moves/revealTopDispose.resolve.js';
import { resolveScryKoChoice } from '../moves/scryKoChoice.resolve.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { resolveMelterKoChoice } from '../moves/melterKoChoice.resolve.js';
import {
  BYSTANDER_EXT_ID,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  WOUND_EXT_ID,
} from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the feast.test.ts
// precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const WWHK_DECKS = ['wwhk/miek-the-unhived', 'wwhk/no-name-brood-queen'];

const ATTACK_HERO = 'test/attack-hero/punch#0' as CardExtId;
const RECRUIT_HERO = 'test/recruit-hero/coin#0' as CardExtId;
const SECOND_ATTACK_HERO = 'test/attack-hero/kick#0' as CardExtId;
const FILLER = 'test/filler/card#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds a registry stub over the committed card data for the given sets.
 *
 * @param setAbbrs - The sets to load from data/cards.
 * @returns A registry with getSet (and an empty listCards).
 */
function makeRegistry(setAbbrs: string[]): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

/**
 * Builds the real hooks for the given hero decks.
 *
 * @param heroDeckIds - Set-qualified hero ids.
 * @returns Every hook those decks produce.
 */
function buildHooks(heroDeckIds: string[]): HeroAbilityHook[] {
  const setAbbrs = heroDeckIds.map((heroDeckId) => heroDeckId.split('/')[0]!);
  return buildHeroAbilityHooks(makeRegistry(setAbbrs), { heroDeckIds } as unknown as MatchConfiguration);
}

/**
 * Returns a card copy's id, asserting the data builds a hook for it.
 *
 * @param hooks - The decks' hooks.
 * @param cardPath - `<set>/<hero>/<card>`.
 * @param copy - The copy number.
 * @returns The card's ext id.
 */
function cardIdOf(hooks: HeroAbilityHook[], cardPath: string, copy: number): CardExtId {
  const cardId = `${cardPath}#${copy}`;
  assert.ok(hooks.some((hook) => hook.cardId === cardId), `the card data builds a hook for ${cardId}`);
  return cardId as CardExtId;
}

/**
 * Returns the hooks of one card copy, in printed-line order.
 *
 * @param hooks - The decks' hooks.
 * @param cardId - The card copy.
 * @returns That copy's hooks.
 */
function hooksOf(hooks: HeroAbilityHook[], cardId: CardExtId): HeroAbilityHook[] {
  return hooks.filter((hook) => hook.cardId === cardId);
}

/**
 * A two-seat state wide enough for the hero executor, the KO moves and the play-phase onMove,
 * with the real transform side deck and targets for the given hero decks.
 *
 * @param heroDeckIds - The hero decks the match carries.
 * @param deck - Player 0's deck, top first.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(heroDeckIds: string[], deck: CardExtId[]): LegendaryGameState {
  const setAbbrs = heroDeckIds.map((heroDeckId) => heroDeckId.split('/')[0]!);
  const registry = makeRegistry(setAbbrs);
  const transformDeck = buildTransformSideDeck(heroDeckIds, registry);
  const cardStats: Record<string, object> = {
    [ATTACK_HERO]: { attack: 2, recruit: 0, cost: 3, fightCost: 0, hasAttackIcon: true, hasRecruitIcon: false },
    [SECOND_ATTACK_HERO]: { attack: 1, recruit: 0, cost: 2, fightCost: 0, hasAttackIcon: true, hasRecruitIcon: false },
    [RECRUIT_HERO]: { attack: 0, recruit: 2, cost: 3, fightCost: 0, hasAttackIcon: false, hasRecruitIcon: true },
    [SHIELD_AGENT_EXT_ID]: { attack: 0, recruit: 1, cost: 0, fightCost: 0, hasAttackIcon: false, hasRecruitIcon: true },
    [SHIELD_TROOPER_EXT_ID]: { attack: 1, recruit: 0, cost: 0, fightCost: 0, hasAttackIcon: true, hasRecruitIcon: false },
  };
  // why: the printed second-form stats (Hive King Miek 6 Attack, Torrent of Broodlings 2 Attack)
  // the swap applies; a real match builds them from the registry at setup.
  for (const sideDeckId of transformDeck) {
    const attack = sideDeckId.includes('/hive-king-miek#') ? 6 : 2;
    cardStats[sideDeckId] = { attack, recruit: 0, cost: 0, fightCost: 0, hasAttackIcon: true, hasRecruitIcon: false };
  }
  const G = {
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds,
    },
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: ['v-1'], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: ['h-1'],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: buildHeroAbilityHooks(registry, { heroDeckIds } as unknown as MatchConfiguration),
    transformTargets: buildTransformTargets(heroDeckIds, registry),
    transformDeck,
    cardStats,
    cardTraits: {
      [ATTACK_HERO]: { heroClass: 'strength' },
      [SECOND_ATTACK_HERO]: { heroClass: 'ranged' },
      [RECRUIT_HERO]: { heroClass: 'tech' },
    },
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
  G.playerZones['0']!.deck = [...deck];
  return G;
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
 * Runs the real LegendaryGame play-phase turn.onMove, as boardgame.io does after every move.
 *
 * @param G - The game state.
 */
function runOnMove(G: LegendaryGameState): void {
  const onMove = (
    LegendaryGame.phases as Record<string, { turn?: { onMove?: (context: unknown) => void } }>
  ).play?.turn?.onMove;
  assert.notEqual(onMove, undefined, 'play phase must define a turn.onMove hook');
  onMove!({
    G,
    ctx: mockCtx.ctx,
    random: mockCtx.random,
    events: { setActivePlayers: () => {}, endTurn: () => {}, setPhase: () => {} },
  });
}

/**
 * Resolves the front reveal-top (Feast) choice for player 0's own deck, then runs onMove.
 *
 * @param G - The game state.
 * @param cardId - The revealed card the decision targets.
 * @param disposition - 'ko' or 'top'.
 */
function resolveFeast(G: LegendaryGameState, cardId: CardExtId, disposition: 'ko' | 'top'): void {
  resolveRevealTopDispose({ G, playerID: '0', ...mockCtx } as never, { ownerPlayerID: '0', cardId, disposition } as never);
  runOnMove(G);
}

/**
 * KOs one card from player 0's deck through the real scry-KO move, then runs onMove.
 *
 * @param G - The game state.
 * @param koCardId - The deck card to KO (shown with the card under it).
 */
function scryKoFromDeck(G: LegendaryGameState, koCardId: CardExtId): void {
  G.pendingScryKoChoices = [{ choiceType: 'scry-ko', playerID: '0', revealedCardIds: [koCardId] }];
  resolveScryKoChoice({ G, playerID: '0', ...mockCtx } as never, { cardId: koCardId } as never);
  runOnMove(G);
}

/**
 * Returns whether a card id is in player 0's play area.
 *
 * @param G - The game state.
 * @param prefix - The card key prefix (e.g. `wwhk/miek-the-unhived/hive-king-miek#`).
 * @returns True when a card with that prefix is in play.
 */
function hasInPlay(G: LegendaryGameState, prefix: string): boolean {
  return G.playerZones['0']!.inPlay.some((cardId) => cardId.startsWith(prefix));
}

describe('WP-859 parse — Feast then Transform, and Feast up to three times', () => {
  const hooks = buildHooks(WWHK_DECKS);

  it('Metamorphosis parses to an unconditional Feast hook and a gated Transform hook with no attack', () => {
    const cardHooks = hooksOf(hooks, cardIdOf(hooks, 'wwhk/miek-the-unhived/metamorphosis', 0));
    assert.equal(cardHooks.length, 2, 'the split makes two hooks');
    assert.deepEqual(cardHooks[0]!.keywords, ['feast']);
    assert.deepEqual(cardHooks[0]!.effects, [{ type: 'feast' }]);
    assert.equal(cardHooks[0]!.conditions, undefined, 'the Feast carries no condition');
    assert.deepEqual(cardHooks[1]!.keywords, ['transform', 'conditional'], 'no attack keyword from the criterion icon');
    assert.deepEqual(cardHooks[1]!.conditions, [{ type: ATTACK_ICON_DECK_KO_CONDITION_TYPE, value: '1' }]);
    assert.deepEqual(cardHooks[1]!.effects, [{ type: 'transform' }]);
    for (const hook of cardHooks) {
      assert.equal(hook.unresolvedMarkers, undefined, 'no unresolved marker');
    }
  });

  it('every Bursting with Life copy parses to a Feast hook and a non-grey-Hero-gated Transform hook', () => {
    for (let copy = 0; copy < 3; copy++) {
      const cardHooks = hooksOf(hooks, cardIdOf(hooks, 'wwhk/no-name-brood-queen/bursting-with-life', copy));
      assert.equal(cardHooks.length, 2, `copy ${copy} splits into two hooks`);
      assert.deepEqual(cardHooks[0]!.effects, [{ type: 'feast' }]);
      assert.equal(cardHooks[0]!.conditions, undefined);
      assert.deepEqual(cardHooks[1]!.conditions, [{ type: NON_GREY_HERO_DECK_KO_CONDITION_TYPE, value: '1' }]);
      assert.deepEqual(cardHooks[1]!.effects, [{ type: 'transform' }]);
      assert.equal(cardHooks[1]!.unresolvedMarkers, undefined);
    }
  });

  it('World-Spanning Hunger parses to three rewarded Feasts and the count-scaled +2, with no flat attack', () => {
    const cardHooks = hooksOf(hooks, cardIdOf(hooks, 'wwhk/no-name-brood-queen/world-spanning-hunger', 0));
    assert.equal(cardHooks.length, 1);
    assert.deepEqual(cardHooks[0]!.effects, [
      { type: 'feast', nonGreyHeroKoAttack: 2 },
      { type: 'feast', nonGreyHeroKoAttack: 2 },
      { type: 'feast', nonGreyHeroKoAttack: 2 },
      { type: 'attack-per-count', magnitude: 2, countSource: 'non-grey-heroes-koed-from-deck-this-turn' },
    ]);
    assert.ok(!cardHooks[0]!.keywords.includes('attack'), 'the phantom flat +2 is suppressed');
    assert.equal(cardHooks[0]!.unresolvedMarkers, undefined, 'no unresolved feast');
  });
});

describe('WP-859 Metamorphosis — Transforms once a card with an Attack icon is KO\'d from your deck', () => {
  const hooks = buildHooks(WWHK_DECKS);
  const metamorphosis = cardIdOf(hooks, 'wwhk/miek-the-unhived/metamorphosis', 0);
  const HIVE_KING = 'wwhk/miek-the-unhived/hive-king-miek#';

  it('parks the Feast, waits, and Transforms into Hive King Miek (+6) after the Feast KOs an Attack card', () => {
    const G = makeState(WWHK_DECKS, [ATTACK_HERO, FILLER]);
    playCard(G, metamorphosis);
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'the Feast parks its prompt');
    assert.equal(G.deferredConditionalGrants?.length, 1, 'the Transform waits');
    assert.ok(G.messages.some((line) => line.text.includes('it needs a card with an Attack icon to be KO\'d from your deck this turn')));

    resolveFeast(G, ATTACK_HERO, 'ko');

    assert.ok(hasInPlay(G, HIVE_KING), 'Hive King Miek is in play');
    assert.ok(!G.playerZones['0']!.inPlay.includes(metamorphosis), 'Metamorphosis left play');
    assert.ok(G.transformDeck!.includes(metamorphosis), 'the base went to the side deck');
    assert.equal(G.turnEconomy.attack, 6);
    assert.equal(G.deferredConditionalGrants, undefined, 'fired once, not re-armed');

    scryKoFromDeck(G, FILLER);
    assert.equal(G.turnEconomy.attack, 6, 'a later deck KO swaps nothing more');
  });

  it('a keep, or a KO of a Recruit-only Hero, Agent, Wound or Bystander, leaves it waiting; a Trooper KO Transforms it', () => {
    const G = makeState(WWHK_DECKS, [RECRUIT_HERO, SHIELD_AGENT_EXT_ID, WOUND_EXT_ID, BYSTANDER_EXT_ID, SHIELD_TROOPER_EXT_ID, FILLER]);
    playCard(G, metamorphosis);
    resolveFeast(G, RECRUIT_HERO, 'top');
    assert.ok(!hasInPlay(G, HIVE_KING), 'keeping the card Transforms nothing');

    for (const cardId of [RECRUIT_HERO, SHIELD_AGENT_EXT_ID, WOUND_EXT_ID, BYSTANDER_EXT_ID]) {
      scryKoFromDeck(G, cardId);
      assert.ok(!hasInPlay(G, HIVE_KING), `a KO of ${cardId} Transforms nothing`);
    }
    assert.ok(G.playerZones['0']!.inPlay.includes(metamorphosis));

    scryKoFromDeck(G, SHIELD_TROOPER_EXT_ID);
    assert.ok(hasInPlay(G, HIVE_KING), 'the Trooper prints an Attack icon');
    assert.equal(G.turnEconomy.attack, 6);
  });

  it('an Attack card KO\'d from the deck earlier this turn Transforms it at play', () => {
    const G = makeState(WWHK_DECKS, [ATTACK_HERO, FILLER, SECOND_ATTACK_HERO]);
    scryKoFromDeck(G, ATTACK_HERO);
    assert.deepEqual(G.cardsKoedFromDeckThisTurn, { '0': [ATTACK_HERO] });

    playCard(G, metamorphosis);

    assert.ok(hasInPlay(G, HIVE_KING), 'the Transform fires at play');
    assert.equal(G.deferredConditionalGrants, undefined, 'nothing waits');
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'the Feast still prompts');
  });

  it('a waiting Transform whose base left play does not fire (logged blocked, no swap, no Attack)', () => {
    const G = makeState(WWHK_DECKS, [ATTACK_HERO, FILLER]);
    playCard(G, metamorphosis);
    const sideDeckBefore = [...G.transformDeck!];
    // why: Metamorphosis is KO'd from play while its Transform waits.
    G.playerZones['0']!.inPlay = G.playerZones['0']!.inPlay.filter((cardId) => cardId !== metamorphosis);
    G.ko.push(metamorphosis);

    resolveFeast(G, ATTACK_HERO, 'ko');

    assert.ok(!hasInPlay(G, HIVE_KING), 'no second form enters play');
    assert.deepEqual(G.transformDeck, sideDeckBefore, 'the side deck is untouched');
    assert.equal(G.turnEconomy.attack, 0);
    const blockedLine = G.messages.find((line) => line.text.includes('it is no longer in play'));
    assert.equal(blockedLine?.outcome, 'blocked');
  });
});

describe('WP-859 Bursting with Life — Transforms once a non-grey Hero is KO\'d from your deck', () => {
  it('an Agent, Trooper, Wound or Bystander KO leaves it waiting; a non-grey Hero KO makes it Torrent of Broodlings (+2)', () => {
    const hooks = buildHooks(WWHK_DECKS);
    const burstingWithLife = cardIdOf(hooks, 'wwhk/no-name-brood-queen/bursting-with-life', 0);
    const TORRENT = 'wwhk/no-name-brood-queen/torrent-of-broodlings#';
    const G = makeState(WWHK_DECKS, [SHIELD_AGENT_EXT_ID, SHIELD_TROOPER_EXT_ID, WOUND_EXT_ID, BYSTANDER_EXT_ID, RECRUIT_HERO, FILLER]);
    playCard(G, burstingWithLife);
    assert.ok(G.messages.some((line) => line.text.includes('it needs a non-grey Hero to be KO\'d from your deck this turn')));

    resolveFeast(G, SHIELD_AGENT_EXT_ID, 'ko');
    for (const cardId of [SHIELD_TROOPER_EXT_ID, WOUND_EXT_ID, BYSTANDER_EXT_ID]) {
      scryKoFromDeck(G, cardId);
    }
    assert.ok(!hasInPlay(G, TORRENT), 'no grey Hero, Wound or Bystander Transforms it');

    scryKoFromDeck(G, RECRUIT_HERO);
    assert.ok(hasInPlay(G, TORRENT), 'Torrent of Broodlings is in play');
    assert.ok(!G.playerZones['0']!.inPlay.includes(burstingWithLife));
    assert.equal(G.turnEconomy.attack, 2);
  });
});

describe('WP-859 World-Spanning Hunger — Feast up to three times, +2 per non-grey Hero KO\'d from your deck', () => {
  const hooks = buildHooks(WWHK_DECKS);
  const worldSpanningHunger = cardIdOf(hooks, 'wwhk/no-name-brood-queen/world-spanning-hunger', 0);

  it('opens three prompts: a non-grey Hero KO pays +2, a keep and a grey KO pay nothing, and there is no flat +2', () => {
    const G = makeState(WWHK_DECKS, [ATTACK_HERO, SHIELD_TROOPER_EXT_ID, FILLER]);
    playCard(G, worldSpanningHunger);
    assert.equal(G.pendingRevealTopDispose?.length, 3, 'three Feast prompts');
    assert.equal(G.turnEconomy.attack, 0, 'nothing KO\'d yet, so no Attack');

    resolveFeast(G, ATTACK_HERO, 'ko');
    assert.equal(G.turnEconomy.attack, 2, 'a non-grey Hero KO pays +2');
    assert.equal(G.pendingRevealTopDispose![0]!.revealedTops[0]!.cardId, SHIELD_TROOPER_EXT_ID, 'the next prompt shows the new top');

    resolveFeast(G, SHIELD_TROOPER_EXT_ID, 'top');
    assert.equal(G.turnEconomy.attack, 2, 'a keep pays nothing');

    resolveFeast(G, SHIELD_TROOPER_EXT_ID, 'ko');
    assert.equal(G.turnEconomy.attack, 2, 'a grey Hero KO pays nothing');
    assert.deepEqual(G.pendingRevealTopDispose, []);
    assert.deepEqual(G.ko, [ATTACK_HERO, SHIELD_TROOPER_EXT_ID]);
  });

  it('a non-grey Hero and a Trooper KO\'d from the deck before the play give exactly +2 at play', () => {
    const G = makeState(WWHK_DECKS, [ATTACK_HERO, SHIELD_TROOPER_EXT_ID, FILLER, SECOND_ATTACK_HERO]);
    scryKoFromDeck(G, ATTACK_HERO);
    scryKoFromDeck(G, SHIELD_TROOPER_EXT_ID);

    playCard(G, worldSpanningHunger);

    assert.equal(G.turnEconomy.attack, 2, 'the grey Trooper is not counted');
  });

  it('a stale prompt re-revealed after a KO keeps its reward and pays it', () => {
    const G = makeState(WWHK_DECKS, [ATTACK_HERO, SECOND_ATTACK_HERO, FILLER]);
    playCard(G, worldSpanningHunger);
    resolveFeast(G, ATTACK_HERO, 'ko');

    const refreshedEntry = G.pendingRevealTopDispose![0]!.revealedTops[0]!;
    assert.equal(refreshedEntry.cardId, SECOND_ATTACK_HERO, 're-revealed to the new top');
    assert.equal(refreshedEntry.nonGreyHeroKoAttack, 2, 'the re-reveal keeps the reward field');

    resolveFeast(G, SECOND_ATTACK_HERO, 'ko');
    assert.equal(G.turnEconomy.attack, 4);
  });
});

describe('WP-859 deck-KO turn record — gated on a reader hook, routed to the owner', () => {
  it('a match with no reader hook never gains the record (Electroshock Therapy KO)', () => {
    const villDecks = ['vill/electro'];
    const hooks = buildHooks(villDecks);
    const G = makeState(villDecks, [ATTACK_HERO, FILLER]);
    playCard(G, cardIdOf(hooks, 'vill/electro/electroshock-therapy', 0));

    resolveFeast(G, ATTACK_HERO, 'ko');

    assert.deepEqual(G.ko, [ATTACK_HERO], 'the KO happened');
    assert.equal(Object.hasOwn(G, 'cardsKoedFromDeckThisTurn'), false);
  });

  it('records a Melter KO of Player 1\'s deck under Player 1, and never records a discard KO', () => {
    const G = makeState(WWHK_DECKS, [FILLER]);
    G.playerZones['1']!.deck = [ATTACK_HERO, FILLER];
    G.pendingMelterKoChoices = [{ choiceType: 'melter-ko', playerID: '0', revealedTops: [{ ownerPlayerID: '1', cardId: ATTACK_HERO }] }];
    resolveMelterKoChoice({ G, playerID: '0', ...mockCtx } as never, { ownerPlayerID: '1', cardId: ATTACK_HERO, keep: false } as never);
    assert.deepEqual(G.cardsKoedFromDeckThisTurn, { '1': [ATTACK_HERO] }, 'routed to the owner');

    G.playerZones['0']!.discard.push(SECOND_ATTACK_HERO);
    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }];
    resolveKoDiscardChoice({ G, playerID: '0', ...mockCtx } as never, { cardIds: [SECOND_ATTACK_HERO] } as never);
    assert.ok(G.ko.includes(SECOND_ATTACK_HERO), 'the discard KO happened');
    assert.deepEqual(G.cardsKoedFromDeckThisTurn, { '1': [ATTACK_HERO] }, 'a discard KO is not recorded');
  });

  it('Electroshock Therapy and Metamorphosis park byte-identical KO-or-keep entries with no reward key', () => {
    const decks = ['vill/electro', 'wwhk/miek-the-unhived'];
    const hooks = buildHooks(decks);
    const expectedEntry = { ownerPlayerID: '0', cardId: ATTACK_HERO, isKoAllowed: true, isDiscardAllowed: false };
    for (const cardPath of ['vill/electro/electroshock-therapy', 'wwhk/miek-the-unhived/metamorphosis']) {
      const G = makeState(decks, [ATTACK_HERO, FILLER]);
      playCard(G, cardIdOf(hooks, cardPath, 0));
      const parkedEntry = G.pendingRevealTopDispose![0]!.revealedTops[0]!;
      assert.deepEqual(parkedEntry, expectedEntry, `${cardPath} parks today's entry shape`);
      assert.equal(Object.hasOwn(parkedEntry, 'nonGreyHeroKoAttack'), false);
    }
  });
});

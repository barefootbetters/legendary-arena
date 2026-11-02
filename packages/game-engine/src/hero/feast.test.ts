/**
 * World War Hulk hero Feast plays as printed (WP-857 / D-24793).
 *
 * Feast means "KO the top card of your deck" (rules v23). Five Miek / No-Name lines print
 * "You may [keyword:Feast]" and did nothing before this packet (the token landed in
 * unresolvedMarkers). The `feast` HeroKeyword reuses the shipped heroEffectRevealTopMayKo: the
 * deck top is shown in the KO-or-keep reveal prompt and the player KOs or keeps it (RS-1).
 * World-Spanning Hunger and The Void Unchained carry other text the engine does not model, so
 * their Feast stays an honest unresolved marker (the FEAST_CARDS allowlist).
 *
 * These tests build the REAL hooks from the committed data/cards/wwhk.json, drive
 * executeHeroEffects, then resolve the parked choices through resolveRevealTopDispose, so they
 * pin the parse, the park and the resolve together.
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
import { resolveRevealTopDispose } from '../moves/revealTopDispose.resolve.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// ca75OptionalKoShield.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const DECK_TOP = 'deck-top-card';
const DECK_SECOND = 'deck-second-card';
const COVERT_ALLY = 'test/ally/covert-ally#0';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for the World War Hulk hero decks that print Feast.
 *
 * @returns Every hook the Miek, No-Name and Sentry hero decks produce.
 */
function buildFeastHeroHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'wwhk.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'wwhk' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, {
    heroDeckIds: ['wwhk/miek-the-unhived', 'wwhk/no-name-brood-queen', 'wwhk/sentry'],
  } as unknown as MatchConfiguration);
}

/**
 * Returns the hooks of the first copy of a card.
 *
 * @param hooks - The hero decks' hooks.
 * @param cardSlug - The card slug.
 * @returns The first copy's card id and its hooks (one per printed ability line).
 */
function firstCopyHooks(hooks: HeroAbilityHook[], cardSlug: string): { cardId: CardExtId; cardHooks: HeroAbilityHook[] } {
  const firstHook = hooks.find((hook) => hook.cardId.includes(`/${cardSlug}#`));
  assert.ok(firstHook !== undefined, `the wwhk data builds a hook for ${cardSlug}`);
  const cardId = firstHook.cardId;
  return { cardId, cardHooks: hooks.filter((hook) => hook.cardId === cardId) };
}

/**
 * Returns the one hook of a card whose line prints [keyword:Feast].
 *
 * @param cardHooks - One card copy's hooks.
 * @returns The hook that carries or records `feast`.
 */
function feastLineHook(cardHooks: HeroAbilityHook[]): HeroAbilityHook {
  const feastHooks = cardHooks.filter(
    (hook) => (hook.keywords ?? []).includes('feast') || (hook.unresolvedMarkers ?? []).includes('feast'),
  );
  assert.equal(feastHooks.length, 1, 'exactly one printed line carries Feast');
  return feastHooks[0]!;
}

/**
 * Minimal state for driving executeHeroEffects and resolveRevealTopDispose.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param cardTraits - Printed class / team of the cards the gates read.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], cardTraits: Record<string, object>): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), hand: [], deck: [], discard: [], inPlay: [], victory: [] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits,
    cardDisplayData: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card after the given cards, with the given deck and discard pile.
 *
 * @param G - The game state, mutated in place.
 * @param setup - Cards played earlier this turn, the deck (top first) and the discard pile.
 * @param cardId - The card being played now.
 */
function play(
  G: LegendaryGameState,
  setup: { playedBefore: string[]; deck: string[]; discard: string[] },
  cardId: CardExtId,
): void {
  const playerZones = G.playerZones['0']!;
  playerZones.inPlay = [...(setup.playedBefore as CardExtId[]), cardId];
  playerZones.deck = [...(setup.deck as CardExtId[])];
  playerZones.discard = [...(setup.discard as CardExtId[])];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * Resolves the front reveal-top choice for player 0's own deck.
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The revealed card the decision targets.
 * @param disposition - 'ko', 'top' or 'discard'.
 */
function resolve(G: LegendaryGameState, cardId: string, disposition: 'ko' | 'top' | 'discard'): void {
  resolveRevealTopDispose({ G, playerID: '0', ...mockCtx } as never, { ownerPlayerID: '0', cardId, disposition } as never);
}

describe('wwhk hero Feast — "You may [keyword:Feast]" KOs or keeps the top card of your deck (WP-857 / D-24793)', () => {
  const hooks = buildFeastHeroHooks();

  it('T1 each FEAST_CARDS line parses to the feast keyword and effect, keeping its class gate', () => {
    const expectedGates: Array<[string, HeroAbilityHook['conditions']]> = [
      ['devouring-frenzy', [{ type: 'heroClassMatch', value: 'instinct' }]],
      ['metamorphosis', undefined],
      ['hive-king-miek', undefined],
      ['appetite-for-destruction', [{ type: 'heroClassMatch', value: 'covert' }]],
      ['bursting-with-life', undefined],
    ];
    for (const [cardSlug, expectedGate] of expectedGates) {
      const hook = feastLineHook(firstCopyHooks(hooks, cardSlug).cardHooks);
      assert.ok(hook.keywords.includes('feast'), `${cardSlug} carries the feast keyword`);
      assert.ok((hook.effects ?? []).some((effect) => effect.type === 'feast' && effect.magnitude === undefined),
        `${cardSlug} carries a magnitude-less feast effect`);
      assert.ok(!(hook.unresolvedMarkers ?? []).includes('feast'), `${cardSlug} records no unresolved feast`);
      assert.deepEqual(hook.conditions, expectedGate, `${cardSlug} keeps its printed gate`);
    }
  });

  it('T2 The Void Unchained keeps an unresolved feast and no feast keyword', () => {
    // why: WP-859 / D-24795 — World-Spanning Hunger left this case when its Feast became modeled
    // (FEAST_CARDS 5 → 6); its parse is pinned in feastReaders.test.ts.
    for (const cardSlug of ['the-void-unchained']) {
      const hook = feastLineHook(firstCopyHooks(hooks, cardSlug).cardHooks);
      assert.ok(!hook.keywords.includes('feast'), `${cardSlug} carries no feast keyword`);
      assert.ok(!(hook.effects ?? []).some((effect) => effect.type === 'feast'), `${cardSlug} carries no feast effect`);
      assert.ok((hook.unresolvedMarkers ?? []).includes('feast'), `${cardSlug} records feast as unresolved`);
    }
  });

  it('T3 playing Metamorphosis parks one KO-or-keep reveal of the deck top', () => {
    const { cardId } = firstCopyHooks(hooks, 'metamorphosis');
    const G = makeState(hooks, {});
    play(G, { playedBefore: [], deck: [DECK_TOP, DECK_SECOND], discard: [] }, cardId);
    assert.deepEqual(G.pendingRevealTopDispose, [{
      choiceType: 'reveal-top-dispose',
      playerID: '0',
      revealedTops: [{ ownerPlayerID: '0', cardId: DECK_TOP, isKoAllowed: true, isDiscardAllowed: false }],
    }]);
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP, DECK_SECOND], 'the reveal removes nothing');
  });

  it('T4 resolving the Feast with KO moves the deck top to the KO pile', () => {
    const { cardId } = firstCopyHooks(hooks, 'metamorphosis');
    const G = makeState(hooks, {});
    play(G, { playedBefore: [], deck: [DECK_TOP, DECK_SECOND], discard: [] }, cardId);
    resolve(G, DECK_TOP, 'ko');
    assert.deepEqual(G.ko, [DECK_TOP]);
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_SECOND]);
    assert.deepEqual(G.pendingRevealTopDispose, []);
  });

  it('T5 resolving the Feast with Keep leaves the deck unchanged and clears the queue', () => {
    const { cardId } = firstCopyHooks(hooks, 'bursting-with-life');
    const G = makeState(hooks, {});
    play(G, { playedBefore: [], deck: [DECK_TOP, DECK_SECOND], discard: [] }, cardId);
    resolve(G, DECK_TOP, 'top');
    assert.deepEqual(G.ko, []);
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP, DECK_SECOND]);
    assert.deepEqual(G.pendingRevealTopDispose, []);
  });

  it('T6 Devouring Frenzy with no other Instinct card played this turn parks nothing', () => {
    const { cardId } = firstCopyHooks(hooks, 'devouring-frenzy');
    const G = makeState(hooks, { [cardId]: { heroClass: 'instinct', team: null } });
    play(G, { playedBefore: [], deck: [DECK_TOP, DECK_SECOND], discard: [] }, cardId);
    assert.equal(G.pendingRevealTopDispose, undefined, 'the [hc:instinct] gate blocks the Feast');
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP, DECK_SECOND]);
  });

  it('T7 Appetite for Destruction after a Covert card parks the discard-or-keep then the Feast; a discard re-reveals the new top', () => {
    const { cardId } = firstCopyHooks(hooks, 'appetite-for-destruction');
    const G = makeState(hooks, {
      [cardId]: { heroClass: 'covert', team: null },
      [COVERT_ALLY]: { heroClass: 'covert', team: null },
    });
    play(G, { playedBefore: [COVERT_ALLY], deck: [DECK_TOP, DECK_SECOND], discard: [] }, cardId);
    assert.deepEqual(G.pendingRevealTopDispose!.map((choice) => choice.revealedTops), [
      [{ ownerPlayerID: '0', cardId: DECK_TOP }],
      [{ ownerPlayerID: '0', cardId: DECK_TOP, isKoAllowed: true, isDiscardAllowed: false }],
    ], 'line 0 discard-or-keep first, then the Feast on the same top');

    resolve(G, DECK_TOP, 'discard');
    assert.deepEqual(G.playerZones['0']!.discard, [DECK_TOP]);
    assert.deepEqual(G.pendingRevealTopDispose!.map((choice) => choice.revealedTops), [
      [{ ownerPlayerID: '0', cardId: DECK_SECOND, isKoAllowed: true, isDiscardAllowed: false }],
    ], 'the Feast prompt now shows the new top (refreshStaleKoOrKeepFront)');

    resolve(G, DECK_SECOND, 'ko');
    assert.deepEqual(G.ko, [DECK_SECOND]);
    assert.deepEqual(G.playerZones['0']!.deck, []);
  });

  it('T8 with an empty deck and discard pile the Feast parks nothing and logs a blocked line', () => {
    const { cardId } = firstCopyHooks(hooks, 'metamorphosis');
    const G = makeState(hooks, {});
    play(G, { playedBefore: [], deck: [], discard: [] }, cardId);
    assert.equal(G.pendingRevealTopDispose, undefined, 'no queue materialized');
    const blockedLine = G.messages.find((line) => line.text.includes('had no card to reveal'));
    assert.equal(blockedLine?.outcome, 'blocked');
  });
});

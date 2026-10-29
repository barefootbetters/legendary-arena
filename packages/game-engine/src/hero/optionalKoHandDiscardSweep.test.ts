/**
 * Bare "You may KO a card from your hand or discard pile." executes (WP-851 / D-24787).
 *
 * Eleven hero lines print the no-reward optional KO but carried no marker, so the line had no
 * effect and every play logged "Its effect is not supported yet" (operator match Ps0Hg_m5B-H,
 * Bishop's Whatever the Cost). WP-851 marks them with the existing optional-ko-hand-discard
 * keyword (WP-667 / D-24480); no engine source changed.
 *
 * These tests build the REAL hooks from the committed data/cards/*.json (the markers pass output),
 * drive executeHeroEffects, then resolve the parked choice through resolveOptionalKoReward, so they
 * pin the parse, each line's gate, the park and the KO together.
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
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook, HeroCondition } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// ca75OptionalKoShield.test.ts precedent). The hooks must come from the committed card data, not a
// fixture: the marker the apply script wrote IS the change under test.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const KO_EFFECT_TYPE = 'optional-ko-hand-discard';
const COVERT_HERO = 'test/covert/sneak#0';
const STRENGTH_HERO = 'test/strength/punch#0';
const HAND_CARD = 'test/hand/card#0';
const DISCARD_CARD = 'test/discard/card#0';
const DECK_CARD = 'test/deck/card#0';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * One marked line: where it lives and the play gate it must parse to.
 */
interface SweptLine {
  setAbbr: string;
  heroSlug: string;
  cardSlug: string;
  conditions: HeroCondition[];
}

const SWEPT_LINES: SweptLine[] = [
  { setAbbr: 'amwp', heroSlug: 'ant-man', cardSlug: 'bug-swarm', conditions: [{ type: 'cheapOrSizeChangingAtLeast', value: '3' }] },
  { setAbbr: 'asrd', heroSlug: 'warriors-three-the', cardSlug: 'hogun-the-grim', conditions: [{ type: 'heroClassMatch', value: 'strength' }] },
  { setAbbr: 'chmp', heroSlug: 'ms-marvel', cardSlug: 'need-to-stretch-my-legs', conditions: [{ type: 'requiresTeam', value: 'champions' }] },
  { setAbbr: 'cvwr', heroSlug: 'storm-black-panther', cardSlug: 'tsunami-of-justice', conditions: [{ type: 'heroClassMatch', value: 'covert' }] },
  { setAbbr: 'dead', heroSlug: 'stingray', cardSlug: 'phd-in-oceanography', conditions: [] },
  { setAbbr: 'dkcy', heroSlug: 'bishop', cardSlug: 'whatever-the-cost', conditions: [{ type: 'heroClassMatch', value: 'covert' }] },
  { setAbbr: 'dkcy', heroSlug: 'professor-x', cardSlug: 'class-dismissed', conditions: [{ type: 'heroClassMatch', value: 'instinct' }] },
  { setAbbr: 'dkcy', heroSlug: 'wolverine', cardSlug: 'no-mercy', conditions: [] },
  { setAbbr: 'mgtg', heroSlug: 'gamora', cardSlug: 'stolen-necroblaster', conditions: [{ type: 'cardsDrawnThisTurnAtLeast', value: '2' }] },
  { setAbbr: 'wwhk', heroSlug: 'caiera', cardSlug: 'focus-the-old-power', conditions: [{ type: 'distinctHeroCostsAtLeast', value: '3' }] },
  { setAbbr: 'xmen', heroSlug: 'phoenix', cardSlug: 'life-death-incarnate', conditions: [] },
];

/**
 * Builds the real hooks for one hero deck from the committed card data.
 *
 * @param setAbbr - The set abbreviation (the data/cards file stem).
 * @param heroSlug - The hero slug within that set.
 * @returns Every hook the hero deck produces.
 */
function buildHeroHooks(setAbbr: string, heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`${setAbbr}/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Returns the first copy of a card and its optional-KO hook.
 *
 * @param hooks - The hero deck's hooks.
 * @param cardSlug - The card slug.
 * @returns The first copy's card id and the hook whose first effect is the optional KO.
 */
function firstCopyKoHook(hooks: HeroAbilityHook[], cardSlug: string): { cardId: CardExtId; koHook: HeroAbilityHook } {
  const firstHook = hooks.find((hook) => hook.cardId.includes(`/${cardSlug}#`));
  assert.ok(firstHook !== undefined, `the card data builds a hook for ${cardSlug}`);
  const cardId = firstHook.cardId;
  // why: several of these cards carry more than one hook (Bishop draws first, Ms. Marvel has
  // Size-Changing), so select the KO hook by its effect type, not by position.
  const koHook = hooks.find((hook) => hook.cardId === cardId && hook.effects?.[0]?.type === KO_EFFECT_TYPE);
  assert.ok(koHook !== undefined, `${cardSlug} has an ${KO_EFFECT_TYPE} hook`);
  return { cardId, koHook };
}

/**
 * Minimal state for driving executeHeroEffects and resolveOptionalKoReward.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param playedCardId - The card being played (given Bishop's printed Ranged class).
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], playedCardId: CardExtId): LegendaryGameState {
  const cardTraits: Record<string, object> = {
    [COVERT_HERO]: { team: 'x-men', heroClass: 'covert' },
    [STRENGTH_HERO]: { team: 'avengers', heroClass: 'strength' },
    [playedCardId]: { team: 'x-men', heroClass: 'ranged' },
  };
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] } },
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
 * Plays a card after the given cards, with the given deck, hand and discard pile.
 *
 * @param G - The game state, mutated in place.
 * @param setup - Cards played earlier this turn, deck, hand and discard pile.
 * @param cardId - The card being played now.
 */
function play(
  G: LegendaryGameState,
  setup: { playedBefore: string[]; deck: string[]; hand: string[]; discard: string[] },
  cardId: CardExtId,
): void {
  const playerZones = G.playerZones['0']!;
  playerZones.inPlay = [...(setup.playedBefore as CardExtId[]), cardId];
  playerZones.deck = [...(setup.deck as CardExtId[])];
  playerZones.hand = [...(setup.hand as CardExtId[])];
  playerZones.discard = [...(setup.discard as CardExtId[])];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * Resolves the front optional-KO choice for player 0.
 *
 * @param G - The game state, mutated in place.
 * @param args - The decline flag or the { zone, cardId } to KO.
 */
function resolve(
  G: LegendaryGameState,
  args: { decline: true } | { zone: 'hand' | 'discard' | 'inPlay'; cardId: string },
): void {
  resolveOptionalKoReward({ G, playerID: '0', ...mockCtx } as never, args as never);
}

/**
 * The entry a no-reward hand-or-discard KO parks (WP-667 / D-24480).
 *
 * @param cardId - The card whose ability parked it.
 * @returns The expected pending entry.
 */
function expectedParkedEntry(cardId: CardExtId): object {
  return { playerID: '0', rewardType: 'none', rewardMagnitude: 0, sourceCardId: cardId, koZones: ['hand', 'discard'] };
}

describe('WP-851 bare "You may KO a card from your hand or discard pile." executes (D-24787)', () => {
  it('T1 all 11 marked lines parse to the optional KO under their printed gate, with nothing unresolved', () => {
    for (const line of SWEPT_LINES) {
      const label = `${line.setAbbr}/${line.heroSlug}/${line.cardSlug}`;
      const { koHook } = firstCopyKoHook(buildHeroHooks(line.setAbbr, line.heroSlug), line.cardSlug);
      assert.deepEqual(koHook.effects, [{ type: KO_EFFECT_TYPE }], `${label} effect`);
      assert.deepEqual(koHook.conditions ?? [], line.conditions, `${label} gate`);
      assert.deepEqual(koHook.unresolvedMarkers ?? [], [], `${label} leaves no marker unresolved`);
    }
  });

  const bishopHooks = buildHeroHooks('dkcy', 'bishop');
  const bishop = firstCopyKoHook(bishopHooks, 'whatever-the-cost');

  it('T2 Bishop with no Covert Hero played before it draws, parks nothing, and no longer says "not supported yet"', () => {
    const G = makeState(bishopHooks, bishop.cardId);
    play(G, { playedBefore: [STRENGTH_HERO], deck: [DECK_CARD], hand: [HAND_CARD], discard: [DISCARD_CARD] }, bishop.cardId);
    // why: heroClassMatch counts the OTHER Heroes played this turn, and only a Strength Hero came
    // before Bishop, so the Covert gate fails exactly as it did in match Ps0Hg_m5B-H.
    assert.equal(G.pendingOptionalKoRewards ?? undefined, undefined, 'nothing parks');
    assert.deepEqual(G.playerZones['0']!.hand, [HAND_CARD, DECK_CARD], 'line 0 still draws a card');
    assert.ok(!G.messages.some((line) => line.text.includes('not supported yet')), 'the line is no longer reported unsupported');
  });

  it('T3 Bishop after a Covert Hero parks one hand-or-discard KO with no reward', () => {
    const G = makeState(bishopHooks, bishop.cardId);
    play(G, { playedBefore: [COVERT_HERO], deck: [DECK_CARD], hand: [HAND_CARD], discard: [DISCARD_CARD] }, bishop.cardId);
    assert.deepEqual(G.pendingOptionalKoRewards, [expectedParkedEntry(bishop.cardId)]);
  });

  it('T4 an in-play target is rejected; a discard-pile card is KO\'d and the choice closes', () => {
    const G = makeState(bishopHooks, bishop.cardId);
    play(G, { playedBefore: [COVERT_HERO], deck: [DECK_CARD], hand: [HAND_CARD], discard: [DISCARD_CARD] }, bishop.cardId);
    resolve(G, { zone: 'inPlay', cardId: COVERT_HERO });
    assert.deepEqual(G.ko, [], 'a card played this turn is not a legal target');
    assert.equal(G.pendingOptionalKoRewards!.length, 1, 'the choice is still pending');
    resolve(G, { zone: 'discard', cardId: DISCARD_CARD });
    assert.deepEqual(G.ko, [DISCARD_CARD]);
    assert.deepEqual(G.playerZones['0']!.discard, []);
    assert.deepEqual(G.pendingOptionalKoRewards, []);
  });

  it('T5 a hand card can be KO\'d, and declining KOs nothing', () => {
    const koHand = makeState(bishopHooks, bishop.cardId);
    play(koHand, { playedBefore: [COVERT_HERO], deck: [DECK_CARD], hand: [HAND_CARD], discard: [] }, bishop.cardId);
    resolve(koHand, { zone: 'hand', cardId: HAND_CARD });
    assert.deepEqual(koHand.ko, [HAND_CARD]);

    const decline = makeState(bishopHooks, bishop.cardId);
    play(decline, { playedBefore: [COVERT_HERO], deck: [DECK_CARD], hand: [HAND_CARD], discard: [DISCARD_CARD] }, bishop.cardId);
    resolve(decline, { decline: true });
    assert.deepEqual(decline.ko, []);
    assert.deepEqual(decline.pendingOptionalKoRewards, []);
  });

  it('T6 an ungated line (Stingray) with an empty hand and discard pile parks nothing and logs why', () => {
    const stingrayHooks = buildHeroHooks('dead', 'stingray');
    const stingray = firstCopyKoHook(stingrayHooks, 'phd-in-oceanography');
    const G = makeState(stingrayHooks, stingray.cardId);
    play(G, { playedBefore: [], deck: [], hand: [], discard: [] }, stingray.cardId);
    assert.equal(G.pendingOptionalKoRewards ?? undefined, undefined);
    assert.ok(G.messages.some((line) => line.text.includes('could not KO a card')));
  });

  it('T7 Gamora waits until two cards are drawn this turn, then parks the KO once', () => {
    const gamoraHooks = buildHeroHooks('mgtg', 'gamora');
    const gamora = firstCopyKoHook(gamoraHooks, 'stolen-necroblaster');
    const G = makeState(gamoraHooks, gamora.cardId);
    G.turnEconomy.cardsDrawn = 1;
    play(G, { playedBefore: [], deck: [], hand: [HAND_CARD], discard: [DISCARD_CARD] }, gamora.cardId);
    // why: D-24377 — "this turn" thresholds are judged over the whole turn, so with one card drawn
    // the KO waits rather than whiffing. turn.onMove runs resolveDeferredHeroGrants after every
    // move; the test calls it directly once the second draw lands.
    assert.equal(G.pendingOptionalKoRewards ?? undefined, undefined, 'one draw is not enough');
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingOptionalKoRewards ?? undefined, undefined, 'still one draw');
    G.turnEconomy.cardsDrawn = 2;
    resolveDeferredHeroGrants(G, mockCtx);
    assert.deepEqual(G.pendingOptionalKoRewards, [expectedParkedEntry(gamora.cardId)]);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingOptionalKoRewards!.length, 1, 'the KO is granted once, not on every later move');
  });
});

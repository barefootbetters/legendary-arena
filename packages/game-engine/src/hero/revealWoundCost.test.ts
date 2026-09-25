/**
 * Reveal cost of a Wound (D-24583).
 *
 * A Wound has no printed cost and no G.cardStats entry, and the reveal handler skipped
 * any deck-top card without stats — so every "Reveal the top card of your deck. If it
 * costs 0, KO it" silently passed over a Wound, the effect's main tabletop use. The
 * reveal now reads a Wound as cost 0 (resolveRevealedCardCost), without adding a Wound
 * entry to the hashed G.cardStats.
 *
 * Drives real parsed hooks through executeHeroEffects. No boardgame.io imports.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: the reveal-ko marker line as the card data carries it (4 corpus cards use
// [keyword:reveal-ko]); the See Future Timelines line is verbatim from data/cards/vnom.json.
const REVEAL_KO_ABILITY = 'Reveal the top card of your deck. If it costs 0, KO it. [keyword:reveal-ko]';
const SEE_FUTURE_TIMELINES_ABILITY =
  '[hc:ranged]: Reveal the top card of your deck. If it costs 0, discard it and you get ' +
  '+2[icon:attack]. [keyword:reveal:cost-zero:discard+attack-fixed-2]';

const RANGED_ALLY = 'test/ally/ranged-ally#0';
const UNCOSTED_CARD = 'test/unknown/no-stats#0';
const PRICED_CARD = 'test/deck/priced#0';

/** Builds a minimal getSet registry with one hero card carrying the supplied ability. */
function makeRegistry(heroSlug: string, cardSlug: string, ability: string): unknown {
  const setData = {
    abbr: 'test',
    heroes: [{
      slug: heroSlug,
      cards: [{ slug: cardSlug, abilities: [ability] }],
      physicalCards: [{ id: 'p0', count: 1, sides: [cardSlug] }],
    }],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'test' }],
    getSet: (abbr: string) => (abbr === 'test' ? setData : undefined),
  };
}

/** Parses one ability line into its single hook (`test/<hero>/<card>#0`). */
function buildHook(heroSlug: string, cardSlug: string, ability: string): HeroAbilityHook {
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: [`test/${heroSlug}`],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  const hooks = buildHeroAbilityHooks(makeRegistry(heroSlug, cardSlug, ability), config);
  const hook = hooks.find((candidate) => candidate.cardId === `test/${heroSlug}/${cardSlug}#0`);
  assert.ok(hook !== undefined, `the ${cardSlug} hook is built from the marked ability line`);
  return hook;
}

/**
 * Minimal state: the hook's card in play beside a Ranged ally (for a [hc:ranged] gate) and
 * the supplied deck. Only PRICED_CARD has a cardStats entry — the Wound deliberately has none,
 * exactly as in a real match.
 */
function makeState(hook: HeroAbilityHook, deck: string[]): LegendaryGameState {
  return {
    messages: [],
    ko: [],
    hq: [null, null, null, null, null],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': makePlayerZones({ deck, inPlay: [RANGED_ALLY, hook.cardId] }),
    },
    heroAbilityHooks: [hook],
    cardTraits: { [RANGED_ALLY]: { heroClass: 'ranged' } },
    cardStats: { [PRICED_CARD]: { cost: 3, attack: 0, recruit: 0 } },
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const mockCtx = { random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() }, turn: 1 };

describe('reveal reads a Wound as cost 0 (D-24583)', () => {
  it('"If it costs 0, KO it" KOs a Wound on top of the deck', () => {
    const hook = buildHook('ko-hero', 'reveal-ko-card', REVEAL_KO_ABILITY);
    const gameState = makeState(hook, [WOUND_EXT_ID, PRICED_CARD]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.deepStrictEqual(gameState.ko, [WOUND_EXT_ID], 'the Wound is KOd');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, [PRICED_CARD], 'the Wound left the deck');
  });

  it('See Future Timelines discards a Wound on top for exactly +2 attack', () => {
    const hook = buildHook('venomized-dr-strange', 'see-future-timelines', SEE_FUTURE_TIMELINES_ABILITY);
    const gameState = makeState(hook, [WOUND_EXT_ID]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.discard, [WOUND_EXT_ID], 'the Wound is discarded');
    assert.equal(gameState.turnEconomy.attack, 2, 'the cost-0 match grants +2');
  });

  it('a priced card on top is still left alone by "If it costs 0, KO it"', () => {
    const hook = buildHook('ko-hero', 'reveal-ko-card', REVEAL_KO_ABILITY);
    const gameState = makeState(hook, [PRICED_CARD]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.deepStrictEqual(gameState.ko, [], 'nothing is KOd');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, [PRICED_CARD], 'the deck is untouched');
  });

  it('a non-Wound card with no stats is still skipped, never guessed as cost 0', () => {
    const hook = buildHook('ko-hero', 'reveal-ko-card', REVEAL_KO_ABILITY);
    const gameState = makeState(hook, [UNCOSTED_CARD]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.deepStrictEqual(gameState.ko, [], 'an unknown card is not treated as cost 0');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, [UNCOSTED_CARD], 'the deck is untouched');
  });
});

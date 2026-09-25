/**
 * Reveal fixed-attack icon suppression + the reveal 'discard' action (D-24582).
 *
 * A reveal line prints its conditional reward as an icon ("If it costs 0, KO it and you
 * get +1[icon:attack]"). The icon-magnitude (Step 2b) and icon->keyword (Step 3) reads in
 * buildHeroAbilityHooks promoted that printed icon to a plain, UNCONDITIONAL attack effect
 * beside the reveal. Observed live (match a2e01e70, round 24): vnom See Future Timelines
 * (unmarked) granted +2 attack with no reveal and no cost check; ssw2's reveal-ko-attack
 * card granted +1 on every play plus the real conditional +1. The parse site now drops the
 * plain icon keyword whenever the reveal's matched rule carries an attack-fixed grant, and
 * See Future Timelines is marked with the new 'discard' reveal action.
 *
 * The parse tests pin the effect list built from the real marked lines; the behaviour
 * tests drive the same parsed hooks through executeHeroEffects.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: the exact generated ability lines, verified against data/cards/vnom.json
// (venomized-dr-strange/see-future-timelines) and data/cards/ssw2.json (the tech
// reveal-ko-attack line).
const SEE_FUTURE_TIMELINES_ABILITY =
  '[hc:ranged]: Reveal the top card of your deck. If it costs 0, discard it and you get ' +
  '+2[icon:attack]. [keyword:reveal:cost-zero:discard+attack-fixed-2]';
const REVEAL_KO_ATTACK_ABILITY =
  '[hc:tech]: Reveal the top card of your deck. If it costs 0, KO it and you get ' +
  '+1[icon:attack]. [keyword:reveal-ko-attack:1]';
const PLAIN_ATTACK_ABILITY = '[hc:ranged]: You get +2[icon:attack].';

const RANGED_ALLY = 'test/ally/ranged-ally#0';
const TECH_ALLY = 'test/ally/tech-ally#0';
const ZERO_COST_TOP = 'test/deck/zero-cost#0';
const PRICED_TOP = 'test/deck/priced#0';

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
 * Minimal state: the parsed hook's card in play beside a class ally that satisfies its
 * [hc:X] gate, and the supplied deck. Deck cards carry their cost in cardStats.
 */
function makeState(hook: HeroAbilityHook, allyId: string, allyClass: string, deck: string[]): LegendaryGameState {
  return {
    messages: [],
    ko: [],
    hq: [null, null, null, null, null],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': makePlayerZones({ deck, inPlay: [allyId, hook.cardId] }),
    },
    heroAbilityHooks: [hook],
    cardTraits: { [allyId]: { heroClass: allyClass } },
    cardStats: {
      [ZERO_COST_TOP]: { cost: 0, attack: 0, recruit: 0 },
      [PRICED_TOP]: { cost: 3, attack: 0, recruit: 0 },
    },
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const mockCtx = { random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() }, turn: 1 };

describe('reveal fixed-attack icon suppression + discard action (D-24582)', () => {
  it('See Future Timelines parses to the reveal only — discard then +2, no plain attack effect', () => {
    const hook = buildHook('venomized-dr-strange', 'see-future-timelines', SEE_FUTURE_TIMELINES_ABILITY);
    assert.deepStrictEqual(hook.effects, [
      {
        type: 'reveal',
        revealCount: 1,
        revealRules: [
          {
            predicate: { kind: 'cost-zero' },
            actions: [{ kind: 'discard' }, { kind: 'attack-fixed', amount: 2 }],
          },
        ],
      },
    ]);
    assert.ok(!hook.keywords.includes('attack'), 'the printed attack icon adds no plain attack keyword');
  });

  it('See Future Timelines with a cost-0 top card discards it and grants exactly +2 attack', () => {
    const hook = buildHook('venomized-dr-strange', 'see-future-timelines', SEE_FUTURE_TIMELINES_ABILITY);
    const gameState = makeState(hook, RANGED_ALLY, 'ranged', [ZERO_COST_TOP, PRICED_TOP]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    const zones = gameState.playerZones['0']!;
    assert.equal(gameState.turnEconomy.attack, 2, 'the conditional +2 is granted once');
    assert.deepStrictEqual(zones.discard, [ZERO_COST_TOP], 'the cost-0 card is discarded');
    assert.deepStrictEqual(zones.deck, [PRICED_TOP], 'the discarded card left the deck');
    assert.deepStrictEqual(gameState.ko, [], 'nothing is KOd (discard, not KO)');
  });

  it('See Future Timelines with a priced top card grants nothing and leaves the card on top', () => {
    const hook = buildHook('venomized-dr-strange', 'see-future-timelines', SEE_FUTURE_TIMELINES_ABILITY);
    const gameState = makeState(hook, RANGED_ALLY, 'ranged', [PRICED_TOP, ZERO_COST_TOP]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    const zones = gameState.playerZones['0']!;
    assert.equal(gameState.turnEconomy.attack, 0, 'no cost-0 reveal means no attack');
    assert.deepStrictEqual(zones.deck, [PRICED_TOP, ZERO_COST_TOP], 'the deck is untouched');
    assert.deepStrictEqual(zones.discard, [], 'nothing is discarded');
  });

  it('See Future Timelines without another Ranged Hero does nothing', () => {
    const hook = buildHook('venomized-dr-strange', 'see-future-timelines', SEE_FUTURE_TIMELINES_ABILITY);
    const gameState = makeState(hook, TECH_ALLY, 'tech', [ZERO_COST_TOP]);
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.equal(gameState.turnEconomy.attack, 0, 'the [hc:ranged] gate is unmet');
    assert.deepStrictEqual(gameState.playerZones['0']!.deck, [ZERO_COST_TOP], 'the deck is untouched');
  });

  it('the ssw2 reveal-ko-attack line parses to the reveal only — no plain attack effect', () => {
    const hook = buildHook('tech-hero', 'reveal-ko-attack-card', REVEAL_KO_ATTACK_ABILITY);
    assert.equal(hook.effects.length, 1, 'exactly one effect: the reveal');
    assert.equal(hook.effects[0]!.type, 'reveal');
    assert.ok(!hook.keywords.includes('attack'), 'the printed attack icon adds no plain attack keyword');
  });

  it('the ssw2 reveal-ko-attack line grants 0 on a priced top and exactly +1 on a cost-0 top', () => {
    const hook = buildHook('tech-hero', 'reveal-ko-attack-card', REVEAL_KO_ATTACK_ABILITY);
    const pricedState = makeState(hook, TECH_ALLY, 'tech', [PRICED_TOP]);
    executeHeroEffects(pricedState, mockCtx, '0', hook.cardId);
    assert.equal(pricedState.turnEconomy.attack, 0, 'no free +1 on every play');
    const zeroState = makeState(hook, TECH_ALLY, 'tech', [ZERO_COST_TOP]);
    executeHeroEffects(zeroState, mockCtx, '0', hook.cardId);
    assert.equal(zeroState.turnEconomy.attack, 1, 'the reward is granted once, not twice');
    assert.deepStrictEqual(zeroState.ko, [ZERO_COST_TOP], 'the cost-0 card is KOd');
  });

  it('a plain attack line with no reveal keeps its attack effect — suppression is a no-op', () => {
    const hook = buildHook('ranged-hero', 'plain-attack-card', PLAIN_ATTACK_ABILITY);
    assert.deepStrictEqual(hook.effects, [{ type: 'attack', magnitude: 2 }]);
  });
});

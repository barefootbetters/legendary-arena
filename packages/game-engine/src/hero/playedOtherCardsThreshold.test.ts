/**
 * "If you played at least N other cards this turn, you get +2 Attack" (D-24746).
 *
 * Winter Soldier's KGB Training (ca75, N=7), Iron Man's Repulsor Rays (co2e, N=8) and
 * Cannonball's Human Cannon (xmen, N=6) carry no marker, so buildHeroAbilityHooks parsed the
 * line to an UNGATED attack:2 granted on every play. A text gate now pushes a playedThisTurn
 * condition. The played card is already in inPlay when its gate is read (applyCardPlay
 * appends it before executeHeroEffects), and playedThisTurn counts every played card, so the
 * threshold is N + 1. These tests drive the real play path at N-1, N and N+1 OTHER cards.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { applyCardPlay } from '../moves/coreMoves.impl.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

/** One printed card under test: where it lives and its printed "N other cards". */
interface ThresholdCard {
  setAbbr: string;
  heroDeckId: string;
  cardPrefix: string;
  otherCardsRequired: number;
}

const THRESHOLD_CARDS: readonly ThresholdCard[] = [
  { setAbbr: 'ca75', heroDeckId: 'ca75/winter-soldier', cardPrefix: 'ca75/winter-soldier/kgb-training#', otherCardsRequired: 7 },
  { setAbbr: 'co2e', heroDeckId: 'co2e/iron-man', cardPrefix: 'co2e/iron-man/repulsor-rays#', otherCardsRequired: 8 },
  { setAbbr: 'xmen', heroDeckId: 'xmen/cannonball', cardPrefix: 'xmen/cannonball/human-cannon#', otherCardsRequired: 6 },
];

// why: the printed bonus on all three lines is "+2[icon:attack]".
const PRINTED_BONUS = 2;

const playContext = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds a one-set registry reader from the COMMITTED data/cards JSON, so the test parses the
 * shipped ability line rather than a hand-typed literal.
 *
 * @param setAbbr - Set abbreviation (the data/cards/<abbr>.json file).
 * @returns A structural registry reader for buildHeroAbilityHooks.
 */
function registryForSet(setAbbr: string): unknown {
  // why: resolve the repo-root data file from this test's own location (the
  // masterStrikeOrAmbushCondition.test.ts precedent), so the test reads what ships.
  const here = dirname(fileURLToPath(import.meta.url));
  const setData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${setAbbr}.json`), 'utf8'));
  return { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
}

/**
 * Parses one hero deck and returns every hook for the card's first copy.
 *
 * @param card - The card under test.
 * @returns The hooks built for that card copy (one per ability line).
 */
function buildCardHooks(card: ThresholdCard): HeroAbilityHook[] {
  const config = { heroDeckIds: [card.heroDeckId] } as unknown as MatchConfiguration;
  const hooks = buildHeroAbilityHooks(registryForSet(card.setAbbr), config);
  const firstCopyId = hooks.find((hook) => hook.cardId.startsWith(card.cardPrefix))?.cardId;
  assert.ok(firstCopyId !== undefined, `${card.cardPrefix} must build at least one hook`);
  return hooks.filter((hook) => hook.cardId === firstCopyId);
}

/**
 * Returns the hook that carries the printed +2 attack grant.
 *
 * @param hooks - The card's hooks.
 * @param cardPrefix - Card id prefix, for the failure message.
 * @returns The attack-granting hook.
 */
function findAttackHook(hooks: HeroAbilityHook[], cardPrefix: string): HeroAbilityHook {
  const attackHook = hooks.find((hook) => (hook.effects ?? []).some((effect) => effect.type === 'attack'));
  assert.ok(attackHook !== undefined, `${cardPrefix} must carry an attack effect`);
  return attackHook;
}

/**
 * Minimal state for applyCardPlay: the card's hooks and `otherCardCount` cards already played.
 *
 * @param hooks - The card's hooks.
 * @param otherCardCount - How many OTHER cards are already in play this turn.
 * @returns A LegendaryGameState sufficient for one play.
 */
function makeState(hooks: HeroAbilityHook[], otherCardCount: number): LegendaryGameState {
  const alreadyPlayed: CardExtId[] = [];
  for (let i = 0; i < otherCardCount; i++) {
    alreadyPlayed.push(`test/filler/played-card#${i}` as CardExtId);
  }
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), inPlay: alreadyPlayed } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits: {},
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
 * Plays the card through applyCardPlay after `otherCardCount` other cards and returns the
 * attack its hooks added (cardStats is empty, so base attack contributes nothing).
 *
 * @param hooks - The card's hooks.
 * @param otherCardCount - How many OTHER cards were played first.
 * @returns The attack gained from the play.
 */
function attackFromPlay(hooks: HeroAbilityHook[], otherCardCount: number): number {
  const G = makeState(hooks, otherCardCount);
  const cardId = hooks[0]!.cardId;
  applyCardPlay(G, playContext as unknown as Parameters<typeof applyCardPlay>[1], '0', cardId);
  assert.ok(G.playerZones['0']!.inPlay.includes(cardId), 'the played card is in play');
  return G.turnEconomy.attack;
}

describe('D-24746 parse: "played at least N other cards" gates the +2 attack', () => {
  for (const card of THRESHOLD_CARDS) {
    it(`${card.cardPrefix} parses to playedThisTurn ${card.otherCardsRequired + 1} + attack ${PRINTED_BONUS}`, () => {
      const attackHook = findAttackHook(buildCardHooks(card), card.cardPrefix);
      assert.deepEqual(attackHook.conditions, [
        { type: 'playedThisTurn', value: String(card.otherCardsRequired + 1) },
      ]);
      assert.deepEqual(attackHook.effects, [{ type: 'attack', magnitude: PRINTED_BONUS }]);
      assert.ok(attackHook.keywords.includes('conditional'), 'the gated hook is marked conditional');
    });
  }
});

describe('D-24746 play: the bonus lands at exactly N other cards, through applyCardPlay', () => {
  for (const card of THRESHOLD_CARDS) {
    const required = card.otherCardsRequired;

    it(`${card.cardPrefix} with ${required - 1} other cards played: no bonus`, () => {
      assert.equal(attackFromPlay(buildCardHooks(card), required - 1), 0);
    });

    it(`${card.cardPrefix} with ${required} other cards played: +${PRINTED_BONUS}`, () => {
      assert.equal(attackFromPlay(buildCardHooks(card), required), PRINTED_BONUS);
    });

    it(`${card.cardPrefix} with ${required + 1} other cards played: +${PRINTED_BONUS}`, () => {
      assert.equal(attackFromPlay(buildCardHooks(card), required + 1), PRINTED_BONUS);
    });

    it(`${card.cardPrefix} as the first card of the turn: no bonus`, () => {
      assert.equal(attackFromPlay(buildCardHooks(card), 0), 0);
    });
  }
});

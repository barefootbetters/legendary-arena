/**
 * Reward-handler icon suppression — ko-wound-reward + put-bottom-hq-icon-reward (D-24570).
 *
 * A reward-handler marker line prints its reward as an icon ("If you do, you get
 * +2[icon:attack]"). The icon-magnitude (Step 2b) and icon->keyword (Step 3) reads in
 * buildHeroAbilityHooks promoted that printed icon to a plain, UNCONDITIONAL attack /
 * recruit effect beside the handler. Observed on the real corpus: Unstoppable Hulk
 * granted +2 attack with no Wound to KO and +4 with one; Wonder Man's Absorb Ambient
 * Power granted a free +3 recruit AND +3 attack on every play on top of the real
 * resolve-time icon reward. The parse site now drops the plain icon keyword whenever
 * the handler supplies the reward (the D-24398 optional-ko-reward precedent).
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
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: the exact generated ability lines, verified against data/cards/core.json
// (hulk/unstoppable-hulk), data/cards/ff04.json (human-torch/call-for-backup) and
// data/cards/antm.json (wonder-man/absorb-ambient-power).
const UNSTOPPABLE_HULK_ABILITY =
  'You may KO a Wound from your hand or discard pile. If you do, you get +2[icon:attack]. ' +
  '[keyword:ko-wound-reward:attack:2]';
const CALL_FOR_BACKUP_ABILITY =
  'You may KO a Wound from your hand or discard pile. If you do, you get +1[icon:recruit]. ' +
  '[keyword:ko-wound-reward:recruit:1]';
const DRAW_REWARD_ABILITY =
  'You may KO a Wound from your hand or discard pile. If you do, draw a card. ' +
  '[keyword:ko-wound-reward:draw:1]';
const ABSORB_AMBIENT_POWER_ABILITY =
  'Put a card from the HQ on the bottom of the Hero Deck. If that card had a [icon:recruit] icon, ' +
  'you get +3[icon:recruit]. If that card had an [icon:attack] icon, you get +3[icon:attack]. ' +
  '(if both, get both.) [keyword:put-bottom-hq-icon-reward:3]';

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

/** Minimal state with the parsed hook in play and the supplied hand / discard / HQ. */
function makeState(
  hook: HeroAbilityHook,
  zones: { hand?: string[]; discard?: string[]; hq?: (string | null)[] },
): LegendaryGameState {
  return {
    messages: [],
    ko: [],
    hq: zones.hq ?? [null, null, null, null, null],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': makePlayerZones({
        hand: zones.hand ?? [],
        discard: zones.discard ?? [],
        inPlay: [hook.cardId],
      }),
    },
    heroAbilityHooks: [hook],
    cardTraits: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const mockCtx = { random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() }, turn: 1 };

describe('ko-wound-reward icon suppression (D-24570)', () => {
  it('Unstoppable Hulk parses to the Wound-gated reward only — no plain attack effect', () => {
    const hook = buildHook('hulk', 'unstoppable-hulk', UNSTOPPABLE_HULK_ABILITY);
    assert.deepStrictEqual(hook.effects, [
      { type: 'ko-wound-reward', magnitude: 2, rewardType: 'attack' },
    ]);
    assert.ok(!hook.keywords.includes('attack'), 'the printed attack icon adds no plain attack keyword');
  });

  it('Unstoppable Hulk with NO Wound grants no attack', () => {
    const hook = buildHook('hulk', 'unstoppable-hulk', UNSTOPPABLE_HULK_ABILITY);
    const gameState = makeState(hook, { hand: ['card-x'] });
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.equal(gameState.turnEconomy.attack, 0, 'no Wound to KO means no reward');
    assert.deepStrictEqual(gameState.ko, [], 'nothing is KOd');
  });

  it('Unstoppable Hulk with a Wound in hand grants exactly +2 attack', () => {
    const hook = buildHook('hulk', 'unstoppable-hulk', UNSTOPPABLE_HULK_ABILITY);
    const gameState = makeState(hook, { hand: [WOUND_EXT_ID] });
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.equal(gameState.turnEconomy.attack, 2, 'the reward is granted once, not twice');
    assert.deepStrictEqual(gameState.ko, [WOUND_EXT_ID]);
  });

  it('Unstoppable Hulk with a Wound in the discard pile grants exactly +2 attack', () => {
    const hook = buildHook('hulk', 'unstoppable-hulk', UNSTOPPABLE_HULK_ABILITY);
    const gameState = makeState(hook, { discard: [WOUND_EXT_ID] });
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.equal(gameState.turnEconomy.attack, 2, 'the reward is granted once, not twice');
    assert.deepStrictEqual(gameState.playerZones['0']!.discard, []);
  });

  it('Call for Backup (recruit reward) grants 0 without a Wound and exactly +1 with one', () => {
    const hook = buildHook('human-torch', 'call-for-backup', CALL_FOR_BACKUP_ABILITY);
    assert.deepStrictEqual(hook.effects, [
      { type: 'ko-wound-reward', magnitude: 1, rewardType: 'recruit' },
    ]);

    const noWoundState = makeState(hook, { hand: [] });
    executeHeroEffects(noWoundState, mockCtx, '0', hook.cardId);
    assert.equal(noWoundState.turnEconomy.recruit, 0, 'no Wound to KO means no reward');

    const woundState = makeState(hook, { hand: [WOUND_EXT_ID] });
    executeHeroEffects(woundState, mockCtx, '0', hook.cardId);
    assert.equal(woundState.turnEconomy.recruit, 1, 'the reward is granted once, not twice');
  });

  it('a draw-reward line (no reward icon) is unchanged — suppression is a no-op', () => {
    const hook = buildHook('test-hero', 'draw-reward-card', DRAW_REWARD_ABILITY);
    assert.deepStrictEqual(hook.effects, [
      { type: 'ko-wound-reward', magnitude: 1, rewardType: 'draw' },
    ]);
  });
});

describe('put-bottom-hq-icon-reward icon suppression (D-24570)', () => {
  it('Absorb Ambient Power parses to the icon-reward park only — no plain recruit or attack', () => {
    const hook = buildHook('wonder-man', 'absorb-ambient-power', ABSORB_AMBIENT_POWER_ABILITY);
    assert.deepStrictEqual(hook.effects, [
      { type: 'put-bottom-hq-icon-reward', magnitude: 3 },
    ]);
    assert.ok(!hook.keywords.includes('attack'), 'the printed attack icon adds no plain attack keyword');
    assert.ok(!hook.keywords.includes('recruit'), 'the printed recruit icon adds no plain recruit keyword');
  });

  it('playing Absorb Ambient Power grants nothing up front and parks the +3 icon reward', () => {
    const hook = buildHook('wonder-man', 'absorb-ambient-power', ABSORB_AMBIENT_POWER_ABILITY);
    const gameState = makeState(hook, { hq: ['hq-card-1', null, null, null, null] });
    executeHeroEffects(gameState, mockCtx, '0', hook.cardId);
    assert.equal(gameState.turnEconomy.attack, 0, 'no unconditional attack grant on play');
    assert.equal(gameState.turnEconomy.recruit, 0, 'no unconditional recruit grant on play');
    assert.equal(gameState.pendingOptionalPutBottomHQ?.length, 1, 'the mandatory HQ choice parks');
    assert.equal(gameState.pendingOptionalPutBottomHQ?.[0]?.iconRewardMagnitude, 3);
  });
});

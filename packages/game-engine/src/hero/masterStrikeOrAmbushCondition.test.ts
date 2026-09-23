/**
 * Spring the Trap / Grief — Master Strike (or Ambush Villain) this-turn gate
 * (WP-743 / D-24566).
 *
 * Venom Rocket's Spring the Trap ("If a Master Strike or Villain that has an Ambush
 * ability was played this turn, you get +1 Attack") and Wanda & Vision's Grief ("If a
 * Master Strike was completed this turn, you get +2 Recruit") formerly parsed to flat,
 * unconditional grants. These tests pin the corrected behaviour: two marker→condition
 * arms, two sticky per-turn wait-and-see conditions, and two gated lazy G flags written
 * only in performVillainReveal and deleted at the turn boundary.
 *
 * No boardgame.io imports (the real LegendaryGame is imported only to invoke its
 * play-phase turn.onBegin). node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from './heroEffects.execute.js';
import {
  evaluateCondition,
  matchReadsConditionType,
  MASTER_STRIKE_THIS_TURN_CONDITION_TYPE,
  MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE,
} from './heroConditions.evaluate.js';
import { performVillainReveal, playTopVillainDeckCards } from '../villainDeck/villainDeck.reveal.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { LegendaryGame } from '../game.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

const SPRING_ID = 'vnom/venom-rocket/spring-the-trap#0' as CardExtId;
const SPRING_ID_2 = 'vnom/venom-rocket/spring-the-trap#1' as CardExtId;
const GRIEF_ID = 'msis/wanda-vision/grief#0' as CardExtId;

const SPRING_HOOKS = [
  {
    cardId: SPRING_ID,
    timing: 'onPlay',
    keywords: ['attack', 'conditional'],
    conditions: [{ type: MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE, value: '1' }],
    effects: [{ type: 'attack', magnitude: 1 }],
  },
  {
    cardId: SPRING_ID_2,
    timing: 'onPlay',
    keywords: ['attack', 'conditional'],
    conditions: [{ type: MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE, value: '1' }],
    effects: [{ type: 'attack', magnitude: 1 }],
  },
] as unknown as HeroAbilityHook[];

const GRIEF_HOOKS = [
  {
    cardId: GRIEF_ID,
    timing: 'onPlay',
    keywords: ['recruit', 'conditional'],
    conditions: [{ type: MASTER_STRIKE_THIS_TURN_CONDITION_TYPE, value: '1' }],
    effects: [{ type: 'recruit', magnitude: 2 }],
  },
] as unknown as HeroAbilityHook[];

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Minimal state for driving performVillainReveal and the hero executor together.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param villainDeck - Top-first villain deck contents.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], villainDeck: CardExtId[] = []): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), inPlay: [] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [...villainDeck], discard: [] },
    villainDeckCardTypes: {
      'strike-01': 'mastermind-strike',
      'strike-02': 'mastermind-strike',
      'v-ambush': 'villain',
      'v-plain': 'villain',
      'bystander-villain-deck-01': 'bystander',
    },
    cardKeywords: { 'v-ambush': ['ambush'] },
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
 * Reveals the top villain-deck card through the real reveal pipeline.
 *
 * @param G - The game state, mutated in place.
 */
function reveal(G: LegendaryGameState): void {
  performVillainReveal(G, { random: mockCtx.random, ctx: { currentPlayer: '0' } }, DEFAULT_IMPLEMENTATION_MAP);
}

/**
 * Plays a hero card: puts it in play, then fires its hooks (the applyCardPlay order).
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The hero card being played.
 */
function play(G: LegendaryGameState, cardId: CardExtId): void {
  G.playerZones['0']!.inPlay = [...G.playerZones['0']!.inPlay, cardId];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * Builds a one-hero registry reader from the COMMITTED data/cards JSON, so the parse
 * test exercises the real marked ability line (not a hand-typed literal).
 *
 * @param setAbbr - Set abbreviation (the data/cards/<abbr>.json file).
 * @returns A structural registry reader for buildHeroAbilityHooks.
 */
function registryForSet(setAbbr: string): unknown {
  // why: resolve the repo-root data file from this test's own location (the
  // rules/effectRulings.test.ts precedent), so the test reads what ships.
  const here = dirname(fileURLToPath(import.meta.url));
  const setData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${setAbbr}.json`), 'utf8'));
  return { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
}

describe('WP-743 case 1: parse — both markers gate the printed grant', () => {
  it('Spring the Trap parses to masterStrikeOrAmbushPlayedThisTurn + attack 1, no unresolved marker', () => {
    const hooks = buildHeroAbilityHooks(registryForSet('vnom'), { heroDeckIds: ['vnom/venom-rocket'] } as unknown as MatchConfiguration);
    const hook = hooks.find((candidate) => candidate.cardId.startsWith('vnom/venom-rocket/spring-the-trap#'));
    assert.ok(hook !== undefined, 'Spring the Trap must build a hook');
    assert.deepEqual(hook.conditions, [{ type: 'masterStrikeOrAmbushPlayedThisTurn', value: '1' }]);
    assert.deepEqual(hook.effects, [{ type: 'attack', magnitude: 1 }]);
    assert.equal(hook.unresolvedMarkers, undefined);
  });

  it('Grief parses to masterStrikePlayedThisTurn + recruit 2, no unresolved marker', () => {
    const hooks = buildHeroAbilityHooks(registryForSet('msis'), { heroDeckIds: ['msis/wanda-vision'] } as unknown as MatchConfiguration);
    const hook = hooks.find((candidate) => candidate.cardId.startsWith('msis/wanda-vision/grief#'));
    assert.ok(hook !== undefined, 'Grief must build a hook');
    assert.deepEqual(hook.conditions, [{ type: 'masterStrikePlayedThisTurn', value: '1' }]);
    assert.deepEqual(hook.effects, [{ type: 'recruit', magnitude: 2 }]);
    assert.equal(hook.unresolvedMarkers, undefined);
  });
});

describe('WP-743 case 2: evaluate', () => {
  it('both conditions are false with the flags absent; Grief ignores the ambush flag', () => {
    const G = makeState([]);
    const grief = { type: MASTER_STRIKE_THIS_TURN_CONDITION_TYPE, value: '1' };
    const spring = { type: MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE, value: '1' };
    assert.equal(evaluateCondition(G, '0', grief), false);
    assert.equal(evaluateCondition(G, '0', spring), false);

    G.ambushVillainPlayedThisTurn = true;
    assert.equal(evaluateCondition(G, '0', spring), true, 'Spring accepts an Ambush Villain');
    assert.equal(evaluateCondition(G, '0', grief), false, 'Grief does NOT accept an Ambush Villain');

    delete G.ambushVillainPlayedThisTurn;
    G.masterStrikePlayedThisTurn = true;
    assert.equal(evaluateCondition(G, '0', spring), true);
    assert.equal(evaluateCondition(G, '0', grief), true);
  });
});

describe('WP-743 case 3: the write site is gated per flag', () => {
  it('a Master Strike reveal sets masterStrikePlayedThisTurn; an Ambush Villain sets ambushVillainPlayedThisTurn', () => {
    const G = makeState(SPRING_HOOKS, ['strike-01', 'v-ambush']);
    reveal(G);
    assert.equal(G.masterStrikePlayedThisTurn, true);
    reveal(G);
    assert.equal(G.ambushVillainPlayedThisTurn, true);
  });

  it('a non-Ambush Villain and a Bystander set neither flag', () => {
    const G = makeState(SPRING_HOOKS, ['v-plain', 'bystander-villain-deck-01']);
    reveal(G);
    reveal(G);
    assert.equal('masterStrikePlayedThisTurn' in G, false);
    assert.equal('ambushVillainPlayedThisTurn' in G, false);
  });

  it('with NO reading hook, neither key ever exists on G (oracle safety)', () => {
    const G = makeState([], ['strike-01', 'v-ambush']);
    reveal(G);
    reveal(G);
    assert.equal('masterStrikePlayedThisTurn' in G, false);
    assert.equal('ambushVillainPlayedThisTurn' in G, false);
    assert.equal(matchReadsConditionType(G, MASTER_STRIKE_THIS_TURN_CONDITION_TYPE), false);
  });

  it('per-flag gate: with only a Grief hook, an Ambush Villain sets nothing and a Master Strike sets the strike flag', () => {
    const G = makeState(GRIEF_HOOKS, ['v-ambush', 'strike-01']);
    reveal(G);
    assert.equal('ambushVillainPlayedThisTurn' in G, false, 'no Spring hook reads the ambush flag');
    reveal(G);
    assert.equal(G.masterStrikePlayedThisTurn, true);
  });
});

describe('WP-743 case 4: turn reset', () => {
  it('the real play-phase turn.onBegin deletes both flags, and is a no-op when they were never set', () => {
    const configuration: MatchConfiguration = {
      schemeId: 'test/test-scheme-001',
      mastermindId: 'test/test-mastermind-001',
      villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
      henchmanGroupIds: ['test/test-henchman-group-001'],
      heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const mockContext = makeMockCtx({ numPlayers: 2 });
    const gameState = LegendaryGame.setup!(
      mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
      configuration,
    );
    const playPhase = (
      LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
    ).play;
    const onBegin = playPhase?.turn?.onBegin;
    assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');
    const beginContext = {
      G: gameState,
      ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 1 },
      random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
      events: { setPhase: (): void => {}, endTurn: (): void => {} },
    };

    onBegin!(beginContext);
    assert.equal('masterStrikePlayedThisTurn' in gameState, false, 'never-set → still absent');
    assert.equal('ambushVillainPlayedThisTurn' in gameState, false, 'never-set → still absent');

    gameState.masterStrikePlayedThisTurn = true;
    gameState.ambushVillainPlayedThisTurn = true;
    onBegin!(beginContext);
    assert.equal('masterStrikePlayedThisTurn' in gameState, false, 'onBegin deletes the strike flag');
    assert.equal('ambushVillainPlayedThisTurn' in gameState, false, 'onBegin deletes the ambush flag');
  });

  it('applyOnBeginParity (the rebuilt-loop mirror) deletes both flags', () => {
    const G = makeState(SPRING_HOOKS);
    applyOnBeginParity(G, '0');
    assert.equal('masterStrikePlayedThisTurn' in G, false);

    G.masterStrikePlayedThisTurn = true;
    G.ambushVillainPlayedThisTurn = true;
    applyOnBeginParity(G, '0');
    assert.equal('masterStrikePlayedThisTurn' in G, false);
    assert.equal('ambushVillainPlayedThisTurn' in G, false);
  });
});

describe('WP-743 case 5: play-time grant', () => {
  it('after a Master Strike: Spring the Trap +1 Attack and Grief +2 Recruit on play', () => {
    const G = makeState([...SPRING_HOOKS, ...GRIEF_HOOKS], ['strike-01']);
    reveal(G);
    play(G, SPRING_ID);
    play(G, GRIEF_ID);
    assert.equal(G.turnEconomy.attack, 1);
    assert.equal(G.turnEconomy.recruit, 2);
    assert.equal(G.deferredConditionalGrants, undefined, 'nothing waits when the gate already passed');
  });

  it('after an Ambush Villain: Spring the Trap +1 Attack on play', () => {
    const G = makeState(SPRING_HOOKS, ['v-ambush']);
    reveal(G);
    play(G, SPRING_ID);
    assert.equal(G.turnEconomy.attack, 1);
  });
});

describe('WP-743 case 6: no event this turn (the live bot-game shape)', () => {
  it('Bystander-only turn: no grant on play, a deferred grant waits, and the turn boundary drops it', () => {
    const G = makeState(SPRING_HOOKS, ['bystander-villain-deck-01']);
    reveal(G);
    play(G, SPRING_ID);
    assert.equal(G.turnEconomy.attack, 0, 'no free +1 Attack');
    assert.equal(G.deferredConditionalGrants?.length, 1, 'the ability waits');

    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 0, 'still nothing without a strike or ambush');

    applyOnBeginParity(G, '0');
    assert.equal(G.deferredConditionalGrants, undefined, 'the turn boundary drops the waiting grant');
    assert.equal(G.turnEconomy.attack, 0);
  });
});

describe('WP-743 case 7: mid-turn Master Strike (one-shot)', () => {
  it('Spring played first, then a strike via playTopVillainDeckCards → +1 exactly once; a second strike adds nothing', () => {
    const G = makeState(SPRING_HOOKS, ['strike-01', 'strike-02']);
    play(G, SPRING_ID);
    assert.equal(G.turnEconomy.attack, 0);

    playTopVillainDeckCards(G, { random: mockCtx.random, ctx: { currentPlayer: '0' } }, DEFAULT_IMPLEMENTATION_MAP, 1);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 1, 'the waiting grant fires once the strike lands');

    playTopVillainDeckCards(G, { random: mockCtx.random, ctx: { currentPlayer: '0' } }, DEFAULT_IMPLEMENTATION_MAP, 1);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 1, 'shape #1: a second strike does not grant again');
  });

  it('two Spring the Trap copies played before the strike → +2 total, one grant per copy', () => {
    const G = makeState(SPRING_HOOKS, ['strike-01']);
    play(G, SPRING_ID);
    play(G, SPRING_ID_2);
    reveal(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 2);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.attack, 2, 'no extra grant on later resolutions');
  });
});

describe('WP-743 case 8: Grief and an Ambush-only turn', () => {
  it('an Ambush Villain alone never grants Grief', () => {
    const G = makeState([...SPRING_HOOKS, ...GRIEF_HOOKS], ['v-ambush']);
    reveal(G);
    play(G, GRIEF_ID);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 0, 'Grief needs a Master Strike');
  });
});

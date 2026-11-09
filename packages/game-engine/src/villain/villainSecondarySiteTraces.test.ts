/**
 * Secondary-site traces for the bridged deliberate-no-op villain primitives (WP-877 / D-24824).
 *
 * `play-villain-deck-cards`, `reenter-sewers-if-villain-deck-top` and `stack-cards-enter-city-as-villains` have
 * executor handlers that deliberately do nothing (their trace reads `no-op`); the real work runs in a fire-site
 * bridge after the defeat (`runVillainFightFireSiteBridges`) or after the Ambush (`performVillainReveal`). Each
 * bridge now records one `secondary-site` trace immediately before it runs, so the trace list says where the work
 * fired. The executor trace is unchanged.
 *
 * Hand-built hooks for Endless Armies of HYDRA, The Leader and Mr. Immortal; the committed card data for Groot
 * from Planet X and Agent Eric Marshall (the stack-entry descriptors carry parser-built fields). No boardgame.io
 * imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { defeatCityVillainCore, resolveVillainDeckDefeatFightEffect } from '../moves/fightVillain.js';
import { performVillainReveal } from '../villainDeck/villainDeck.reveal.js';
import { executeVillainAbilities, recordVillainSecondarySiteTrace } from './villainEffects.execute.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import type { EffectTrace } from '../diagnostics/hollowEffect.types.js';

// why: resolve the repo-root data directory from this test's own location (the reenterSewers.test.ts
// precedent), so the stack-entry cases read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
const ENDLESS_ARMIES = 'test-endless-armies-00' as CardExtId;
const THE_LEADER = 'test-the-leader-00' as CardExtId;
const MR_IMMORTAL = 'test-mr-immortal-00' as CardExtId;
const AMBUSH_VILLAIN = 'test-ambush-villain-00' as CardExtId;
const PLAIN_VILLAIN = 'test-plain-villain-00' as CardExtId;
const SYNTHETIC_HENCHMAN = 'test-henchman-00' as CardExtId;
const DRAW_VILLAIN = 'test-draw-villain-00' as CardExtId;
const HQ_HERO = 'core-hero-ironman' as CardExtId;
const STRENGTH_HERO = 'test-strength-hero-00' as CardExtId;
const FIGHT_CTX = { currentPlayer: '0', turn: 6 };
const SHUFFLE_CONTEXT = { random: makeMockCtx({ numPlayers: 1 }).random };
const AMBUSH_TURN = 7;

/**
 * Builds the real villain hooks for one set's groups from the committed card data.
 *
 * @param abbr - The set abbreviation.
 * @param groupIds - The `<set>/<group>` villain group ids.
 * @returns Every hook the groups produce.
 */
function buildRealHooks(abbr: string, groupIds: string[]): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${abbr}.json`), 'utf8'));
  const registry = { getSet: (requested: string) => (requested === abbr ? setData : undefined) };
  const config = { villainGroupIds: groupIds, henchmanGroupIds: [] } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const GROOT = 'chmp-villain-monsters-unleashed-groot-from-planet-x-00' as CardExtId;
const ERIC_MARSHALL = 'cvwr-villain-shield-elite-agent-eric-marshall-00' as CardExtId;
const REAL_STACK_HOOKS = [
  ...buildRealHooks('chmp', ['chmp/monsters-unleashed']),
  ...buildRealHooks('cvwr', ['cvwr/shield-elite']),
];

/** The Ambush hook the played card carries, so the bridge's played card writes its own trace. */
const AMBUSH_VILLAIN_HOOK: VillainAbilityHook = {
  cardId: AMBUSH_VILLAIN,
  timing: 'onAmbush',
  keywords: ['captureHqHeroRightmost'],
  effects: [{ primitive: 'capture-hq-hero', selector: 'rightmost' }],
};

/**
 * A one-seat state with the given City, hooks and Villain Deck.
 *
 * @param city - The five City spaces.
 * @param hooks - The villain ability hooks.
 * @param villainDeck - The Villain Deck, top first.
 * @returns The game state.
 */
function makeState(city: (CardExtId | null)[], hooks: VillainAbilityHook[], villainDeck: CardExtId[]): LegendaryGameState {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const G = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  G.playerZones = { '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] } };
  G.city = [...city];
  G.hq = [null, null, null, null, HQ_HERO];
  G.heroDeck = [];
  G.escapedPile = [];
  G.notableEvents = [];
  G.villainAttachedHeroes = {};
  G.attachedBystanders = {};
  G.villainAbilityHooks = hooks;
  G.villainDeck = { deck: [...villainDeck], discard: [] };
  G.villainDeckCardTypes = {};
  for (const cardId of [...city, ...villainDeck]) {
    if (cardId !== null) {
      G.villainDeckCardTypes[cardId] = 'villain';
    }
  }
  G.cardKeywords = { ...(G.cardKeywords ?? {}), [AMBUSH_VILLAIN]: ['ambush'], [THE_LEADER]: ['ambush'], [ERIC_MARSHALL]: ['ambush'] };
  G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] = 0;
  return G;
}

/**
 * The reveal context for the one seat.
 *
 * @returns The reveal context.
 */
function makeRevealContext(): RevealContext {
  return { random: SHUFFLE_CONTEXT.random, ctx: { currentPlayer: '0', turn: AMBUSH_TURN } };
}

/**
 * Every recorded trace, in order.
 *
 * @param G - The game state.
 * @returns The traces.
 */
function allTraces(G: LegendaryGameState): EffectTrace[] {
  return G.diagnostics?.traces ?? [];
}

/**
 * The traces recorded for one card, in order.
 *
 * @param G - The game state.
 * @param cardId - The card.
 * @returns The card's traces.
 */
function tracesFor(G: LegendaryGameState, cardId: CardExtId): EffectTrace[] {
  return allTraces(G).filter((trace) => trace.cardId === cardId);
}

/**
 * Every `secondary-site` trace, in order.
 *
 * @param G - The game state.
 * @returns The secondary-site traces.
 */
function secondaryTraces(G: LegendaryGameState): EffectTrace[] {
  return allTraces(G).filter((trace) => trace.status === 'secondary-site');
}

/** Endless Armies of HYDRA: "Fight: Play the top two cards of the Villain Deck." */
const ENDLESS_ARMIES_HOOK: VillainAbilityHook = {
  cardId: ENDLESS_ARMIES,
  timing: 'onFight',
  keywords: [],
  effects: [{ primitive: 'play-villain-deck-cards', magnitude: 2 }],
};

/** Mr. Immortal: "Fight: Reveal the top card of the Villain Deck. If it's a Villain or Bystander, ..." */
const MR_IMMORTAL_HOOK: VillainAbilityHook = {
  cardId: MR_IMMORTAL,
  timing: 'onFight',
  keywords: [],
  effects: [{ primitive: 'reenter-sewers-if-villain-deck-top', reenterRevealKinds: ['villain', 'bystander'] }],
};

describe('WP-877 secondary-site traces (D-24824)', () => {
  it('AC 2: Endless Armies records the executor no-op, then the fight-bridge trace, then the played cards\' traces', () => {
    const G = makeState([ENDLESS_ARMIES, null, null, null, null], [ENDLESS_ARMIES_HOOK, AMBUSH_VILLAIN_HOOK], [AMBUSH_VILLAIN, PLAIN_VILLAIN]);
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);

    const endlessTraces = tracesFor(G, ENDLESS_ARMIES);
    assert.equal(endlessTraces.length, 2);
    assert.equal(endlessTraces[0]!.status, 'no-op');
    assert.equal(endlessTraces[0]!.fireSite, 'villain-executor');
    assert.deepStrictEqual(endlessTraces[1], {
      cardId: ENDLESS_ARMIES,
      scope: 'villain',
      timing: 'onFight',
      effect: 'play-villain-deck-cards',
      handler: 'playTopVillainDeckCards',
      status: 'secondary-site',
      fireSite: 'villain-fight-bridge',
      params: { magnitude: 2 },
      turn: 6,
    });
    const traces = allTraces(G);
    const secondaryIndex = traces.indexOf(endlessTraces[1]!);
    const playedIndex = traces.findIndex((trace) => trace.cardId === AMBUSH_VILLAIN);
    assert.ok(playedIndex >= 0, 'the played card wrote its own Ambush trace');
    assert.ok(secondaryIndex < playedIndex, 'the cause precedes the consequence');
    assert.equal(G.villainDeck.deck.length, 0, 'both cards were played');
  });

  it('AC 3: The Leader\'s Ambush play records an ambush-bridge trace with the RevealContext turn', () => {
    const leaderHook: VillainAbilityHook = {
      cardId: THE_LEADER,
      timing: 'onAmbush',
      keywords: [],
      effects: [{ primitive: 'play-villain-deck-cards', magnitude: 1 }],
    };
    const G = makeState([null, null, null, null, null], [leaderHook], [THE_LEADER, PLAIN_VILLAIN]);
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);

    const leaderTraces = tracesFor(G, THE_LEADER);
    assert.deepStrictEqual(
      leaderTraces.map((trace) => [trace.status, trace.fireSite]),
      [['no-op', 'villain-executor'], ['secondary-site', 'villain-ambush-bridge']],
    );
    assert.equal(leaderTraces[1]!.timing, 'onAmbush');
    assert.equal(leaderTraces[1]!.handler, 'playTopVillainDeckCards');
    assert.deepStrictEqual(leaderTraces[1]!.params, { magnitude: 1 });
    assert.equal(leaderTraces[1]!.turn, AMBUSH_TURN);
  });

  it('AC 3: a gated The Leader whose player reveals a Strength Hero plays nothing and records no secondary trace', () => {
    // why: the co2e shape (`play-villain-deck-cards:1:hc:strength`); the play count is 0, so the bridge never runs.
    const gatedLeaderHook: VillainAbilityHook = {
      cardId: THE_LEADER,
      timing: 'onAmbush',
      keywords: [],
      effects: [{ primitive: 'play-villain-deck-cards', magnitude: 1, requireKind: 'hero-class', requireValue: 'strength' }],
    };
    const G = makeState([null, null, null, null, null], [gatedLeaderHook], [THE_LEADER, PLAIN_VILLAIN]);
    G.playerZones['0']!.hand = [STRENGTH_HERO];
    G.cardTraits = {
      ...(G.cardTraits ?? {}),
      [STRENGTH_HERO]: { heroClass: 'strength', team: null },
    } as unknown as LegendaryGameState['cardTraits'];
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);

    assert.deepStrictEqual(G.villainDeck.deck, [PLAIN_VILLAIN], 'nothing was played');
    assert.deepStrictEqual(secondaryTraces(G), []);
    const leaderTraces = tracesFor(G, THE_LEADER);
    assert.equal(leaderTraces.length, 1);
    assert.equal(leaderTraces[0]!.status, 'no-op');
  });

  it('AC 4: Mr. Immortal reenters, and the fight bridge records its trace', () => {
    const G = makeState([MR_IMMORTAL, null, null, null, null], [MR_IMMORTAL_HOOK], [PLAIN_VILLAIN]);
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);

    assert.equal(G.city[0], MR_IMMORTAL, 'he reentered the Sewers');
    const immortalTraces = tracesFor(G, MR_IMMORTAL);
    assert.deepStrictEqual(
      immortalTraces.map((trace) => [trace.status, trace.fireSite]),
      [['no-op', 'villain-executor'], ['secondary-site', 'villain-fight-bridge']],
    );
    assert.equal(immortalTraces[1]!.effect, 'reenter-sewers-if-villain-deck-top');
    assert.equal(immortalTraces[1]!.handler, 'reenterSewersOnVillainDeckReveal');
    assert.deepStrictEqual(immortalTraces[1]!.params, {});
    assert.equal(immortalTraces[1]!.turn, 6);
  });

  it('AC 4: Mr. Immortal stays defeated on a Scheme Twist, and the bridge trace is still recorded', () => {
    const G = makeState([MR_IMMORTAL, null, null, null, null], [MR_IMMORTAL_HOOK], [PLAIN_VILLAIN]);
    G.villainDeckCardTypes[PLAIN_VILLAIN] = 'scheme-twist';
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);

    assert.ok(G.playerZones['0']!.victory.includes(MR_IMMORTAL), 'he stays defeated');
    const secondary = secondaryTraces(G);
    assert.equal(secondary.length, 1);
    assert.equal(secondary[0]!.cardId, MR_IMMORTAL);
    assert.equal(secondary[0]!.fireSite, 'villain-fight-bridge');
  });

  it('AC 5: Groot\'s Fight stack entry records the marked count, not the one card a one-card Stack lets in', () => {
    const G = makeState([GROOT, null, null, null, null], REAL_STACK_HOOKS, []);
    G.piles.bystanders = ['pile-bystander' as CardExtId];
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);

    const grootSecondary = tracesFor(G, GROOT).filter((trace) => trace.status === 'secondary-site');
    assert.equal(grootSecondary.length, 1);
    assert.equal(grootSecondary[0]!.effect, 'stack-cards-enter-city-as-villains');
    assert.equal(grootSecondary[0]!.handler, 'enterStackCardsAsVillains');
    assert.equal(grootSecondary[0]!.fireSite, 'villain-fight-bridge');
    assert.deepStrictEqual(grootSecondary[0]!.params, { magnitude: 2, stackVillainKind: 'bystander' });
    assert.equal(G.piles.bystanders.length, 0, 'only the one Stack card entered');
  });

  it('AC 5: Agent Eric Marshall\'s Ambush stack entry records an ambush-bridge trace', () => {
    const G = makeState([null, null, null, null, null], REAL_STACK_HOOKS, [ERIC_MARSHALL]);
    G.piles.officers = ['pile-shield-officer' as CardExtId];
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);

    const ericSecondary = tracesFor(G, ERIC_MARSHALL).filter((trace) => trace.status === 'secondary-site');
    assert.equal(ericSecondary.length, 1);
    assert.equal(ericSecondary[0]!.timing, 'onAmbush');
    assert.equal(ericSecondary[0]!.fireSite, 'villain-ambush-bridge');
    assert.deepStrictEqual(ericSecondary[0]!.params, { magnitude: 1, stackVillainKind: 'officer' });
    assert.equal(ericSecondary[0]!.turn, AMBUSH_TURN);
  });

  it('AC 6 / AC 9: scope follows the card type, and the helper writes only one trace', () => {
    const G = makeState([null, null, null, null, null], [], []);
    G.villainDeckCardTypes[SYNTHETIC_HENCHMAN] = 'henchman';
    const { diagnostics: diagnosticsBefore, ...stateBefore } = structuredClone(G);
    const tracesBefore = diagnosticsBefore?.traces?.length ?? 0;
    const messagesBefore = G.messages.length;

    recordVillainSecondarySiteTrace(G, SYNTHETIC_HENCHMAN, 'onFight', 'play-villain-deck-cards', 'playTopVillainDeckCards', 'villain-fight-bridge', { magnitude: 1 }, 4);

    const { diagnostics: diagnosticsAfter, ...stateAfter } = G;
    assert.deepStrictEqual(stateAfter, stateBefore, 'nothing outside diagnostics changed');
    assert.equal(G.messages.length, messagesBefore, 'no log line');
    assert.equal(diagnosticsAfter?.traces?.length, tracesBefore + 1, 'exactly one trace');
    assert.equal(allTraces(G)[tracesBefore]!.scope, 'henchman');

    recordVillainSecondarySiteTrace(G, PLAIN_VILLAIN, 'onFight', 'play-villain-deck-cards', 'playTopVillainDeckCards', 'villain-fight-bridge', { magnitude: 1 }, 4);
    assert.equal(allTraces(G)[tracesBefore + 1]!.scope, 'villain');
  });

  it('AC 7: a Villain Deck defeat of Endless Armies (the Nightbringer path) also records the fight-bridge trace', () => {
    const G = makeState([null, null, null, null, null], [ENDLESS_ARMIES_HOOK], [PLAIN_VILLAIN]);
    G.playerZones['0']!.victory = [ENDLESS_ARMIES];
    resolveVillainDeckDefeatFightEffect(G, FIGHT_CTX, ENDLESS_ARMIES, SHUFFLE_CONTEXT);

    const secondary = secondaryTraces(G);
    assert.equal(secondary.length, 1);
    assert.equal(secondary[0]!.cardId, ENDLESS_ARMIES);
    assert.equal(secondary[0]!.fireSite, 'villain-fight-bridge');
  });

  it('AC 8: an ordinary Fight records no secondary trace, and the executor keeps all five deliberate no-ops', () => {
    const drawHook: VillainAbilityHook = {
      cardId: DRAW_VILLAIN,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'draw-cards-current', magnitude: 1 }],
    };
    const fought = makeState([DRAW_VILLAIN, null, null, null, null], [drawHook], []);
    defeatCityVillainCore(fought, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    assert.deepStrictEqual(secondaryTraces(fought), []);
    assert.equal(tracesFor(fought, DRAW_VILLAIN)[0]!.status, 'fired');

    // why: the executor alone (no bridge) dispatches each deliberate-no-op primitive once.
    const allNoOpHook: VillainAbilityHook = {
      cardId: PLAIN_VILLAIN,
      timing: 'onFight',
      keywords: [],
      effects: [
        { primitive: 'become-scheme-twist' },
        { primitive: 'gain-attached-hero' },
        { primitive: 'play-villain-deck-cards', magnitude: 1 },
        { primitive: 'reenter-sewers-if-villain-deck-top', reenterRevealKinds: ['villain'] },
        { primitive: 'stack-cards-enter-city-as-villains', stackVillainKind: 'bystander', magnitude: 1 },
      ],
    };
    const executed = makeState([null, null, null, null, null], [allNoOpHook], []);
    executeVillainAbilities(executed, FIGHT_CTX, PLAIN_VILLAIN, 'onFight', SHUFFLE_CONTEXT);
    assert.deepStrictEqual(
      tracesFor(executed, PLAIN_VILLAIN).map((trace) => [trace.effect, trace.status, trace.fireSite]),
      [
        ['become-scheme-twist', 'no-op', 'villain-executor'],
        ['gain-attached-hero', 'no-op', 'villain-executor'],
        ['play-villain-deck-cards', 'no-op', 'villain-executor'],
        ['reenter-sewers-if-villain-deck-top', 'no-op', 'villain-executor'],
        ['stack-cards-enter-city-as-villains', 'no-op', 'villain-executor'],
      ],
    );
    assert.deepStrictEqual(secondaryTraces(executed), []);
  });
});

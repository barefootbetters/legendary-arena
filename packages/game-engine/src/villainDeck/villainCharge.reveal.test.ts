/**
 * The Ambush charge bridge (WP-874 / D-24820): Bulldozer's `charge:1:demolish-if-pushed` through
 * the real `performVillainReveal`.
 *
 * Bulldozer's hook comes from the committed `data/cards/chmp.json` through the real setup parser;
 * the reveal runs with the real `DEFAULT_IMPLEMENTATION_MAP`, so a Villain the charge pushes out of
 * the City runs the full `resolveVillainEscape`. Every City filler is a Wrecking Crew Villain with
 * no `onEscape` hook (Thunderball and The Wrecker copies), except the named Piledriver, whose Escape
 * Demolishes.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { performVillainReveal } from './villainDeck.reveal.js';
import type { RevealContext } from './villainDeck.reveal.js';
import { villainCardChargeEffect } from '../villain/villainEffects.execute.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import { checkNoCardInMultipleZones } from '../invariants/gameRules.checks.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { EffectTrace } from '../diagnostics/hollowEffect.types.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');
const WRECKING_CREW = 'chmp/wrecking-crew';

const BULLDOZER = 'chmp-villain-wrecking-crew-bulldozer-00' as CardExtId;
const PILEDRIVER = 'chmp-villain-wrecking-crew-piledriver-00' as CardExtId;
// why: the four Wrecking Crew copies with no `onEscape` hook, used as City fillers.
const THUNDERBALL_A = 'chmp-villain-wrecking-crew-thunderball-00' as CardExtId;
const THUNDERBALL_B = 'chmp-villain-wrecking-crew-thunderball-01' as CardExtId;
const WRECKER_A = 'chmp-villain-wrecking-crew-the-wrecker-00' as CardExtId;
const WRECKER_B = 'chmp-villain-wrecking-crew-the-wrecker-01' as CardExtId;

const HERO_COST_3 = 'test/hero/cost-3#0' as CardExtId;
const HERO_COST_5 = 'test/hero/cost-5#0' as CardExtId;
const HERO_COST_2 = 'test/hero/cost-2#0' as CardExtId;
const HERO_COST_4 = 'test/hero/cost-4#0' as CardExtId;
const HERO_COST_6 = 'test/hero/cost-6#0' as CardExtId;
const HAND_COST_3 = 'test/hero/hand-cost-3#0' as CardExtId;
const HAND_COST_5 = 'test/hero/hand-cost-5#0' as CardExtId;

const AMBUSH_TURN = 7;

/**
 * Builds a registry reader over the given `data/cards/*.json` sets.
 *
 * @param setAbbrs - The set abbreviations to load.
 * @returns A minimal registry with `getSet`.
 */
function makeRegistry(setAbbrs: readonly string[]): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

/**
 * The real Wrecking Crew hooks.
 *
 * @returns The hooks the real setup parser builds for the group.
 */
function buildWreckingCrewHooks(): VillainAbilityHook[] {
  const config = { villainGroupIds: [WRECKING_CREW], henchmanGroupIds: [] } as unknown as MatchConfiguration;
  return buildVillainAbilityHooks(makeRegistry(['chmp']), config);
}

const REAL_HOOKS = buildWreckingCrewHooks();

/**
 * The Wrecking Crew copies' display names from the card data, plus the test Heroes.
 *
 * @returns A `G.cardDisplayData` snapshot.
 */
function makeDisplayData(): Record<string, { name: string; imageUrl: string; cost: number }> {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'chmp.json'), 'utf8')) as {
    villains: { slug: string; cards: { slug: string; name: string }[] }[];
  };
  const group = setData.villains.find((entry) => entry.slug === 'wrecking-crew')!;
  const displayData: Record<string, { name: string; imageUrl: string; cost: number }> = {};
  for (const card of group.cards) {
    for (const copySuffix of ['00', '01']) {
      displayData[`chmp-villain-wrecking-crew-${card.slug}-${copySuffix}`] = { name: card.name, imageUrl: '', cost: 0 };
    }
  }
  const heroNames: Record<string, string> = {
    [HERO_COST_3]: 'Three', [HERO_COST_5]: 'Five', [HERO_COST_2]: 'Two', [HERO_COST_4]: 'Four', [HERO_COST_6]: 'Six',
    [HAND_COST_3]: 'Hand Three', [HAND_COST_5]: 'Hand Five',
  };
  for (const [cardId, name] of Object.entries(heroNames)) {
    displayData[cardId] = { name, imageUrl: '', cost: 0 };
  }
  return displayData;
}

/**
 * A two-seat state: the given City, the real Wrecking Crew hooks (or the given ones), a Hero Deck
 * of costed Heroes, player 0 holding a cost-3 card and player 1 a cost-5 card.
 *
 * @param city - The City before the reveal.
 * @param hooks - The villain ability hooks.
 * @returns The game state.
 */
function makeState(city: (CardExtId | null)[], hooks: VillainAbilityHook[] = REAL_HOOKS): LegendaryGameState {
  const cardTypes: Record<string, string> = {};
  const cardKeywords: Record<string, string[]> = {};
  for (const cardId of Object.keys(makeDisplayData())) {
    if (cardId.startsWith('chmp-villain-')) {
      cardTypes[cardId] = 'villain';
    }
  }
  cardKeywords[BULLDOZER] = ['ambush'];
  const cost = (value: number) => ({ attack: 0, recruit: 0, cost: value, fightCost: 0 });
  return {
    currentStage: 'start',
    messages: [],
    counters: { [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: 0 },
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), hand: [HAND_COST_3] },
      '1': { ...makePlayerZones(), hand: [HAND_COST_5] },
    },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [BULLDOZER], discard: [] },
    villainDeckCardTypes: cardTypes,
    city: [...city],
    hq: [null, null, null, null, null],
    heroDeck: [HERO_COST_3, HERO_COST_5, HERO_COST_2, HERO_COST_4, HERO_COST_6],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    scheme: { twistPile: [] },
    selection: { schemeId: 'test/scheme', mastermindId: 'test/mastermind', villainGroupIds: [WRECKING_CREW], henchmanGroupIds: [], heroDeckIds: [] },
    heroAbilityHooks: [],
    villainAbilityHooks: [...hooks],
    cardStats: {
      [HERO_COST_3]: cost(3), [HERO_COST_5]: cost(5), [HERO_COST_2]: cost(2), [HERO_COST_4]: cost(4), [HERO_COST_6]: cost(6),
      [HAND_COST_3]: cost(3), [HAND_COST_5]: cost(5),
    },
    cardTraits: {},
    cardKeywords,
    cardDisplayData: makeDisplayData(),
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Reveals Bulldozer from the top of the Villain Deck through the real reveal path.
 *
 * @param G - The game state.
 */
function revealBulldozer(G: LegendaryGameState): void {
  const context: RevealContext = {
    random: makeMockCtx({ numPlayers: 2 }).random,
    ctx: { currentPlayer: '0', turn: AMBUSH_TURN },
  };
  performVillainReveal(G, context, DEFAULT_IMPLEMENTATION_MAP);
}

/**
 * The log lines with their outcomes.
 *
 * @param G - The game state.
 * @returns "outcome: text" lines.
 */
function logLines(G: LegendaryGameState): string[] {
  return G.messages.map((message) => `${message.outcome}: ${message.text}`);
}

/**
 * The index of the first log line containing a substring, or -1.
 *
 * @param G - The game state.
 * @param fragment - The text to look for.
 * @returns The line index.
 */
function logIndexOf(G: LegendaryGameState, fragment: string): number {
  return G.messages.findIndex((message) => message.text.includes(fragment));
}

/**
 * The ambushResolved event for Bulldozer.
 *
 * @param G - The game state.
 * @returns Its narrative and citySpace.
 */
function bulldozerAmbush(G: LegendaryGameState): { narrative: string; citySpace: number } {
  for (const event of G.notableEvents as unknown as { type: string; revealedCardId: string; narrative: string; citySpace: number }[]) {
    if (event.type === 'ambushResolved' && event.revealedCardId === BULLDOZER) {
      return event;
    }
  }
  assert.fail('no ambushResolved event for Bulldozer');
}

/**
 * Every trace, in record order.
 *
 * @param G - The game state.
 * @returns The traces.
 */
function allTraces(G: LegendaryGameState): EffectTrace[] {
  return G.diagnostics?.traces ?? [];
}

/**
 * The `effect:status` of every trace recorded for Bulldozer.
 *
 * @param G - The game state.
 * @returns The statuses in record order.
 */
function bulldozerTraceStatuses(G: LegendaryGameState): string[] {
  const statuses: string[] = [];
  for (const trace of allTraces(G)) {
    if (trace.cardId === BULLDOZER) {
      statuses.push(`${trace.effect}:${trace.status}`);
    }
  }
  return statuses;
}

/**
 * Counts the Demolish reveals in the log.
 *
 * @param G - The game state.
 * @returns How many Hero Deck cards a Demolish revealed.
 */
function demolishRevealCount(G: LegendaryGameState): number {
  return G.messages.filter((message) => message.text.includes('Demolish revealed')).length;
}

/**
 * The real hooks with Bulldozer's Ambush replaced by a hand-built one.
 *
 * @param ambushHook - The replacement Ambush hook.
 * @returns The hooks.
 */
function hooksWithBulldozerAmbush(ambushHook: VillainAbilityHook): VillainAbilityHook[] {
  const hooks = REAL_HOOKS.filter((hook) => !(hook.cardId === BULLDOZER && hook.timing === 'onAmbush'));
  hooks.push(ambushHook);
  return hooks;
}

describe("WP-874 Bulldozer's Ambush charge (RS-4, D-24820)", () => {
  it('parses to charge:1 with the demolish-if-pushed consequence', () => {
    const hook = REAL_HOOKS.find((candidate) => candidate.cardId === BULLDOZER && candidate.timing === 'onAmbush');
    assert.ok(hook !== undefined);
    assert.deepStrictEqual(hook.effects, [{ primitive: 'charge', magnitude: 1, chargePushConsequence: 'demolish-if-pushed' }]);
    assert.deepStrictEqual(villainCardChargeEffect(makeState([null, null, null, null, null]), BULLDOZER, 'onAmbush'), {
      spaces: 1,
      pushConsequence: 'demolish-if-pushed',
    });
  });

  it('an empty City: Bulldozer charges into the Bank, pushes nothing, and no one is Demolished', () => {
    const G = makeState([null, null, null, null, null]);
    revealBulldozer(G);

    assert.deepStrictEqual(G.city, [null, BULLDOZER, null, null, null]);
    assert.deepStrictEqual(G.heroDeck, [HERO_COST_3, HERO_COST_5, HERO_COST_2, HERO_COST_4, HERO_COST_6], 'no Hero Deck rotation');
    assert.deepStrictEqual(logLines(G), [
      'threat: [Ambush] Bulldozer (chmp-villain-wrecking-crew-bulldozer-00) revealed and entered the city!',
      'threat: Ambush effect: Bulldozer charged forward one space to the Bank.',
      'blocked: Ambush effect: Bulldozer pushed no Villains forward, so no one is Demolished.',
    ]);
    const ambush = bulldozerAmbush(G);
    assert.equal(ambush.citySpace, 1, 'the hashed citySpace is read after the charge');
    assert.equal(ambush.narrative, '"Bulldozer" ambushed: charged forward one space.', 'the sixth-slot charge clause');
  });

  it('one Villain ahead: the charge pushes it, then one Demolish', () => {
    const G = makeState([THUNDERBALL_A, null, null, null, null]);
    revealBulldozer(G);

    assert.deepStrictEqual(G.city, [null, BULLDOZER, THUNDERBALL_A, null, null]);
    assert.deepStrictEqual(G.heroDeck, [HERO_COST_5, HERO_COST_2, HERO_COST_4, HERO_COST_6, HERO_COST_3], 'one rotation');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [HAND_COST_3]);
    assert.deepStrictEqual(G.playerZones['1']!.discard, []);
    assert.deepStrictEqual(logLines(G), [
      'threat: [Ambush] Bulldozer (chmp-villain-wrecking-crew-bulldozer-00) revealed and entered the city!',
      'threat: Ambush effect: Bulldozer charged forward one space to the Bank, pushing the Villains ahead of it forward.',
      'applied: Ambush effect: Demolish revealed Three (cost 3) and put it on the bottom of the Hero Deck.',
      'applied: Ambush effect: Player 0 discarded Hand Three (cost 3).',
      'blocked: Ambush effect: Player 1 has no card that costs 3 to discard.',
    ]);
    const ambush = bulldozerAmbush(G);
    assert.equal(ambush.citySpace, 1);
    assert.equal(ambush.narrative, '"Bulldozer" ambushed: charged forward one space, pushing Villains forward, then Demolished each player.');
  });

  it('a full block ahead: the last Villain escapes inside the charge, its escape steps stay queued, then one Demolish', () => {
    const G = makeState([null, THUNDERBALL_A, THUNDERBALL_B, WRECKER_A, WRECKER_B]);
    revealBulldozer(G);

    assert.deepStrictEqual(G.city, [null, BULLDOZER, THUNDERBALL_A, THUNDERBALL_B, WRECKER_A]);
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 1, 'the escape counter rose once');
    assert.deepStrictEqual(G.escapedPile, [WRECKER_B], 'the Escape Pile gained the pushed-off Villain');
    assert.equal(demolishRevealCount(G), 1);
    assert.deepStrictEqual(G.heroDeck, [HERO_COST_5, HERO_COST_2, HERO_COST_4, HERO_COST_6, HERO_COST_3]);
    assert.ok(logIndexOf(G, 'escaped from the city') < logIndexOf(G, 'Demolish revealed'), 'the escape precedes the Demolish');
    // why: D-24656 §4 — the pushed-off Villain's HQ KO and Bystander steps are queued, not run:
    // the Demolish has already happened while its entry is still pending.
    assert.deepStrictEqual(G.pendingEscapeProcedures, [
      { escapedCardId: WRECKER_B, chooserPlayerID: '0', hasCarriedBystanders: false, isHqKoResolved: false },
    ]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [HAND_COST_3]);
  });

  it("Piledriver pushed out: its Escape Demolish fires inside the charge, then Bulldozer's", () => {
    const G = makeState([null, THUNDERBALL_A, THUNDERBALL_B, WRECKER_A, PILEDRIVER]);
    revealBulldozer(G);

    assert.deepStrictEqual(G.escapedPile, [PILEDRIVER]);
    assert.equal(demolishRevealCount(G), 2);
    assert.deepStrictEqual(G.heroDeck, [HERO_COST_2, HERO_COST_4, HERO_COST_6, HERO_COST_3, HERO_COST_5], 'two rotations');
    const escapeReveal = logIndexOf(G, 'Escape effect: Demolish revealed Three (cost 3)');
    const ambushReveal = logIndexOf(G, 'Ambush effect: Demolish revealed Five (cost 5)');
    assert.ok(escapeReveal >= 0 && ambushReveal > escapeReveal, "Piledriver's Demolish runs first");
    assert.deepStrictEqual(G.playerZones['0']!.discard, [HAND_COST_3], "the first Demolish's cost drove player 0's discard");
    assert.deepStrictEqual(G.playerZones['1']!.discard, [HAND_COST_5], "the second Demolish's cost drove player 1's discard");
    // why: D-24824 — Bulldozer's bridge trace, then Piledriver's escape trace, then Bulldozer's
    // executor no-op.
    const traceOrder = allTraces(G).map((trace) => `${trace.cardId}|${trace.effect}:${trace.status}`);
    assert.deepStrictEqual(traceOrder, [
      `${BULLDOZER}|charge:secondary-site`,
      `${PILEDRIVER}|demolish-each-player:fired`,
      `${BULLDOZER}|charge:no-op`,
    ]);
  });

  it("the real hook's traces read the bridge's secondary-site first and the executor's no-op last", () => {
    const G = makeState([THUNDERBALL_A, null, null, null, null]);
    revealBulldozer(G);

    const traces = allTraces(G).filter((trace) => trace.cardId === BULLDOZER);
    assert.equal(traces.length, 2);
    assert.deepStrictEqual(traces[0], {
      cardId: BULLDOZER,
      scope: 'villain',
      timing: 'onAmbush',
      effect: 'charge',
      handler: 'chargeAmbushVillain',
      status: 'secondary-site',
      fireSite: 'villain-ambush-bridge',
      params: { magnitude: 1 },
      turn: AMBUSH_TURN,
    });
    assert.equal(traces[1]!.effect, 'charge');
    assert.equal(traces[1]!.status, 'no-op');
    assert.equal(traces[1]!.fireSite, 'villain-executor');
  });

  it('ordering proof: the bridge charges BEFORE the executor counts (4 Demolishes, not 5)', () => {
    const orderingHook: VillainAbilityHook = {
      cardId: BULLDOZER,
      timing: 'onAmbush',
      keywords: [],
      effects: [{ primitive: 'charge', magnitude: 1 }, { primitive: 'demolish-each-player-per-group-villain-in-city' }],
    };
    const G = makeState([null, THUNDERBALL_A, THUNDERBALL_B, WRECKER_A, WRECKER_B], hooksWithBulldozerAmbush(orderingHook));
    revealBulldozer(G);

    assert.deepStrictEqual(G.escapedPile, [WRECKER_B], 'the charge pushed one Wrecking Crew Villain out first');
    assert.equal(demolishRevealCount(G), 4, 'executor-first would have counted 5');
    assert.deepStrictEqual(G.heroDeck, [HERO_COST_6, HERO_COST_3, HERO_COST_5, HERO_COST_2, HERO_COST_4], 'four rotations');
    const narrative = bulldozerAmbush(G).narrative;
    assert.ok(
      narrative.startsWith('"Bulldozer" ambushed: Demolish each player 4 time(s), once for each wrecking-crew Villain in the City; '),
      'the handler-run clause comes first',
    );
    assert.ok(narrative.endsWith('; charged forward one space, pushing Villains forward.'), 'the charge clause is last');
    assert.deepStrictEqual(bulldozerTraceStatuses(G), [
      'charge:secondary-site',
      'charge:no-op',
      'demolish-each-player-per-group-villain-in-city:fired',
    ]);
  });

  it('a gated charge is inert: the reader returns null and nothing charges', () => {
    const gatedHook: VillainAbilityHook = {
      cardId: BULLDOZER,
      timing: 'onAmbush',
      keywords: [],
      effects: [{ primitive: 'charge', magnitude: 1, requireCitySpaces: ['bank'] }],
    };
    const G = makeState([null, null, null, null, null], hooksWithBulldozerAmbush(gatedHook));
    assert.equal(villainCardChargeEffect(G, BULLDOZER, 'onAmbush'), null);

    revealBulldozer(G);

    assert.deepStrictEqual(G.city, [BULLDOZER, null, null, null, null]);
    assert.deepStrictEqual(bulldozerTraceStatuses(G), []);
    assert.equal(bulldozerAmbush(G).narrative, '"Bulldozer" entered the city with no Ambush effect.');
  });
});

describe('the charge-first premise in the card data (WP-874 RS-4 Ordering)', () => {
  it('every charge descriptor is the first effect of its onAmbush hook', () => {
    const setAbbrs: string[] = [];
    const groupIds: string[] = [];
    for (const fileName of readdirSync(CARDS_DIRECTORY).sort()) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      const setAbbr = fileName.slice(0, -'.json'.length);
      setAbbrs.push(setAbbr);
      const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, fileName), 'utf8')) as { villains?: { slug: string }[] };
      for (const group of setData.villains ?? []) {
        groupIds.push(`${setAbbr}/${group.slug}`);
      }
    }
    const config = { villainGroupIds: groupIds, henchmanGroupIds: [] } as unknown as MatchConfiguration;
    const hooks = buildVillainAbilityHooks(makeRegistry(setAbbrs), config);

    let chargeCount = 0;
    for (const hook of hooks) {
      for (let effectIndex = 0; effectIndex < hook.effects.length; effectIndex++) {
        if (hook.effects[effectIndex]!.primitive !== 'charge') {
          continue;
        }
        chargeCount += 1;
        assert.equal(hook.timing, 'onAmbush', `${hook.cardId}: a charge is marked only on an Ambush`);
        assert.equal(effectIndex, 0, `${hook.cardId}: the charge is its Ambush hook's first effect`);
      }
    }
    assert.ok(chargeCount > 0, 'at least one charge (Bulldozer) is marked');
  });
});

// ---------------------------------------------------------------------------
// WP-839 / D-24772 — co2e Speed Demon reuses `charge` (`charge:2:discard-if-pushed`), T13-T16
// ---------------------------------------------------------------------------

describe('WP-839 Speed Demon charges two spaces and owes a discard (D-24772)', () => {
  const SPEED_DEMON = 'co2e-villain-sinister-syndicate-speed-demon-00' as CardExtId;
  const fillers = ['v1', 'v2', 'v3', 'v4', 'v5'].map((slug) => `test/villain/${slug}#0` as CardExtId);
  const [v1, v2, v3, v4, v5] = fillers as [CardExtId, CardExtId, CardExtId, CardExtId, CardExtId];
  const speedDemonHooks = buildVillainAbilityHooks(
    makeRegistry(['co2e']),
    { villainGroupIds: ['co2e/sinister-syndicate'], henchmanGroupIds: [] } as unknown as MatchConfiguration,
  );

  /**
   * A two-seat state with Speed Demon on top of the Villain Deck and the given City.
   *
   * @param city - The City before the reveal.
   * @returns The game state.
   */
  function makeSpeedDemonState(city: (CardExtId | null)[]): LegendaryGameState {
    const cardTypes: Record<string, string> = { [SPEED_DEMON]: 'villain' };
    const displayData: Record<string, { name: string; imageUrl: string; cost: number }> = {
      [SPEED_DEMON]: { name: 'Speed Demon', imageUrl: '', cost: 0 },
    };
    for (const filler of fillers) {
      cardTypes[filler] = 'villain';
      displayData[filler] = { name: filler.slice('test/villain/'.length, -2), imageUrl: '', cost: 0 };
    }
    return {
      currentStage: 'start',
      messages: [],
      counters: { [ENDGAME_CONDITIONS.ESCAPED_VILLAINS]: 0 },
      hookRegistry: [],
      turnEconomy: { ...makeTurnEconomy() },
      playerZones: { '0': { ...makePlayerZones(), hand: [HAND_COST_3] }, '1': { ...makePlayerZones(), hand: [HAND_COST_5] } },
      piles: makeGlobalPiles(),
      mastermind: makeMastermindState(),
      villainDeck: { deck: [SPEED_DEMON], discard: [] },
      villainDeckCardTypes: cardTypes,
      city: [...city],
      hq: [null, null, null, null, null],
      heroDeck: [],
      escapedPile: [],
      ko: [],
      attachedBystanders: {},
      villainAttachedHeroes: {},
      scheme: { twistPile: [] },
      selection: { schemeId: 'test/scheme', mastermindId: 'test/mastermind', villainGroupIds: ['co2e/sinister-syndicate'], henchmanGroupIds: [], heroDeckIds: [] },
      heroAbilityHooks: [],
      villainAbilityHooks: [...speedDemonHooks],
      cardStats: {},
      cardTraits: {},
      cardKeywords: { [SPEED_DEMON]: ['ambush'] },
      cardDisplayData: displayData,
      notableEvents: [],
    } as unknown as LegendaryGameState;
  }

  /**
   * Reveals Speed Demon through the real reveal path.
   *
   * @param G - The game state.
   */
  function revealSpeedDemon(G: LegendaryGameState): void {
    const context: RevealContext = {
      random: makeMockCtx({ numPlayers: 2 }).random,
      ctx: { currentPlayer: '0', turn: AMBUSH_TURN },
    };
    performVillainReveal(G, context, DEFAULT_IMPLEMENTATION_MAP);
  }

  /**
   * Speed Demon's ambushResolved narrative.
   *
   * @param G - The game state.
   * @returns The narrative.
   */
  function speedDemonNarrative(G: LegendaryGameState): string {
    const events = G.notableEvents as unknown as { type: string; revealedCardId: string; narrative: string }[];
    return events.find((event) => event.type === 'ambushResolved' && event.revealedCardId === SPEED_DEMON)!.narrative;
  }

  it('T6: villainCardChargeEffect reads his real hook as a 2-space charge with the discard consequence', () => {
    const G = makeSpeedDemonState([null, null, null, null, null]);
    assert.deepStrictEqual(villainCardChargeEffect(G, SPEED_DEMON, 'onAmbush'), {
      spaces: 2,
      pushConsequence: 'discard-if-pushed',
    });
  });

  it('T13: a Villain ahead of him is pushed, so every player owes a discard', () => {
    const G = makeSpeedDemonState([null, v1, null, null, null]);
    revealSpeedDemon(G);
    assert.deepStrictEqual(G.city, [null, null, SPEED_DEMON, v1, null]);
    assert.deepStrictEqual(G.pendingEscapeEffectDiscards, [
      { escapedCardId: SPEED_DEMON, eligibleCosts: [], anyHandCard: { effectLabel: 'Ambush' } },
    ]);
    const lines = logLines(G);
    assert.ok(lines.includes('threat: Ambush effect: Speed Demon charged forward one space to the Bank, pushing the Villains ahead of it forward.'));
    assert.ok(lines.includes('threat: Ambush effect: Speed Demon charged forward one space to the Rooftops, pushing the Villains ahead of it forward.'));
    assert.equal(lines.at(-1), 'threat: Ambush effect: Speed Demon pushed Villains forward, so each player must discard a card.');
    assert.equal(
      speedDemonNarrative(G),
      '"Speed Demon" ambushed: charged forward 2 spaces, pushing Villains forward, then each player must discard a card.',
    );
    assert.doesNotThrow(() => checkNoCardInMultipleZones(G));
  });

  it('T14: an empty City is not pushed, so no one discards', () => {
    const G = makeSpeedDemonState([null, null, null, null, null]);
    revealSpeedDemon(G);
    assert.deepStrictEqual(G.city, [null, null, SPEED_DEMON, null, null]);
    assert.equal(G.pendingEscapeEffectDiscards, undefined);
    assert.equal(logLines(G).at(-1), 'blocked: Ambush effect: Speed Demon pushed no Villains forward, so no one discards.');
    assert.equal(speedDemonNarrative(G), '"Speed Demon" ambushed: charged forward 2 spaces.');
  });

  it('T15: a full City — the entry escapes v5, the charge escapes v4 then v3, in rule order', () => {
    const G = makeSpeedDemonState([v1, v2, v3, v4, v5]);
    revealSpeedDemon(G);
    assert.deepStrictEqual(G.city, [null, null, SPEED_DEMON, v1, v2]);
    assert.deepStrictEqual(G.escapedPile, [v5, v4, v3]);
    assert.deepStrictEqual(
      (G.pendingEscapeProcedures ?? []).map((entry) => entry.escapedCardId),
      [v5, v4, v3],
    );
    assert.equal(G.pendingEscapeEffectDiscards?.length, 1);
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 3);
    assert.doesNotThrow(() => checkNoCardInMultipleZones(G));
  });

  it('T16: a 2-space City — step 1 escapes v1, step 2 the charger escapes; the discard is still owed', () => {
    const G = makeSpeedDemonState([null, v1]);
    revealSpeedDemon(G);
    assert.deepStrictEqual(G.city, [null, null]);
    assert.deepStrictEqual(G.escapedPile, [v1, SPEED_DEMON]);
    assert.ok(logLines(G).includes('threat: Ambush effect: Speed Demon charged forward out of the city.'));
    assert.equal(G.pendingEscapeEffectDiscards?.length, 1);
    assert.doesNotThrow(() => checkNoCardInMultipleZones(G));
  });
});